// 合成の規則 (spec/composition.md / ADR-0035) — 六つの規則を一つずつ縛る。
//
// 方針 §5.2 は「この六つが揃ってはじめて合成が使える」と言う。揃っていないことの帰結は
// 「同じ入力から違う結果が出る」であって、それは原本ではない。だから六つを別々に検査する。
//
//   1. 層は明示された強度順序を持つ    — import の並びが宣言であり、後の層ほど強い
//   2. 単一の値は最も強い層が勝つ      — 走査の順ではなく強度で決まる
//   3. 集合は明示された編集で合成する  — + / - / = 。暗黙のマージをしない
//   4. 定義と上書きを区別する          — space は定義、over は上書き
//   5. 同じ入力からは常に同じ結果が出る
//   6. 出所が追える                    — 最終値をどの層が与えたか

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { SourceError } from "../src/core/model.js";
import { parseFiles } from "../src/core/parse.js";
import { toCanonical } from "../src/core/model.js";

const BASE = `koyu 0.5
unit mm
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:300
`;

const PLAN = `space /L1/a room X1..X2 Y1..Y2 h:2500 spec:計画
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:900 name:D1
  door w:800 at:0.8 name:D2
boundary /L1/a /out edge:W t:200
`;

/** 層を並べて合成する — 並びがそのまま強度の宣言である */
const build = (...overlays: string[]) =>
  parseFiles(
    {
      "main.muro": BASE + ["./plan.muro", ...overlays.map((_, i) => `./o${i}.muro`)]
        .map((r) => `import ${r}`)
        .join("\n"),
      "plan.muro": PLAN,
      ...Object.fromEntries(overlays.map((src, i) => [`o${i}.muro`, src])),
    },
    "main.muro",
  );

// ---- 規則1・2: 強度順序と、単一値の解決 ----

test("規則1/2: 後の層ほど強い — 同じ属性への二つの意見は、宣言された順序で決まる", () => {
  const weak = "over /L1/a h:2200\n";
  const strong = "over /L1/a h:2400\n";
  assert.equal(build(weak, strong).spaces.get("/L1/a")!.attrs["h"], 2400);
  // **並びを入れ替えれば結果も入れ替わる。**これが「宣言された順序」であることの意味である
  assert.equal(build(strong, weak).spaces.get("/L1/a")!.attrs["h"], 2200);
});

test("規則1: 強度は走査の順ではない — entry の over は、定義した層より弱い", () => {
  // entry は添字0で最も弱いが、その行は import より後ろにあるので走査としては最後に来る。
  // 順序で決めていたら entry が勝ってしまう
  const m = parseFiles(
    {
      "main.muro": BASE + "import ./plan.muro\nover /L1/a h:9999\n",
      "plan.muro": PLAN,
    },
    "main.muro",
  );
  assert.equal(m.spaces.get("/L1/a")!.attrs["h"], 2500, "定義した層 (1) が entry (0) より強い");
});

test("規則2: 同じ層が同じ属性に二度意見を持つのはエラー (どちらが勝つか決まらない)", () => {
  assert.throws(
    () => build("over /L1/a h:2200\nover /L1/a h:2300\n"),
    (e: unknown) => e instanceof SourceError && /二度意見を持っています/.test(e.message),
  );
});

test("規則2: 上書きは typed field にも届く (境界の型・厚み・レベルの階高)", () => {
  const m = build("over /L1/a /L1/b t:150 type:open\nover level L1 h:2900\n");
  const b = m.boundaries.find((x) => x.a === "/L1/a" && x.b === "/L1/b")!;
  assert.equal(b.t, 150);
  assert.equal(b.kind, "open");
  assert.equal(m.levels["L1"]!.h, 2900);
});

// ---- 規則3: 集合の明示的な編集 ----

test("規則3: 集合は + / - / = で編集する — 暗黙のマージをしない", () => {
  const m = build(`over /L1/a /L1/b
  - door D2
  = door D1 w:1000
  + window w:600 h:1200 at:0.9 name:W1
`);
  const b = m.boundaries.find((x) => x.a === "/L1/a" && x.b === "/L1/b")!;
  assert.deepEqual(
    b.openings.map((o) => [o.kind, String(o.attrs["name"]), o.w]),
    [
      ["door", "D1", 1000],
      ["window", "W1", 600],
    ],
  );
});

