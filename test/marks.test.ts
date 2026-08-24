// 平面の印 — 共有ベースが「言葉を持たない」ことと、Form のエンティティを一つも取りこぼさない
// ことを機械で確かめる。
//
// 一番効くのは「すべての平面エンティティが説明される」試験である。koyu が PlanClass や
// PlanRole を増やした日、印は黙って出なくなる — 消費者の両方が同時に、静かに失う。
// ADR-0040 で一度払った失敗であり (ugatsu の平面から上部吹抜けの投影が11個消えていた)、
// それを二度目に払わないための一本である。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { derive } from "../src/core/derive.js";
import { canonicalBoundaryOrder } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { planMarks, SLIDE_GAP, type Mark } from "../src/draw/marks.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC_MARKS = readFileSync(join(root, "src/draw/marks.ts"), "utf8");

const SRC = `koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 9000
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y3
space /L1/b room X2..X3 Y1..Y2
space /L1/c room X2..X3 Y2..Y3 t:150
space /out outside:1
column 600 L1
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /L1/c
  window w:1200
boundary /L1/a /out edge:W
  window w:1600 h:1100
boundary /L1/c /out edge:N
`;

/** 四点を回転と向きに依らない一つの綴りへ */
const ringKey = (pts: Array<{ x: number; y: number }>): string => {
  const s = pts.map((p) => `${Math.round(p.x * 1e6) / 1e6},${Math.round(p.y * 1e6) / 1e6}`);
  const rot = (a: string[]) => a.map((_, i) => a.slice(i).concat(a.slice(0, i)).join(" ")).sort()[0]!;
  const f = rot(s);
  const r = rot([...s].reverse());
  return f < r ? f : r;
};

const bag = (keys: string[]): Map<string, number> => {
  const b = new Map<string, number>();
  for (const k of keys) b.set(k, (b.get(k) ?? 0) + 1);
  return b;
};

