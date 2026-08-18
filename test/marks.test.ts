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
import { planMarks, SLIDE_POCKET, type Mark } from "../src/draw/marks.js";
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

test("marks: SLIDE_POCKET is the only number, and it is overridable", () => {
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
  const b = panel(planMarks(form, "L1", { slidePocket: 0 }));
  const moved = Math.hypot(a.x1 - b.x1, a.y1 - b.y1);
  assert.ok(
    Math.abs(moved - SLIDE_POCKET) < 1e-9,
    `the pocket setback is the whole of the difference (${moved})`,
  );
});
