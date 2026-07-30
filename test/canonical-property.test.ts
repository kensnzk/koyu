// 正準性のproperty test (ADR-0013 / ADR-0014 / ADR-0029 / ADR-0036)。
//
// 正準形が答えるのは二つの問いで、両方を機械で守る。
//   1. **同じ構成なら同じバイト** — 宣言の並べ替えでバイトが変わらない
//   2. **違う構成なら違うバイト** (単射性) — 意味のある一箇所の変更で必ずバイトが変わる
//
// 母集団は**記法の全構文**である。柱・描かれた線・area・seg・アセット・polygon・帯・
// レベル範囲・メゾネット・地下・名前空間つき属性を、生成器が毎回書く (COVERAGE が空でないことを縛る) —
// 狭い母集団の緑は、触っていない構文について何も言わない。乱数は種つきLCG (再現可能)。

import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * 並べ替えの単位。親行と、それに従属する字下げ行をひとまとめに運ぶ。
 *
 * `ordered` は**宣言順が意味である**ブロック (柱 — ADR-0029)。並べ替えの対象から外し、
 * 相対順を保つ。`orderedChildren` は**子行の順が意味である**ブロック (帯 — 並びが位置を決める)。
 */
interface Block {
  lines: string[];
  ordered?: boolean;
  orderedChildren?: boolean;
}

const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