/** コメントを落とした本体 — 説明の言葉は日本語でよい。禁じているのは**出力に混ざる**語である */
const codeOf = (src: string): string => {
  const out: string[] = [];
  let inBlock = false;
  for (const line of src.split("\n")) {
    const t = line.trimStart();
    if (inBlock) {
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    if (t.startsWith("/*")) {
      if (!t.includes("*/")) inBlock = true;
      continue;
    }
    if (t.startsWith("//")) continue;
    out.push(line);
  }
  return out.join("\n");
};

// ---- 1. 言葉を持たない ----

test("marks: the base holds no word — no wording, no rounding, no language", () => {
  const body = codeOf(SRC_MARKS);
  assert.ok(!body.includes("`"), "a template literal is how a formatted note gets written");
  const foreign = [...body].filter((c) => (c.codePointAt(0) ?? 0) > 127);
  assert.deepEqual(foreign, [], "a non-ASCII character in the code is a word in someone's language");
  assert.ok(
    !body.includes("Math.round"),
    "rounding is part of the wording — 1/12.5 and 1/13 are the consumer's choice",
  );
  assert.ok(!body.includes("toFixed"), "formatting is wording");
});

// ---- 2. 切断面より下の手すりが消えない ----

test("marks: a handrail below the cut plane is still drawn", () => {
  const form = derive(
    parse(`koyu 1.1
grid X 0 4000
grid Y 0 5000 9000
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b air:1 h:1100
`),
  );
  const rails = planMarks(form, "L1").filter((m) => m.role === "rail");
  assert.ok(
    rails.length > 0,
    "a rail stands 1100 high and the plane cuts at 1200 — asking the class first drops every one",
  );
  for (const r of rails) assert.ok((r.lines?.length ?? 0) >= 1, "a rail is drawn as its axis");
});

test("marks: every stair arrow points towards increasing elevation on a general floor", () => {
  const form = derive(
    parse(`muro 1.5
grid X 0 3000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level L3 6000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2 stair:N
space /L3/s stair X1..X2 Y1..Y2
stack s L1..L3 type:stair
`),
  );
  const raw = form.plans.find((p) => p.level === "L2")!.entities.filter(
    (e) => e.of === "run" && e.role === "arrow",
  );
  const arrows = planMarks(form, "L2").filter((m) => m.role === "run-arrow");
  assert.equal(arrows.length, 2, "a general floor shows the departing and arriving stair flights");
  assert.ok(
    arrows.every((m) => m.note?.of === "direction" && m.note.up),
    "both presentation arrows mean increasing elevation",
  );

  const rawArriving = raw.find((e) => e.class === "below")!.lines![0]!;
  const arriving = arrows.find((m) => m.class === "below")!.lines![0]!;
  const dot =
    (arriving.x2 - arriving.x1) * (rawArriving.x2 - rawArriving.x1) +
    (arriving.y2 - arriving.y1) * (rawArriving.y2 - rawArriving.y1);
  assert.ok(dot < 0, "the flight from below points opposite to its raw descending travel arrow");
  assert.ok(arriving.y2 > rawArriving.y1, "its head reaches the current landing instead of stopping short");
});

test("marks: a return stair arrow continues across its landing", () => {
  const form = derive(parseFile(join(root, "test/fixtures/stair-arrows.muro")));
  const marksByLevel = ["L1", "L2", "L3"].map((level) => planMarks(form, level));
  const perLevel = marksByLevel.map((marks) => marks.filter((m) => m.role === "run-arrow"));
  assert.deepEqual(perLevel.map((a) => a.length), [1, 2, 1]);
  for (let i = 0; i < perLevel.length; i++) {
    const arrows = perLevel[i]!;
    const marks = marksByLevel[i]!;
    for (const arrow of arrows) {
      assert.deepEqual(arrow.at, { x: arrow.lines![0]!.x1, y: arrow.lines![0]!.y1 });
    }
  }
  for (let i = 0; i < 2; i++) {
    const departing = perLevel[i]!.find((m) => m.class === "cut")!;
    const risers = marksByLevel[i]!
      .filter((m) => m.role === "run-tread" && m.ref === departing.ref)
      .flatMap((m) => m.lines ?? []);
    assert.ok(
      risers.some((g) =>
        Math.hypot((g.x1 + g.x2) / 2 - departing.at!.x, (g.y1 + g.y2) / 2 - departing.at!.y) < 1e-6,
      ),
      "a departing arrow's circle sits on the first riser line",
    );
  }
  const top = perLevel[2]![0]!.lines!;
  assert.equal(top.length, 5, "the arrow enters the landing, crosses it, and returns to the upper flight");
  for (let i = 0; i < top.length - 1; i++) {
    assert.deepEqual(top[i]!.x2, top[i + 1]!.x1);
    assert.deepEqual(top[i]!.y2, top[i + 1]!.y1);
  }
  assert.deepEqual({ x: top[1]!.x2, y: top[1]!.y2 }, { x: 750, y: 4250 });
  assert.deepEqual({ x: top[2]!.x2, y: top[2]!.y2 }, { x: 2250, y: 4250 });
  assert.deepEqual({ x: top[4]!.x2, y: top[4]!.y2 }, { x: 2250, y: 1100 });

  const topTreads = marksByLevel[2]!
    .filter((m) => m.role === "run-tread" && m.ref === "/L2/st")
    .flatMap((m) => m.lines ?? []);
  assert.ok(
    topTreads
      .filter((g) => (g.x1 + g.x2) / 2 < 1500)
      .every((g) => (g.y1 + g.y2) / 2 >= 2913),
    "the top floor omits every tread below the preceding floor's cut",
  );
  assert.ok(topTreads.some((g) => g.x1 === 1500 && g.x2 === 3000 && g.y1 === 1100 && g.y2 === 1100));
  assert.equal(marksByLevel[2]!.filter((m) => m.role === "run-break").length, 1);
});

// ---- 3. 物を持たない関係は線として出る ----

test("marks: a relation with no matter is drawn as a line, not dropped", () => {
  const form = derive(
    parse(`koyu 1.1
grid X 0 4000
grid Y 0 5000 9000
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b type:open
`),
  );
  const open = planMarks(form, "L1").filter((m) => m.role === "open");
  assert.equal(open.length, 1, "reading `lines` before `polygon` turns every wall into one of these");
  assert.ok((open[0]!.lines?.length ?? 0) >= 1);
});

// ---- 4. 黒い面の母集団は Form の切られた区間そのもの ----

test("marks: the black population is exactly the Form's cut intervals", () => {
  const form = derive(parse(SRC));
  const marks = planMarks(form, "L1");
  const air = new Set(form.boundaries.filter((b) => b.air).map((b) => b.ref));
  const plan = form.plans.find((p) => p.level === "L1")!;

  const got = bag(
    marks.filter((m) => m.role === "wall" || m.role === "column").map((m) => ringKey(m.polygon!)),
  );
  const want = bag(
    plan.entities
      .filter(
        (e) =>
          e.polygon !== undefined &&
          ((e.of === "boundary" && e.class === "cut" && !air.has(e.ref)) || e.of === "column"),
      )
      .map((e) => ringKey(e.polygon!)),
  );
  assert.ok(want.size > 0, "the fixture has cut intervals to compare against");
  assert.deepEqual([...got].sort(), [...want].sort(), "a black mark does not come from the Form");
});

// ---- 5. 平面エンティティが一つも説明されずに残らない ----

test("marks: every plan entity is accounted for", () => {
  const model = parseFile(join(root, "examples/house/main.muro"));
  const form = derive(model);
  const doors = new Set(form.openings.filter((o) => o.kind === "door").map((o) => o.ref));
  const air = new Set(form.boundaries.filter((b) => b.air).map((b) => b.ref));

  for (const plan of form.plans) {
    const marks = planMarks(form, plan.level);
    const seen = new Set(marks.map((m) => `${m.of} ${m.ref}`));
    const orphans: string[] = [];
    for (const e of plan.entities) {
      if (seen.has(`${e.of} ${e.ref}`)) continue;
      // 出さないと決めてあるもの — 決めた理由がここに残っていること自体が要件である
      const dropped =
        // 垂れ壁・腰壁は切断面に無い。壁の面として出るのは cut だけ
        (e.of === "boundary" && e.polygon !== undefined && e.class !== "cut" && !air.has(e.ref)) ||
        // 扉の芯線は葉と軌跡で描くので、窓としては出さない
        (e.of === "opening" && e.class !== "swing" && doors.has(e.ref));
      if (!dropped) {
        orphans.push(`${plan.level} ${e.of}/${e.class}${e.role ? `/${e.role}` : ""} ${e.ref}`);
      }
    }
    assert.deepEqual(orphans, [], "a plan entity produced no mark and is not on the drop list");
  }
});

// ---- 6. written は宣言を指す ----

test("marks: written points back at the declaration", () => {
  const model = parseFile(join(root, "examples/house/main.muro"));
  const form = derive(model);
  const order = canonicalBoundaryOrder(model);
  let checked = 0;
  for (const plan of form.plans) {
    for (const m of planMarks(form, plan.level)) {
      if (!m.written) continue;
      const b = order[m.written.boundary];
      assert.ok(b !== undefined, `written.boundary indexes canonical order: ${m.role} ${m.ref}`);
      if (m.of === "seg") {
        assert.ok(b!.segs[m.written.index!] !== undefined, "a seg's index finds its declaration");
      }
      if (m.of === "opening") {
        assert.ok(
          b!.openings[m.written.index!] !== undefined,
          "an opening's index finds its declaration",
        );
      }
      checked += 1;
    }
  }
  assert.ok(checked > 0, "the example has marks that point back at a declaration");
});

// ---- 7. 数はひとつだけで、それは差し替えられる ----

test("marks: the sliding leaf clears the wall face by SLIDE_GAP, and the gap is overridable", () => {
  const form = derive(
    parse(`koyu 1.1
grid X 0 4000
grid Y 0 5000 9000
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b
  door w:900 style:sliding
`),
  );
  const panel = (ms: Mark[]) => ms.find((m) => m.role === "slide-panel")!.lines![0]!;
  const a = panel(planMarks(form, "L1"));
  const movedMarks = planMarks(form, "L1", { slideGap: 0 });
  const b = panel(movedMarks);
  const moved = Math.hypot(a.x1 - b.x1, a.y1 - b.y1);
  assert.ok(
    Math.abs(moved - SLIDE_GAP) < 1e-9,
    `the clear gap is the whole of the difference (${moved})`,
  );
  const wallCentre = form.openings[0]!.swing!.hinge;
  const offset = Math.hypot(b.x1 - wallCentre.x, b.y1 - wallCentre.y);
  assert.ok(
    Math.abs(offset - form.openings[0]!.t / 2) < 1e-9,
    "with no clear gap, the leaf sits on the wall face",
  );
  const guide = movedMarks.find((m) => m.role === "slide-tail")!.lines!;
  assert.equal(guide.length, 1, "one dashed guide shows the direction of travel");
  assert.deepEqual(
    [guide[0]!.x2, guide[0]!.y2],
    [b.x1, b.y1],
    "the travel guide joins the leaf at its pocket-side end",
  );
  assert.ok(
    Math.abs(Math.hypot(guide[0]!.x2 - guide[0]!.x1, guide[0]!.y2 - guide[0]!.y1) - 900) < 1e-9,
    "the travel guide is one leaf width long",
  );
  const centre = movedMarks.find((m) => m.role === "slide-centre")!.lines![0]!;
  const centreLength = Math.hypot(centre.x2 - centre.x1, centre.y2 - centre.y1);
  assert.ok(Math.abs(centreLength - form.openings[0]!.t) < 1e-9, "the centre tick is one wall thickness long");
  const panelVector = { x: b.x2 - b.x1, y: b.y2 - b.y1 };
  const centreVector = { x: centre.x2 - centre.x1, y: centre.y2 - centre.y1 };
  assert.ok(
    Math.abs(panelVector.x * centreVector.x + panelVector.y * centreVector.y) < 1e-9,
    "the centre tick is perpendicular to the leaf",
  );
});
