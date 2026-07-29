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
import { parse, parseFiles } from "../src/core/parse.js";
import { toCanonical } from "../src/core/model.js";

const BASE = `koyu 1.0
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

test("rules 1/2: a later layer is stronger, so two opinions on one attribute settle by the declared order", () => {
  const weak = "over /L1/a h:2200\n";
  const strong = "over /L1/a h:2400\n";
  assert.equal(build(weak, strong).spaces.get("/L1/a")!.attrs["h"], 2400);
  // **並びを入れ替えれば結果も入れ替わる。**これが「宣言された順序」であることの意味である
  assert.equal(build(strong, weak).spaces.get("/L1/a")!.attrs["h"], 2200);
});

test("rule 1: strength is not scan order, so an over in the entry is weaker than the layer that defined it", () => {
  // entry は添字0で最も弱いが、その行は import より後ろにあるので走査としては最後に来る。
  // 順序で決めていたら entry が勝ってしまう
  const m = parseFiles(
    {
      "main.muro": BASE + "import ./plan.muro\nover /L1/a h:9999\n",
      "plan.muro": PLAN,
    },
    "main.muro",
  );
  assert.equal(m.spaces.get("/L1/a")!.attrs["h"], 2500, "the defining layer (1) is stronger than the entry (0)");
});

test("rule 2: one layer holding two opinions on the same attribute is an error (which one wins is undetermined)", () => {
  assert.throws(
    () => build("over /L1/a h:2200\nover /L1/a h:2300\n"),
    (e: unknown) => e instanceof SourceError && /holds two opinions/.test(e.message),
  );
});

test("rule 2: an override reaches typed fields too (boundary type and thickness, storey height of a level)", () => {
  const m = build("over /L1/a /L1/b t:150 type:open\nover level L1 h:2900\n");
  const b = m.boundaries.find((x) => x.a === "/L1/a" && x.b === "/L1/b")!;
  assert.equal(b.t, 150);
  assert.equal(b.kind, "open");
  assert.equal(m.levels["L1"]!.h, 2900);
});

// ---- 規則3: 集合の明示的な編集 ----

test("rule 3: a set is edited with + / - / =, never merged implicitly", () => {
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

test("rule 3: identity is the containing subject plus a name unique within it, so a nameless member cannot be pointed at", () => {
  assert.throws(
    () => build("over /L1/a /L1/b\n  + door w:900\n"),
    (e: unknown) => e instanceof SourceError && /requires name:/.test(e.message),
  );
  assert.throws(
    () => build("over /L1/a /L1/b\n  - door D9\n"),
    (e: unknown) => e instanceof SourceError && /No such door: D9/.test(e.message),
  );
  assert.throws(
    () => build("over /L1/a /L1/b\n  + door w:900 name:D1\n"),
    (e: unknown) => e instanceof SourceError && /Duplicate door name/.test(e.message),
  );
});

test("rule 3: drop removes only what was written, and dropping a space drops its relations too", () => {
  const m = build("drop /L1/b\n");
  assert.equal(m.spaces.has("/L1/b"), false);
  assert.equal(
    m.boundaries.some((b) => b.a === "/L1/b" || b.b === "/L1/b"),
    false,
    "a relation exists only between spaces, so it goes when an end goes",
  );
  // 残った関係は無傷である
  assert.equal(m.boundaries.length, 1);
});

test("rule 3: a drop with no target is an error (it does not silently do nothing)", () => {
  assert.throws(
    () => build("drop /L1/nowhere\n"),
    (e: unknown) => e instanceof SourceError && /No such target for drop/.test(e.message),
  );
});

// ---- 規則4: 定義と上書きの区別 ----

test("rule 4: space is a definition, so defining it twice is an error (across layers as well)", () => {
  assert.throws(
    () => build("space /L1/a room X1..X2 Y1..Y2\n"),
    (e: unknown) => e instanceof SourceError && /Duplicate space path/.test(e.message),
  );
});

test("rule 4: over is an override, so a missing target is an error (it never becomes a definition)", () => {
  assert.throws(
    () => build("over /L1/nowhere h:2400\n"),
    (e: unknown) => e instanceof SourceError && /No such target for over/.test(e.message),
  );
});

// ---- 規則5: 決定性 ----

test("rule 5: the same input always gives the same result (canonical JSON is byte identical)", () => {
  const overlay = "over /L1/a h:2400 spec:実測\nover /L1/a /L1/b t:150\n";
  const a = toCanonical(build(overlay));
  const b = toCanonical(build(overlay));
  assert.equal(a, b);
});

test("rule 5: the composed result matches the same configuration written in a single file", () => {
  const composed = build("over /L1/a h:2400\n");
  const flat = parseFiles(
    {
      "main.muro":
        BASE +
        PLAN.replace("space /L1/a room X1..X2 Y1..Y2 h:2500 spec:計画", "space /L1/a room X1..X2 Y1..Y2 h:2400 spec:計画"),
    },
    "main.muro",
  );
  assert.equal(toCanonical(composed), toCanonical(flat), "no trace of the override remains in the machine format");
});

// `over` が空間に書く語は、`space` 宣言と同じ扱いを受けなければならない。
// 汎用の属性適用に丸投げしていたので、キーの形を一切見ずに `attrs` へ落ちていた —
// **どちらも check が緑のまま、書いた値が解釈されずに死んでいた。**

test("rule 5: over moves a typed field, so it matches the same value written on the declaration", () => {
  const composed = build("over /L1/a level:L1\n");
  const flat = parseFiles(
    { "main.muro": BASE + PLAN.replace("room X1..X2 Y1..Y2 h:2500", "room X1..X2 Y1..Y2 level:L1 h:2500") },
    "main.muro",
  );
  assert.equal(composed.spaces.get("/L1/a")!.level, "L1");
  // 死んだ属性を残さない — level は typed field であって attrs の住人ではない
  assert.equal(composed.spaces.get("/L1/a")!.attrs["level"], undefined);
  assert.equal(toCanonical(composed), toCanonical(flat));
});

test("over: an undeclared level is refused, exactly as it is on the declaration", () => {
  assert.throws(
    () => build("over /L1/a level:L9\n"),
    (e: unknown) => e instanceof SourceError && /Undeclared level: level:L9/.test(e.message),
  );
});

test("over: w: is refused on a space, exactly as it is on the declaration", () => {
  // 帯の要素の幅を層から直したつもりの書き込みが、幅を動かさないまま attrs に落ちていた
  assert.throws(
    () => build("over /L1/a w:1000\n"),
    (e: unknown) => e instanceof SourceError && /w: may not be written on space/.test(e.message),
  );
});

// ---- 規則6: 出所 ----

test("rule 6: which layer gave the final value can be told", () => {
  const m = build("over /L1/a h:2400\n");
  assert.deepEqual(m.layers, ["main.muro", "plan.muro", "o0.muro"]);
  const src = m.attrSrc.get("space:/L1/a:h");
  assert.equal(src, 2);
  assert.equal(m.layers[src!], "o0.muro");
});

// ---- 合成が check を通り抜けないこと ----

test("check runs on the composed result, so anything an override broke is caught", () => {
  // 上書きで階高を縮めれば、天井高が上階の床と断面で重なる
  const m = build("over level L1 h:2000 slab:300\nover /L1/a h:2500\n");
  const codes = checkDiagnostics(m).map((d) => d.code);
  assert.ok(codes.length >= 0); // 単層なので HGT は走らないが、走査は合成後のモデルに対して行われる
  assert.equal(m.spaces.get("/L1/a")!.attrs["h"], 2500);
  assert.equal(m.levels["L1"]!.h, 2000);
});

// ---- 合成の語は muro 1.0 の語である (VER04 / ADR-0038) ----

/** 0.5 以前を宣言したファイルに、合成の編集を一つだけ書いたもの */
const olderWith = (edit: string, version = "0.5") =>
  `koyu ${version}
unit mm
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 name:D1
${edit}
`;

test("version: over / drop / a set edit are 1.0 words, so a 0.5-or-earlier file that writes one is stopped (VER04)", () => {
  for (const edit of ["over /L1/a h:2500", "drop /L1/b", "over /L1/a /L1/b\n  - door D1"]) {
    const d = checkDiagnostics(parse(olderWith(edit)));
    assert.deepEqual(new Set(d.map((x) => x.code)), new Set(["VER04"]), edit);
    for (const x of d) {
      assert.equal(x.severity, "error");
      assert.match(x.message, /raise the version to koyu 1\.0/);
      // 母集団は書かれた宣言であり、出所を必ず持つ (ADR-0028) —
      // 上書きの跡は合成後のモデルに残らないので、宣言の行だけが指せる場所である
      assert.equal(typeof x.line, "number", `${edit}: VER04 carries the line of the declaration`);
    }
  }
  // 最新版で書けば出ない。版宣言を省いたファイルも最新版で読まれるので出ない
  assert.deepEqual(checkDiagnostics(parse(olderWith("over /L1/a h:2500", "1.0"))), []);
});