/** 生成した原本が必ず含む構文 — 正準JSONに現れる形で書く (母集団が狭まったらここで落ちる) */
const COVERAGE: Array<[string, RegExp]> = [
  ["level range", /"L4": \{/],
  ["underground", /"underground": 1/],
  ["asset", /"assets": \{/],
  ["polygon", /"polygons": \{/],
  ["column", /"columns": \[/],
  ["column grid names", /"x": \[/],
  ["zone", /"zones": \{/],
  ["maisonette (explicit level)", /"level": "L2"/],
  ["area", /"areas": \[/],
  ["opening", /"openings": \[/],
  ["seg", /"segs": \[/],
  ["drawn line", /"line": \[/],
  ["namespaced carrier attribute", /"acme\.sensor"/],
  ["band (expanded into spaces)", /"\/L2\/A\/wet"/],
];

/**
 * 記法の全構文を書く原本を生成する。返り値は並べ替え可能なブロックの列で、
 * 先頭 HEADER_BLOCKS 個 (基盤の宣言とアセット) は常に先頭に留まる —
 * grid と level は使用より前に、アセットは参照より前になければならない。
 */
function generate(rnd: () => number): { header: Block[]; body: Block[] } {
  const header: Block[] = [
    { lines: ["koyu 1.0"] },
    { lines: ["name 生成された模型"] },
    { lines: ["unit mm"] },
    { lines: ["grid X 0 3000 6000 9000 12000"] },
    { lines: ["grid Y 0 3000 6000 9000"] },
    { lines: ["level B1 -3200 h:2700 slab:200 underground:1"] },
    { lines: [`level L1 0 h:${pick(rnd, [2400, 2700, 3000])} slab:150`] },
    { lines: ["level L2..L4 3000 pitch:3000 h:2500 slab:150"] },
    { lines: [`asset SD1 door w:800 style:${pick(rnd, ["sliding", "hinged"])} name:片引き戸`] },
    { lines: [`asset W1 window w:1200 h:${pick(rnd, [1100, 1200, 1500])} name:腰窓`] },
  ];

  // ---- L1: 3×3セルから部屋を選ぶ (最小構成は常に含み、境界の対を保証する) ----
  const cells: Array<[number, number]> = [
    [1, 1],
    [2, 1],
    [1, 2],
  ];
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) {
      if (!cells.some(([a, b]) => a === i && b === j) && rnd() < 0.5) cells.push([i, j]);
    }
  }
  const path = ([i, j]: [number, number]) => `/L1/r${i}${j}`;
  const body: Block[] = [];
  for (const c of cells) {
    const [i, j] = c;
    const lines = [
      `space ${path(c)} ${pick(rnd, ["room", "office", "厨房"])} X${i}..X${i + 1} Y${j}..Y${j + 1}` +
        `${rnd() < 0.4 ? ` uid:sp-${i}${j}` : ""}${rnd() < 0.4 ? ` acme.sensor:2${i}` : ""} name:室${i}${j}`,
    ];
    // area (数えない分節) — 親の領域の内側に置く (描かれた線が割付を動かすので400mm控える)
    if (rnd() < 0.5) {
      lines.push(`  area X${i}+400..X${i + 1}-400 Y${j}+400..Y${j}+1500 name:土間 floor:タイル`);
    }
    if (rnd() < 0.3) lines.push(`  area X${i}+400..X${i}+1200 Y${j}+1800..Y${j + 1}-400 name:床の間`);
    body.push({ lines });
  }
  // 外部・地下・メゾネット (パス先頭と所属レベルが違う空間)
  body.push({ lines: ["space /out exterior name:外部 road:12000"] });
  body.push({ lines: ["space /B1/park 駐車場 X1..X2 Y1..Y2 name:駐車場 acme.sensor:21"] });
  body.push({
    lines: [`space /L1/loft ${pick(rnd, ["room", "atelier"])} X4..X5 Y1..Y2 level:L2 name:ロフト`],
  });

  // ---- 帯 (band) — 位置ではなく寸法と並びで割る。展開後は通常の空間になる ----
  const w1 = pick(rnd, [2400, 3000, 3600]);
  const w2 = pick(rnd, [1600, 2000, 2400]);
  const closed = rnd() < 0.5;
  body.push({
    orderedChildren: true,
    lines: [
      "band X X1..X4 Y1..Y2",
      `  space /L2/A/wet wet w:${w1} name:水回り`,
      `  space /L2/A/hall hall w:${w2} name:玄関`,
      `  space /L2/A/room room w:${closed ? 9000 - w1 - w2 : "rest"} name:居室`,
    ],
  });

  // ---- 境界: 接する組の一部に宣言する (残りは既定壁 — ADR-0014) ----
  const drawn: Array<{ block: Block; line: string }> = [];
  for (const a of cells) {
    for (const b of cells) {
      const alongX = a[1] === b[1] && b[0] === a[0] + 1;
      const alongY = a[0] === b[0] && b[1] === a[1] + 1;
      if ((!alongX && !alongY) || rnd() < 0.3) continue;
      const attrs = rnd() < 0.6 ? ` t:${100 + Math.floor(rnd() * 3) * 40} spec:W${Math.floor(rnd() * 3)}` : "";
      const lines = [`boundary ${path(a)} ${path(b)}${attrs}${rnd() < 0.2 ? " air:1" : ""}`];
      const openings = Math.floor(rnd() * 3); // 0..2 — 同じ線分上で重ならない位置に置く
      for (let k = 0; k < openings; k++) {
        const kind = rnd() < 0.6 ? "door" : "window";
        const ref = kind === "door" && rnd() < 0.4 ? " SD1" : kind === "window" && rnd() < 0.4 ? " W1" : "";
        const w = ref ? "" : ` w:${700 + k * 100}${kind === "window" ? " h:1200" : ""}`;
        const swing = kind === "door" && rnd() < 0.3 ? ` swing:${pick(rnd, ["a", "b"])}` : "";
        lines.push(`  ${kind}${ref}${w} at:0.${k === 0 ? 25 : 75}${swing} name:${kind[0]}${k}`);
      }
      if (rnd() < 0.4) lines.push(`  seg w:900 at:0.5 spec:ガラス`);
      // 描かれた線 — 共有辺から200mmずらして引く (ADR-0022)。
      // 辺そのものに重ねると「何も切らない線」(LIN01) になり、割付が動かない
      const line = alongX
        ? `  line X${a[0] + 1}+200,Y${a[1]} X${a[0] + 1}+200,Y${a[1] + 1}`
        : `  line X${a[0]},Y${a[1] + 1}+200 X${a[0] + 1},Y${a[1] + 1}+200`;
      const block: Block = { lines };
      if (rnd() < 0.35) lines.push(line);
      drawn.push({ block, line });
      body.push(block);
    }
  }
  // 描かれた線は母集団に必ず一本ある (乱数が一本も引かなかった回の穴を塞ぐ)
  if (!drawn.some(({ block }) => block.lines.some((l) => l.startsWith("  line ")))) {
    drawn[0]!.block.lines.push(drawn[0]!.line);
  }
  // 外部への境界 — 通り参照の明示位置 (at:Y…) を必ず一つ書く
  body.push({
    lines: [
      `boundary /L1/r11 /out edge:S t:200 spec:RC`,
      `  door w:900 at:X1+900 name:玄関`,
      `  window w:1200 h:1400 at:X1+2000 name:地窓`,
      `  seg w:900 at:X1+600 spec:タイル`,
    ],
  });

  // ---- 柱 — **宣言順が意味である** (先勝ち。ADR-0023 / ADR-0029)。一辺で必ず区別できるようにする ----
  const columnCount = 2 + Math.floor(rnd() * 2);
  for (let k = 0; k < columnCount; k++) {
    const size = 600 + k * 50;
    const levels = pick(rnd, ["L1", "L2", "B1..L1", "L1..L4"]);
    const d = rnd() < 0.4 ? ` d:${size + 200}` : "";
    const x = ` x:X${1 + (k % 2)},X${3 - (k % 2)}`;
    const y = rnd() < 0.6 ? ` y:Y2` : "";
    body.push({ ordered: true, lines: [`column ${size} ${levels}${d}${x}${y} spec:SRC`] });
  }

  // ---- 敷地 (所与の幾何) と集約 ----
  const jitter = Math.floor(rnd() * 3) * 100;
  body.push({ lines: [`polygon /site -1000,-1000 13000,-1000 ${13000 + jitter},10000 -1000,10000`] });
  body.push({ lines: ["zone /site name:敷地 site:1"] });
  body.push({ lines: ["space /site/yard yard X4..X5 Y2..Y3 level:L1 name:外構"] });
  body.push({ lines: ["zone /L1 name:一階"] });
  body.push({ lines: [`zone /L2/A name:Aタイプ use:${pick(rnd, ["exclusive", "common"])}`] });
  return { header, body };
}

const render = (bs: Block[]) => bs.flatMap((b) => b.lines).join("\n") + "\n";

/** 順序が意味である位置を保ったまま並べ替える — 動かせるブロックだけを入れ替える */
function reorder(body: Block[], rnd: () => number): Block[] {
  const free = shuffle(
    body.filter((b) => !b.ordered),
    rnd,
  );
  const fixed = body.filter((b) => b.ordered);
  const out: Block[] = [];
  let fi = 0;
  let ri = 0;
  while (fi < fixed.length || ri < free.length) {
    const takeFixed = ri >= free.length || (fi < fixed.length && rnd() < 0.3);
    out.push(takeFixed ? fixed[fi++]! : free[ri++]!);
  }
  return out;
}

/** 逆順にする — ただし順序が意味である柱の相対順と、帯の子行の並びは保つ */
function reverse(body: Block[]): Block[] {
  const flipped = [...body].reverse().map((b) =>
    b.orderedChildren ? b : { ...b, lines: [b.lines[0]!, ...b.lines.slice(1).reverse()] },
  );
  const fixed = body.filter((b) => b.ordered);
  let fi = 0;
  return flipped.map((b) => (b.ordered ? fixed[fi++]! : b));
}

test("property: the population covers the whole notation and every model is consistent", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const model = parse(render([...header, ...body]));
    // 母集団は**成立する建物**である — 壊れた原本の正準形を数えても何も言えない
    const errors = checkDiagnostics(model).filter((d) => d.severity === "error");
    assert.deepEqual(
      errors.map((d) => `${d.code} ${d.message}`),
      [],
      `seed=${seed}: the generated model does not pass check`,
    );
    const json = toCanonical(model);
    for (const [label, re] of COVERAGE) {
      assert.ok(re.test(json), `seed=${seed}: the generated model carries no ${label}`);
    }
  }
});

test("property: reordering declarations does not change the bytes (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const shuffled = render([...header, ...reorder(body, lcg(seed * 7))]);
    const reversed = render([...header, ...reverse(body)]);
    assert.notEqual(shuffled, original, `seed=${seed}: the shuffle changed nothing (the test is idle)`);
    const j0 = toCanonical(parse(original));
    assert.equal(toCanonical(parse(shuffled)), j0, `seed=${seed} shuffle`);
    assert.equal(toCanonical(parse(reversed)), j0, `seed=${seed} reverse`);
  }
});

/**
 * **形は正準形の関数である** — 導出の約束1。
 *
 * 上の性質は、並べ替えても**バイト**が変わらないことだけを見ていた。だが約束はもう一段強い。
 *
 *     toCanonical(a) === toCanonical(b)  ⟹  derive(a) ≡ derive(b)
 *
 * 生成器は毎回、正準形が等しい対 (原本とその並べ替え) を作っている。**その対を形の側でも
 * 突き合わせなければ、約束の後半を一度も試していない。**
 *
 * 手で書いた witness では、破れは実際に見落とされていた — 既定境界の `a`/`b` が空間の宣言順を
 * 拾い、`Form.spaces` と `slabs` の並びが Map の挿入順だった。生成器は空間を毎回並べ替えるので、
 * この性質があればどれも一巡目で落ちていた。
 */
const form = (src: string): string => JSON.stringify(derive(parse(src)));

test("property: what the canonical form calls one building has one shape (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const shuffled = render([...header, ...reorder(body, lcg(seed * 7))]);
    const reversed = render([...header, ...reverse(body)]);
    // 前提を先に確かめる — 正準形が違えば、この対は形について何も言っていない
    const j0 = toCanonical(parse(original));
    assert.equal(toCanonical(parse(shuffled)), j0, `seed=${seed}: the premise fails (shuffle)`);
    assert.equal(toCanonical(parse(reversed)), j0, `seed=${seed}: the premise fails (reverse)`);
    const f0 = form(original);
    assert.equal(form(shuffled), f0, `seed=${seed}: canonically equal but the shape differs (shuffle)`);
    assert.equal(form(reversed), f0, `seed=${seed}: canonically equal but the shape differs (reverse)`);
  }
});

// ---- 単射性: 違う構成なら違うバイト ----

/**
 * 意味のある一箇所の変更。**適用できたら必ずバイトが変わらなければならない。**
 * 「並べ替えても同じ」だけを縛ると、すべてを捨てて `{}` を返す実装も緑になる —
 * 正準形が答える問いの半分は、こちら側にある。
 */
const MUTATIONS: Array<[string, (src: string) => string | undefined]> = [
  ["grid coordinate", (s) => edit(s, /^grid X 0 3000/, (l) => l.replace("3000", "3100"))],
  ["level height", (s) => edit(s, /^level L1 /, (l) => l.replace(/h:\d+/, "h:9999"))],
  ["underground", (s) => edit(s, /^level B1 /, (l) => l.replace(" underground:1", ""))],
  ["level pitch (a range declaration)", (s) => edit(s, /^level L2\.\./, (l) => l.replace("pitch:3000", "pitch:3200"))],
  ["asset default", (s) => edit(s, /^asset SD1 /, (l) => l.replace(/w:\d+/, "w:850"))],
  ["space type", (s) => edit(s, /^space \/L1\/r11 /, (l) => l.replace(/ \S+ X1/, " store X1"))],
  ["space region", (s) => edit(s, /^space \/L1\/r11 /, (l) => l.replace("Y1..Y2", "Y1..Y2+300"))],
  ["space name", (s) => edit(s, /^space \/L1\/r11 /, (l) => `${l}-改`)],
  ["carrier attribute", (s) => edit(s, /^space \/B1\/park /, (l) => l.replace("acme.sensor:21", "acme.sensor:99"))],
  ["explicit level (maisonette)", (s) => edit(s, /^space \/L1\/loft /, (l) => l.replace("level:L2", "level:L3"))],
  ["area", (s) => edit(s, /^ {2}area /, (l) => l.replace("1500", "1800"))],
  // 帯は「部分寸法の合計 = 総寸法」を照合するので、寸法は二要素の間で移す (壊すのではなく変える)
  ["band member width", shiftBandWidth],
  ["band member order", (s) => swapLines(s, /^ {2}space \/L2\/A\/(wet|hall) /)],
  ["boundary thickness", (s) => edit(s, /^boundary \/L1\/r11 \/out /, (l) => l.replace("t:200", "t:210"))],
  ["boundary kind", (s) => edit(s, /^boundary \/L1\/r11 \/out /, (l) => `${l} type:open`)],
  [
    "boundary direction (the a key)",
    (s) => edit(s, /^boundary \/L1\/r11 \/out /, (l) => l.replace("/L1/r11 /out", "/out /L1/r11")),
  ],
  ["opening position", (s) => edit(s, /^ {2}door w:900 at:X1\+900/, (l) => l.replace("X1+900", "X1+1000"))],
  ["opening width", (s) => edit(s, /^ {2}window w:1200 h:1400/, (l) => l.replace("w:1200", "w:1250"))],
  ["opening swing", (s) => edit(s, /^ {2}door w:900 at:X1\+900/, (l) => `${l} swing:b`)],
  ["seg", (s) => edit(s, /^ {2}seg /, (l) => l.replace("w:900", "w:950"))],
  ["drawn line", shiftDrawnLine],
  ["column size", (s) => edit(s, /^column /, (l) => l.replace(/^column \d+/, "column 550"))],
  ["column grid names", (s) => edit(s, /^column .* x:/, (l) => l.replace(/ x:\S+/, " x:X2"))],
  ["column order (declaration order is meaning)", (s) => swapLines(s, /^column /)],
  ["polygon vertex", (s) => edit(s, /^polygon /, (l) => l.replace("-1000,-1000", "-1200,-1000"))],
  ["zone attribute", (s) => edit(s, /^zone \/L2\/A /, (l) => l.replace(/use:\w+/, "use:service"))],
];

/** 最初に一致した行だけを書き換える (変わらなければ undefined) */
function edit(src: string, re: RegExp, f: (line: string) => string): string | undefined {
  const lines = src.split("\n");
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return undefined;
  const next = f(lines[i]!);
  if (next === lines[i]) return undefined;
  lines[i] = next;
  return lines.join("\n");
}

/** 帯の二要素の間で寸法を移す — 合計は保ったまま、内側の切り位置だけが動く */
function shiftBandWidth(src: string): string | undefined {
  const lines = src.split("\n");
  const i = lines.findIndex((l) => /^ {2}space \/L2\/A\/wet .*w:\d+/.test(l));
  const j = lines.findIndex((l) => /^ {2}space \/L2\/A\/hall .*w:\d+/.test(l));
  if (i < 0 || j < 0) return undefined;
  lines[i] = lines[i]!.replace(/w:(\d+)/, (_, w: string) => `w:${Number(w) + 200}`);
  lines[j] = lines[j]!.replace(/w:(\d+)/, (_, w: string) => `w:${Number(w) - 200}`);
  return lines.join("\n");
}

/** 通り参照のオフセットを動かす (`X2+200` → `X2+300`) */
function bump(ref: string, d: number): string {
  const [, name, off] = /^([XY]\d+)([+-]\d+)?$/.exec(ref) ?? [];
  if (!name) return ref;
  const n = Number(off ?? 0) + d;
  return n === 0 ? name : `${name}${n > 0 ? "+" : "-"}${Math.abs(n)}`;
}

/** 描かれた線を平行に100mmずらす — 二室の割付が実際に動く (線を斜めにはしない) */
function shiftDrawnLine(src: string): string | undefined {
  return edit(src, /^ {2}line /, (l) => {
    const [, a, b] = /^ {2}line (\S+) (\S+)$/.exec(l) ?? [];
    if (!a || !b) return l;
    const [ax, ay] = a.split(",") as [string, string];
    const [bx, by] = b.split(",") as [string, string];
    if (ax === bx) return `  line ${bump(ax, 100)},${ay} ${bump(bx, 100)},${by}`; // 縦の線
    if (ay === by) return `  line ${ax},${bump(ay, 100)} ${bx},${bump(by, 100)}`; // 横の線
    return l;
  });
}

/** 一致する最初の二行を入れ替える — 順序が意味である列 (柱・帯の要素) を試すため */
function swapLines(src: string, re: RegExp): string | undefined {
  const lines = src.split("\n");
  const idx = lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return undefined;
  const [i, j] = [idx[0]!, idx[1]!];
  if (lines[i] === lines[j]) return undefined;
  [lines[i], lines[j]] = [lines[j]!, lines[i]!];
  return lines.join("\n");
}

test("property: one meaningful change always changes the bytes (injectivity, 30 seeds)", () => {
  const applied = new Map<string, number>();
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const j0 = toCanonical(parse(original));
    for (const [label, mutate] of MUTATIONS) {
      const mutated = mutate(original);
      if (mutated === undefined) continue;
      applied.set(label, (applied.get(label) ?? 0) + 1);
      assert.notEqual(
        toCanonical(parse(mutated)),
        j0,
        `seed=${seed}: changing the ${label} left the canonical bytes identical`,
      );
    }
  }
  // 一度も適用できなかった変更は、縛っているつもりで何も縛っていない
  const idle = MUTATIONS.map(([label]) => label).filter((label) => !applied.has(label));
  assert.deepEqual(idle, [], `mutations that never applied: ${idle.join(", ")}`);
});
