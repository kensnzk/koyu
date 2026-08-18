// 3Dのシーン記述 — 「Form の実体そのものであること」と「紙の都合の数を持ち込まないこと」を
// 機械で確かめる。
//
// 一番効くのは「壁の実体は芯線を太らせたものではない」試験である。継手は実体を自分の芯線から
// ずらすので、四辺形から芯線を割り戻した瞬間に手すりは角で自分の脇に立つ。平面側は
// draw.test.ts が既に押さえていて、これはその立体側の写しである。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { formBodies } from "../src/core/bodies.js";
import { derive, thicken } from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { sceneOf, type SceneNode } from "../src/draw/scene.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC_SCENE = readFileSync(join(root, "src/draw/scene.ts"), "utf8");

const EXAMPLES = [
  "examples/house/main.muro",
  "examples/complex/main.muro",
  "examples/twin/main.muro",
  "examples/tower/main.muro",
];

const ringKey = (pts: Array<{ x: number; y: number }>): string =>
  pts.map((p) => `${Math.round(p.x * 1e6) / 1e6},${Math.round(p.y * 1e6) / 1e6}`).join(" ");

/** コメントを落とした本体 — 説明は日本語でよい。禁じているのは**出力に混ざる**語である */
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

test("scene: the base holds no word", () => {
  const body = codeOf(SRC_SCENE);
  const foreign = [...body].filter((c) => (c.codePointAt(0) ?? 0) > 127);
  assert.deepEqual(foreign, [], "a non-ASCII character in the code is a word in someone's language");
  assert.ok(!body.includes("Math.round"), "rounding is part of the wording");
  assert.ok(!body.includes("toFixed"), "formatting is wording");
});

// ---- 2. 実体のノードは Form の実体そのもの ----

test("scene: every body node is a body of the Form, and nothing else is", () => {
  for (const f of EXAMPLES) {
    const form = derive(parseFile(join(root, f)));
    const scene = sceneOf(form);
    const got = scene.nodes
      .filter((n) => n.role === "body" || n.role === "volume")
      .map((n) => `${n.of} ${n.ref} ${ringKey(n.solid!.ring)}`)
      .sort();
    const want = formBodies(form).map((b) => `${b.of} ${b.ref} ${ringKey(b.poly)}`).sort();
    assert.deepEqual(got, want, `${f}: a body node is not a body of the Form`);
  }
});

// ---- 3. 壁の実体は芯線を太らせたものではない ----

test("scene: a wall body is its footprint, not its centreline thickened", () => {
  let joined = 0;
  for (const f of EXAMPLES) {
    const form = derive(parseFile(join(root, f)));
    for (const n of sceneOf(form).nodes) {
      if (n.of !== "boundary" || n.role !== "body" || !n.centre || n.t === undefined) continue;
      const naive = thicken(n.centre.x1, n.centre.y1, n.centre.x2, n.centre.y2, n.t);
      if (ringKey(naive) !== ringKey(n.solid!.ring)) joined += 1;
      // 継手がどれだけ端を動かしても、実体は自分の芯線の半厚のうちに収まる
      const half = n.t / 2 + 1e-6;
      const dx = n.centre.x2 - n.centre.x1;
      const dy = n.centre.y2 - n.centre.y1;
      const len = Math.hypot(dx, dy) || 1;
      for (const p of n.solid!.ring) {
        const off = Math.abs((p.x - n.centre.x1) * (-dy / len) + (p.y - n.centre.y1) * (dx / len));
        assert.ok(off <= half, `a ring vertex stands ${off} off its own axis (half thickness ${half})`);
      }
    }
  }
  assert.ok(joined > 0, "the bundled buildings contain bodies a junction moved off the naive quad");
});

// ---- 4. z を発明しない ----

test("scene: no z is invented", () => {
  for (const f of EXAMPLES) {
    const form = derive(parseFile(join(root, f)));
    const openings = new Map(form.openings.map((o) => [o.ref, o]));
    const columns = new Map(form.columns.map((c) => [c.ref, c]));
    for (const n of sceneOf(form).nodes) {
      if (n.role !== "body" || !n.solid) continue;
      if (n.of === "opening") {
        const o = openings.get(n.ref)!;
        assert.equal(n.solid.bottom[0], o.z0, "an opening's underside is the Form's");
        assert.equal(n.solid.top[0], o.z1, "an opening's top is the Form's");
      }
      if (n.of === "column") {
        const c = columns.get(n.ref)!;
        assert.equal(n.solid.bottom[0], c.z0);
        assert.equal(n.solid.top[0], c.z1);
      }
    }
  }
});

// ---- 5. level は数についての事実である ----

test("scene: `level` is a fact about the numbers, and the arrays agree", () => {
  for (const f of EXAMPLES) {
    const form = derive(parseFile(join(root, f)));
    for (const n of sceneOf(form).nodes) {
      const s = n.solid;
      if (!s) continue;
      assert.equal(s.bottom.length, s.ring.length, "one underside per vertex");
      assert.equal(s.top.length, s.ring.length, "one top per vertex");
      assert.equal(
        s.level,
        new Set(s.bottom).size <= 1 && new Set(s.top).size <= 1,
        `${n.of} ${n.ref}: level does not describe the numbers`,
      );
    }
  }
});

// ---- 6. 地盤は「0以上で最も低い階」であって levels[0] ではない ----

test("scene: the ground is the lowest level at or above zero", () => {
  const scene = sceneOf(
    derive(
      parse(`koyu 1.1
grid X 0 4000
grid Y 0 5000
level B1 -3000 h:2700 slab:300
level L1 0 h:2700 slab:300
space /B1/a room X1..X2 Y1..Y2
space /L1/a room X1..X2 Y1..Y2
`),
    ),
  );
  assert.equal(scene.levels[0]!.name, "B1", "the lowest level is still the basement");
  assert.equal(scene.ground, "L1", "the ground is where the building meets the earth, not the bottom");
});

// ---- 7. 大きなモデルでも外接を畳む ----

test("scene: a large model still folds its extent", () => {
  const lines = ["koyu 1.1", "grid X " + Array.from({ length: 160 }, (_, i) => i * 4000).join(" ")];
  lines.push("grid Y " + Array.from({ length: 160 }, (_, i) => i * 4000).join(" "));
  lines.push("level L1 0 h:2700 slab:300", "column 600 L1", "space /L1/a room X1..X160 Y1..Y160");
  const scene = sceneOf(derive(parse(lines.join("\n") + "\n")));
  assert.ok(scene.nodes.length > 10000, `the stress model produces many nodes (${scene.nodes.length})`);
  const mark = scene.nodes.find((n: SceneNode) => n.role === "mark");
  assert.ok(mark, "a level still gets a seat");
  for (const v of Object.values(mark!.mark!.extent)) assert.ok(Number.isFinite(v), "the extent is finite");
});