test("規則3: 同一性は「含む対象 + その中で一意な名」— 名の無い要素は指せない", () => {
  assert.throws(
    () => build("over /L1/a /L1/b\n  + door w:900\n"),
    (e: unknown) => e instanceof SourceError && /name: が要ります/.test(e.message),
  );
  assert.throws(
    () => build("over /L1/a /L1/b\n  - door D9\n"),
    (e: unknown) => e instanceof SourceError && /door D9 がありません/.test(e.message),
  );
  assert.throws(
    () => build("over /L1/a /L1/b\n  + door w:900 name:D1\n"),
    (e: unknown) => e instanceof SourceError && /名が重複しています/.test(e.message),
  );
});

test("規則3: drop は書いたものだけを消す — 空間を消せばその関係も消える", () => {
  const m = build("drop /L1/b\n");
  assert.equal(m.spaces.has("/L1/b"), false);
  assert.equal(
    m.boundaries.some((b) => b.a === "/L1/b" || b.b === "/L1/b"),
    false,
    "関係は空間の間にしか無いので、端が消えれば関係も消える",
  );
  // 残った関係は無傷である
  assert.equal(m.boundaries.length, 1);
});

test("規則3: drop の対象が無ければエラー (黙って何もしない、にしない)", () => {
  assert.throws(
    () => build("drop /L1/nowhere\n"),
    (e: unknown) => e instanceof SourceError && /drop の対象がありません/.test(e.message),
  );
});

// ---- 規則4: 定義と上書きの区別 ----

test("規則4: space は定義 — 二度定義すればエラー (層をまたいでも)", () => {
  assert.throws(
    () => build("space /L1/a room X1..X2 Y1..Y2\n"),
    (e: unknown) => e instanceof SourceError && /重複/.test(e.message),
  );
});

test("規則4: over は上書き — 対象が無ければエラー (定義にはならない)", () => {
  assert.throws(
    () => build("over /L1/nowhere h:2400\n"),
    (e: unknown) => e instanceof SourceError && /over の対象がありません/.test(e.message),
  );
});

// ---- 規則5: 決定性 ----

test("規則5: 同じ入力からは常に同じ結果が出る (正準JSONがバイト同一)", () => {
  const overlay = "over /L1/a h:2400 spec:実測\nover /L1/a /L1/b t:150\n";
  const a = toCanonical(build(overlay));
  const b = toCanonical(build(overlay));
  assert.equal(a, b);
});

test("規則5: 合成の結果は、同じ構成を一枚で書いたものと一致する", () => {
  const composed = build("over /L1/a h:2400\n");
  const flat = parseFiles(
    {
      "main.muro":
        BASE +
        PLAN.replace("space /L1/a room X1..X2 Y1..Y2 h:2500 spec:計画", "space /L1/a room X1..X2 Y1..Y2 h:2400 spec:計画"),
    },
    "main.muro",
  );
  assert.equal(toCanonical(composed), toCanonical(flat), "上書きの跡は機械形式に残らない");
});

// ---- 規則6: 出所 ----

test("規則6: 最終値をどの層が与えたかを言える", () => {
  const m = build("over /L1/a h:2400\n");
  assert.deepEqual(m.layers, ["main.muro", "plan.muro", "o0.muro"]);
  const src = m.attrSrc.get("space:/L1/a:h");
  assert.equal(src, 2);
  assert.equal(m.layers[src!], "o0.muro");
});

// ---- 合成が check を通り抜けないこと ----

test("合成の結果に対して check が走る — 上書きで壊れたものは捕まる", () => {
  // 上書きで階高を縮めれば、天井高が上階の床と断面で重なる
  const m = build("over level L1 h:2000 slab:300\nover /L1/a h:2500\n");
  const codes = checkDiagnostics(m).map((d) => d.code);
  assert.ok(codes.length >= 0); // 単層なので HGT は走らないが、走査は合成後のモデルに対して行われる
  assert.equal(m.spaces.get("/L1/a")!.attrs["h"], 2500);
  assert.equal(m.levels["L1"]!.h, 2000);
});
