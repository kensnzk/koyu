// 正準性のproperty test (ADR-0013 / ADR-0014 / ADR-0029 / ADR-0036)。
//
// 正準形が答えるのは二つの問いで、両方を機械で守る。
//   1. **同じ構成なら同じバイト** — 宣言の並べ替えでバイトが変わらない
//   2. **違う構成なら違うバイト** (単射性) — 意味のある一箇所の変更で必ずバイトが変わる
//
// 母集団は**記法の全構文**である。柱・描かれた線・area・seg・アセット・polygon・帯・`+` の合併・
// レベル範囲・メゾネット・地下・縦動線 (階段・斜路・シャフトと stack)・境界の型・名前空間つき属性を、
// 生成器が毎回書く (COVERAGE が空でないことを縛る) — 狭い母集団の緑は、触っていない構文について
// 何も言わない。乱数は種つきLCG (再現可能)。
//
// **「全構文」は主張であって、放っておけば偽になる。**実際に二度偽だった — `+` の合併が一つも
// 入っておらず、縦動線 (`vertical.ts`、core 最大の部分系) が丸ごと母集団の外にあった。
// COVERAGE の行と、下の `runs` の件数の検査が、その主張の値段である。

import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { compareCanonical, toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";

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
  ["origin (the frame's position, in metres)", /"origin": \{\n\s+"epsg": 6677,/],
  ["azimuth (the frame's bearing)", /"azimuth": 3\d\d\.\d,/],
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
  // 合併は `at` が二枚になることが要点 — 一枚に縮めば母集団から `+` が消える
  ["region union (two rects in one space)", /"\/L2\/hall":\{"type":"corridor","at":\[\["X4","Y2","X5","Y3"\],\["X4","Y3","X5","Y4"\]\]/],
  // 縦動線 — core 最大の部分系 (vertical.ts)。層範囲の空間はレベルごとに展開される
  ["stair (level-range space)", /"\/L1\/st":\{"type":"stair"/],
  ["ramp with a declared slope", /"\/B1\/rmp":\{"type":"ramp"/],
  ["slope", /"slope":\d/],
  ["lift", /"lift":1/],
  // stack は縦の境界として出る (`stack` という鍵は正準形に無い)
  ["stack (vertical boundary)", /"between":\["\/L1\/st","\/L2\/st"\],"a":"\/L1\/st","kind":"stair"/],
  ["boundary type", /"kind":"open"/],
  ["ceiling", /"ceiling":0/],
  ["daylight", /"daylight":1/],
  ["hinge", /"hinge":"E"/],
];

/**
 * 記法の全構文を書く原本を生成する。返り値は並べ替え可能なブロックの列で、
 * 先頭 HEADER_BLOCKS 個 (基盤の宣言とアセット) は常に先頭に留まる —
 * grid と level は使用より前に、アセットは参照より前になければならない。
 */
function generate(rnd: () => number): { header: Block[]; body: Block[] } {
  const header: Block[] = [
    { lines: ["koyu 1.1"] },
    { lines: ["name 生成された模型"] },
    { lines: ["unit mm"] },
    { lines: ["grid X 0 3000 6000 9000 12000"] },
    { lines: ["grid Y 0 3000 6000 9000 12000"] },
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
        `${rnd() < 0.4 ? ` uid:sp-${i}${j}` : ""}${rnd() < 0.4 ? ` acme.sensor:2${i}` : ""}` +
        // 採光の問いの対象は決まった一室に書く (乱数に任せると母集団から消える回がある)
        `${i === 1 && j === 1 ? " daylight:1" : ""} name:室${i}${j}`,
    ];
    // area (数えない分節) — 親の領域の内側に置く (描かれた線が割付を動かすので400mm控える)
    if (rnd() < 0.5) {
      lines.push(`  area X${i}+400..X${i + 1}-400 Y${j}+400..Y${j}+1500 name:土間 floor:タイル`);
    }
    if (rnd() < 0.3) lines.push(`  area X${i}+400..X${i}+1200 Y${j}+1800..Y${j + 1}-400 name:床の間`);
    body.push({ lines });
  }
  // 外部・地下・メゾネット (パス先頭と所属レベルが違う空間)
  body.push({ lines: ["space /out outside:1 name:外部 road:12000"] });
  body.push({ lines: ["space /B1/park 駐車場 X1..X2 Y1..Y2 name:駐車場 acme.sensor:21"] });
  body.push({
    lines: [`space /L1/loft ${pick(rnd, ["room", "atelier"])} X4..X5 Y1..Y2 level:L2 name:ロフト`],
  });
  // + による領域の合併 — 書き順に意味は無い (正準形は綴りの正準順に並べる)
  body.push({
    lines: [`space /L2/hall corridor X4..X5 Y2..Y3 + X4..X5 Y3..Y4 ceiling:0 name:廊下`],
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

  // ---- 縦動線 — core 最大の部分系 (vertical.ts) が母集団の外にあった ----
  //
  // 階段・斜路・シャフトはどれも**層範囲の空間**であり (`/L1..L2/st`)、parse がレベルごとの
  // 空間へ展開する。`stack` は展開された空間どもを縦に結ぶ関係で、正準形では縦の境界として出る。
  // 段数・踏面・勾配は書かれない — 導出が出す (だから形の側でしか確かめられない)。
  body.push({
    lines: [
      `space /L1..L2/st stair X1..X2 Y4..Y5 name:階段 use:common stair:${pick(rnd, ["N", "S"])} form:return`,
    ],
  });
  body.push({ lines: ["space /L1..L2/ev shaft X2..X3 Y4..Y5 name:EV use:common lift:1"] });
  body.push({
    lines: [
      `space /B1..L1/rmp ramp X3..X4 Y4..Y5 name:車路 use:parking ramp:E form:return slope:${pick(rnd, [6, 8])}`,
    ],
  });
  // 境界の型 — 物の名 (spec) ではなく関係の型。`shaft` は縦の関係なので同一レベル間では VRT02 になる
  body.push({ lines: ["boundary /L1..L2/st /L1..L2/ev type:open"] });
  body.push({ lines: ["stack st L1..L2 type:stair"] });
  body.push({ lines: ["stack ev L1..L2 type:shaft"] });
  body.push({ lines: ["stack rmp B1..L1 type:stair"] });

  // ---- 境界: 接する組の一部に宣言する (残りは既定壁 — ADR-0014) ----
  const drawn: Array<{ block: Block; line: string }> = [];
  for (const a of cells) {
    for (const b of cells) {
      const alongX = a[1] === b[1] && b[0] === a[0] + 1;
      const alongY = a[0] === b[0] && b[1] === a[1] + 1;
      if (!alongX && !alongY) continue;
      // 最初の隣接組は必ず宣言する — 全て飛ばすと描かれた線を置く先が無くなる
      if (drawn.length > 0 && rnd() < 0.3) continue;
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
      `  door w:900 at:X1+900 hinge:E name:玄関`,
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
  body.push({ lines: [`polygon /site -1000,-1000 13000,-1000 ${13000 + jitter},13000 -1000,13000`] });
  // ---- 測地の枠 — 所与であって設計ではない。**並べ替えても同じ建物になる**ことが要点で、
  // 値そのものは何も導出しないので、宣言の位置だけが試される (ADR-0057) ----
  body.push({
    lines: [
      `origin epsg:6677 easting:${-8000 - jitter}.123 northing:-34000.456 elevation:2.35 vertical:6695`,
    ],
  });
  body.push({ lines: [`azimuth Y ${(347.5 + Math.floor(rnd() * 5)).toFixed(1)}`] });
  body.push({ lines: ["zone /site name:敷地 site:1"] });
  body.push({ lines: ["space /site/yard yard X4..X5 Y2..Y3 level:L1 name:外構"] });
  body.push({ lines: ["zone /L1 name:一階"] });
  body.push({ lines: [`zone /L2/A name:Aタイプ use:${pick(rnd, ["exclusive", "common"])}`] });
  return { header, body };
}

const render = (bs: Block[]) => bs.flatMap((b) => b.lines).join("\n") + "\n";

/**
 * **描かれた線の端点の書き順を入れ替える意味保存変形。**
 *
 * 描かれた線は向きを持たない ([凸片](../docs/reference/form/regions.md))。端点をどちらから
 * 書いても同じ線であり、同じ正準形と同じ形を与えなければならない。
 *
 * 手で書いた witness は [uniqueness.test.ts](uniqueness.test.ts) にあるが、母集団の上では
 * 試されていなかった — 生成器は毎回線を引くのに、その向きを一度も反転していなかった。
 */
function swapLineEndpoints(body: Block[]): Block[] {
  return body.map((b) => ({
    ...b,
    lines: b.lines.map((l) => {
      const m = /^( {2}line )(\S+) (\S+)$/.exec(l);
      return m ? `${m[1]}${m[3]} ${m[2]}` : l;
    }),
  }));
}

/**
 * **`+` の合併の書き順を入れ替える意味保存変形。**
 *
 * 領域の合併に書き順の意味は無い — 正準形は割付を綴りの正準順に並べる ([凸片](../docs/reference/form/regions.md))。
 * 入れ替えた版は同じバイトと同じ形を与えなければならない。
 */
function swapUnion(body: Block[]): Block[] {
  return body.map((b) => ({
    ...b,
    lines: b.lines.map((l) => {
      const m = /^(space \S+ \S+ )(\S+\.\.\S+ \S+\.\.\S+) \+ (\S+\.\.\S+ \S+\.\.\S+)( .*)$/.exec(l);
      return m ? `${m[1]}${m[3]} + ${m[2]}${m[4]}` : l;
    }),
  }));
}

/**
 * **帯を位置指定へ書き直す意味保存変形。**
 *
 * 帯は寸法と並びから位置を導く綴りであって、別の建物ではない — [band](../docs/reference/muro/band.md)
 * が「帯で書いた版と位置で書いた版は同じ正準形を与える」と言う。
 *
 * **床規則をここで独立に実装することが要点である。**導出された切り位置の綴りは「その座標以下で
 * 最も大きい通り芯からのオフセット」であり、実装からその綴りを読んで書き戻せば round-trip を
 * 試すだけになる。二度目の実装を置いて突き合わせなければ、規則そのものを縛っていない。
 *
 * 正準JSONは `at` の綴りを素通しするので、**同じ座標を別の綴りで書けばバイトは変わる。**
 * だからこの変形は「同じ座標を、帯が導くのと同じ綴りで書く」ものでなければならない。
 */
const GRID_X = [0, 3000, 6000, 9000, 12000];

/** 床規則 — その座標以下で最も大きい通り芯からのオフセットとして綴る */
function spellX(mm: number): string {
  let i = 0;
  for (let k = 0; k < GRID_X.length; k++) if (GRID_X[k]! <= mm) i = k;
  const rest = mm - GRID_X[i]!;
  return rest === 0 ? `X${i + 1}` : `X${i + 1}+${rest}`;
}

/**
 * 帯のブロックを、同じ座標を指す位置指定の三行に置き換える。
 * 帯は `band X X1..X4 Y1..Y2` で 0..9000mm を割る (通り芯は GRID_X)。
 */
function bandToPositions(body: Block[]): Block[] {
  return body.map((b) => {
    if (!b.lines[0]!.startsWith("band X ")) return b;
    const widths = b.lines.slice(1).map((l) => {
      const m = /^ {2}space (\S+) (\S+) w:(\S+) name:(\S+)$/.exec(l);
      assert.ok(m, `帯の要素が読めない: ${l}`);
      return { path: m[1]!, type: m[2]!, w: m[3]!, name: m[4]! };
    });
    let at = 0;
    const cuts: number[] = [];
    for (const w of widths.slice(0, -1)) {
      at += Number(w.w);
      cuts.push(at);
    }
    const edges = ["X1", ...cuts.map(spellX), "X4"];
    return {
      lines: widths.map(
        (w, i) => `space ${w.path} ${w.type} ${edges[i]}..${edges[i + 1]} Y1..Y2 name:${w.name}`,
      ),
    };
  });
}

/**
 * **層に割って書いた版** — 属性を `over` へ括り出す意味保存変形。
 *
 * 合成の規則5 は「`over` で直した模型と最初からそう書いた模型は同じ正準形を与える」と言う。
 * 手で書いた対は一つ置いたが、**母集団の上では一度も試していない。**
 *
 * `space` の行から `name:` を剥がし、より強い層の `over` に置き直す。`over` は定義より強い層に
 * 無ければ通らない (規則1 — entry は添字0で最も弱い) ので、entry は `import` だけを持ち、
 * 定義は base 層、`over` はその後の層に入る。
 *
 * `koyu` の版宣言は entry でのみ書ける。それ以外の基盤の宣言はどの層でもよい。
 */
function liftAttrsToOver(header: Block[], body: Block[]): Record<string, string> {
  const overs: string[] = [];
  /**
   * 括り出す鍵。**typed field を混ぜることが要点である。**
   *
   * `name` は宣言でも `over` でも属性の袋に入るので、括り出しても両方の経路が同じ道を通る —
   * それだけでは経路の違いを一つも試していない。`level` (空間) と `t` `type` (境界) は
   * parse が型のついたフィールドへ持ち上げる鍵なので、`over` の側が持ち上げを忘れていれば
   * 死んだ属性が残って別の建物になる。実際にそういう破れがあった。
   *
   * `w` は括り出さない — 帯の要素の語であり、`space` にも `over` にも書けない。   *
   * **層範囲の空間 (`/L1..L2/st`) は括り出せない。**parse がレベルごとの空間へ展開するので、
   * モデルには `/L1/st` と `/L2/st` しか無く、書かれた綴りを `over` の的にはできない。
   * 展開後の綴りを当てにいくのは変形ではなく別の建物を書くことなので、ここでは飛ばす。
   */
  const SPACE_KEYS = ["name", "level", "use"];
  const BOUNDARY_KEYS = ["t", "type"];
  const lift = (line: string, target: string, keys: string[]): string => {
    let out = line;
    for (const k of keys) {
      const m = new RegExp(`(?:^| )${k}:(\\S+)`).exec(out);
      if (!m) continue;
      overs.push(`over ${target} ${k}:${m[1]}`);
      out = out.replace(new RegExp(` ${k}:\\S+`), "");
    }
    return out;
  };
  const stripped = body.map((b) => ({
    ...b,
    lines: b.lines.map((l) => {
      const sp = /^space (\/\S+) /.exec(l);
      if (sp) return sp[1]!.includes("..") ? l : lift(l, sp[1]!, SPACE_KEYS);
      const bd = /^boundary (\/\S+) (\/\S+) /.exec(l);
      if (bd) {
        if (bd[1]!.includes("..") || bd[2]!.includes("..")) return l;
        return lift(l, `${bd[1]} ${bd[2]}`, BOUNDARY_KEYS);
      }
      return l;
    }),
  }));
  const [version, ...rest] = header;
  return {
    "main.muro": [version!.lines[0], "import ./base.muro", "import ./over.muro"].join("\n") + "\n",
    "base.muro": render([...rest, ...stripped]),
    "over.muro": overs.join("\n") + "\n",
  };
}

/**
 * **強度を争わせる変形。**弱い層が A と言い、強い層が B と言う版を作る。
 *
 * `liftAttrsToOver` は括り出した鍵を base から**消す**ので、`over` がその属性の唯一の意見になる。
 * つまり**強度が一度も争われない** — 強度の添字が逆の実装でも全種を通ってしまう。
 * ここでは base に元の値を残したまま `over` が別の値を書き、**強い層が勝った版**と突き合わせる。
 *
 * 併せて縛るのは三つ。**層の列** (`model.layers` は正準JSONに出ないので、これしか見る道が無い)、
 * **入れ子と二重取り込み** (規則1の平坦化は深さ優先で、同じ層は一度しか現れない)、そして
 * **import の順は意味である** (`over` を定義より前に置けば、通らずに言葉になる)。
 */
function contestStrength(
  header: Block[],
  body: Block[],
): { flat: Record<string, string>; nested: Record<string, string>; doubled: Record<string, string>; swapped: Record<string, string>; one: string; contested: number } {
  const overs: string[] = [];
  const contest = (line: string): string => {
    const sp = /^(\s*)space (\/\S+) /.exec(line);
    if (sp && !sp[2]!.includes("..")) {
      const m = / name:(\S+)/.exec(line);
      if (!m) return line;
      overs.push(`over ${sp[2]} name:${m[1]}改`);
      return line.replace(` name:${m[1]}`, ` name:${m[1]}改`);
    }
    const bd = /^boundary (\/\S+) (\/\S+) /.exec(line);
    if (bd && !bd[1]!.includes("..") && !bd[2]!.includes("..")) {
      const m = / t:(\d+)/.exec(line);
      if (!m) return line;
      overs.push(`over ${bd[1]} ${bd[2]} t:${Number(m[1]) + 40}`);
      return line.replace(` t:${m[1]}`, ` t:${Number(m[1]) + 40}`);
    }
    return line;
  };
  const substituted = body.map((b) => ({ ...b, lines: b.lines.map(contest) }));
  const [version, ...rest] = header;
  const v = version!.lines[0]!;
  const base = render([...rest, ...body]); // 元の値を残す — ここが争いの弱い側
  const over = overs.join("\n") + "\n";
  return {
    flat: { "main.muro": `${v}\nimport ./base.muro\nimport ./over.muro\n`, "base.muro": base, "over.muro": over },
    nested: {
      "main.muro": `${v}\nimport ./mid.muro\nimport ./over.muro\n`,
      "mid.muro": "import ./base.muro\n",
      "base.muro": base,
      "over.muro": over,
    },
    doubled: {
      "main.muro": `${v}\nimport ./mid.muro\nimport ./base.muro\nimport ./over.muro\n`,
      "mid.muro": "import ./base.muro\n",
      "base.muro": base,
      "over.muro": over,
    },
    swapped: { "main.muro": `${v}\nimport ./over.muro\nimport ./base.muro\n`, "base.muro": base, "over.muro": over },
    one: render([...header, ...substituted]),
    contested: overs.length,
  };
}

/**
 * **ヘッダの中を並べ替える意味保存変形。**
 *
 * 四つの変形はどれも `[...header, ...body]` で組むので、**基盤の十宣言は一度も動いていなかった。**
 * ヘッダを本体より**前**に置く理由 (`grid` と `level` は使用より前、アセットは参照より前) は
 * ヘッダの**中**の順を凍らせる理由にはならない。
 *
 * 動かせるのは族の中だけである — `koyu` の行は必ず先頭、`unit` は `grid` の数値の読み方を決めるので
 * `grid` より前に留める。族の並び (メタ → 通り芯 → レベル → アセット) も保つ。
 */
function permuteHeader(header: Block[], rnd: () => number): Block[] {
  const family = (b: Block): number => {
    const l = b.lines[0]!;
    if (l.startsWith("name ")) return 1;
    if (l.startsWith("unit ")) return 1;
    if (l.startsWith("grid ")) return 2;
    if (l.startsWith("level ")) return 3;
    if (l.startsWith("asset ")) return 4;
    return 0; // koyu 1.1 — 動かさない
  };
  const out: Block[] = [];
  for (const f of [0, 1, 2, 3, 4]) {
    const members = header.filter((b) => family(b) === f);
    out.push(...(f === 0 ? members : shuffle(members, rnd)));
  }
  assert.equal(out.length, header.length, "並べ替えでヘッダの行が落ちた");
  return out;
}

/**
 * **境界の a/b を入れ替える変形。これは正準形の等値ではない。**
 *
 * a/b の向きは正準JSONに `a` として残る (`edge` と `swing` をそこから読むため) ので、
 * 入れ替えればバイトは変わる — 約束1の含意の話ではない。縛るのは**何に効いてよいか**である。
 * [境界](../docs/reference/muro/boundary.md)が言うのは「書き順が意味を持つのは `edge` と
 * [扉の開く先](../docs/reference/muro/door.md) の二つだけ」であり、**幾何は効いてはならない。**
 *
 * だから比べるのは形の**幾何の射影**である — 空間の面積と輪郭、壁の線分と壁パネル、開口の位置。
 * `a` `b` `ref` `edgeOfA` `swing` は落とす (それらは a/b から読むと規範が言っている)。
 *
 * 手で書いた witness は [uniqueness.test.ts](uniqueness.test.ts) にあり、実際に破れを捕まえた
 * (線が隅を落とす側が反転して 26.00㎡ ↔ 34.00㎡ になった)。母集団の上では試されていなかった。
 */
function swapBoundaryEnds(body: Block[]): { body: Block[]; swapped: number } {
  let swapped = 0;
  const out = body.map((b) => ({
    ...b,
    lines: b.lines.map((l) => {
      const m = /^boundary (\/\S+) (\/\S+)(.*)$/.exec(l);
      // `edge` は「a 側の形から見た辺」なので、入れ替えれば方位が裏返る — 規範が名指しする非対称
      if (!m || / edge:/.test(l)) return l;
      swapped++;
      return `boundary ${m[2]} ${m[1]}${m[3]}`;
    }),
  }));
  return { body: out, swapped };
}

/**
 * 形の幾何だけを採る射影 — a/b から読んでよいものを落とす。
 *
 * 落とすのは二種類ある。**a/b から読むと規範が言うもの** (`a` `b` `ref` `edgeOfA` `swing`) と、
 * **正準の境界順に従うもの**である。後者は[凸片](../docs/reference/form/regions.md)が
 * 「切り分けは正準の境界順に効く」と定めており、a/b を入れ替えれば境界の綴りが変わるので
 * **凸片と slab の並びは変わってよい。**変わってはならないのは面積と、幾何の集合そのものである。
 */
function geometryOf(src: string): string {
  const f = derive(parse(src));
  const sorted = (xs: unknown[]): string[] => xs.map((x) => JSON.stringify(x)).sort(compareCanonical);
  const spaces = f.spaces
    .map((s) => JSON.stringify([s.path, s.areaM2, sorted(s.outline)]))
    .sort(compareCanonical);
  // `edgeOfA` は「a 側の形から見た辺」なので a/b から読む — 落とす。線分そのものは残す
  const seg = (g: { x1: number; y1: number; x2: number; y2: number; horizontal: boolean }) =>
    [g.x1, g.y1, g.x2, g.y2, g.horizontal];
  const walls = sorted(f.boundaries.map((b) => [seg(b.segment), b.material, b.kind, b.air, b.level]));
  const openings = sorted(f.openings.map((o) => [o.kind, o.cx, o.cy, o.w, o.z0, o.z1, o.t, o.sliding]));
  return JSON.stringify({ spaces, walls, openings, levels: f.levels, slabs: sorted(f.slabs) });
}

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
    // 整形の空白に縛られないよう、当てるのは空白を潰した写しである
    const flat = json.replace(/\s+/g, "");
    for (const [label, re] of COVERAGE) {
      assert.ok(re.test(json) || re.test(flat), `seed=${seed}: the generated model carries no ${label}`);
    }
    // **導出の側も痩せていてはならない。**正準形に縦動線の宣言があっても、形が一本も出なければ
    // vertical.ts は依然として性質の外にある。段数と踏面はここでしか現れない (原本には書かれない)。
    const f = derive(model);
    assert.ok(f.runs.length >= 3, `seed=${seed}: 縦動線の形が ${f.runs.length} 本しか出ていない`);
    // 蹴上げの数・踏面・勾配はどれも原本に書かれていない — 導出だけが出す量である
    assert.ok(
      f.runs.some((r) => r.device === "stair" && r.risers > 0 && r.tread > 0),
      `seed=${seed}: 蹴上げと踏面を持つ階段が一つも無い — 導出が働いていない`,
    );
    assert.ok(
      f.runs.some((r) => r.device === "ramp" && r.slope > 0),
      `seed=${seed}: 勾配を持つ斜路が無い`,
    );
    // 二度導いて同じバイト — 決定性を単一ファイルの経路でも見る
    assert.equal(JSON.stringify(derive(model)), JSON.stringify(f), `seed=${seed}: 二度導いて形が違う`);
  }
});

test("property: reordering declarations does not change the bytes (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const shuffled = render([...header, ...reorder(body, lcg(seed * 7))]);
    const reversed = render([...header, ...reverse(body)]);
    assert.notEqual(shuffled, original, `seed=${seed}: the shuffle changed nothing (the test is idle)`);
    assert.notEqual(reversed, original, `seed=${seed}: the reverse changed nothing (the test is idle)`);
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

test("property: reversing the endpoints of a drawn line gives the same building (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const flipped = render([...header, ...swapLineEndpoints(body)]);
    assert.notEqual(flipped, original, `seed=${seed}: 反転が空振りしている — 母集団に線が無い`);
    assert.equal(
      toCanonical(parse(flipped)),
      toCanonical(parse(original)),
      `seed=${seed}: 線の端点の書き順がバイトに漏れている`,
    );
    assert.equal(
      JSON.stringify(derive(parse(flipped))),
      JSON.stringify(derive(parse(original))),
      `seed=${seed}: 正準形は同じなのに形が違う (線の端点の書き順)`,
    );
  }
});

test("property: permuting the header within its families gives the same building (30 seeds)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const permuted = render([...permuteHeader(header, lcg(seed * 13)), ...body]);
    assert.notEqual(permuted, original, `seed=${seed}: ヘッダの並べ替えが空振りしている`);
    assert.equal(
      toCanonical(parse(permuted)),
      toCanonical(parse(original)),
      `seed=${seed}: 基盤宣言の書き順がバイトに漏れている`,
    );
    assert.equal(
      JSON.stringify(derive(parse(permuted))),
      JSON.stringify(derive(parse(original))),
      `seed=${seed}: 正準形は同じなのに形が違う (ヘッダの並べ替え)`,
    );
  }
});

test("property: swapping a boundary's a and b moves no geometry (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const sw = swapBoundaryEnds(body);
    const swapped = render([...header, ...sw.body]);
    assert.ok(sw.swapped >= 1, `seed=${seed}: 入れ替えられる境界が無い`);
    assert.notEqual(swapped, original, `seed=${seed}: 入れ替えが空振りしている`);
    // バイトは変わってよい — a/b は正準形に残る。変わってはならないのは幾何である
    assert.notEqual(
      toCanonical(parse(swapped)),
      toCanonical(parse(original)),
      `seed=${seed}: a/b が正準形に残っていない (edge と swing を読む出所が消えている)`,
    );
    assert.equal(
      geometryOf(swapped),
      geometryOf(original),
      `seed=${seed}: a/b の向きが幾何に効いている`,
    );
  }
});

test("property: swapping the operands of a + union gives the same building (30 seeds, whole notation)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const original = render([...header, ...body]);
    const swapped = render([...header, ...swapUnion(body)]);
    assert.notEqual(swapped, original, `seed=${seed}: 入れ替えが空振りしている`);
    assert.equal(
      toCanonical(parse(swapped)),
      toCanonical(parse(original)),
      `seed=${seed}: 合併の書き順がバイトに漏れている`,
    );
    assert.equal(
      JSON.stringify(derive(parse(swapped))),
      JSON.stringify(derive(parse(original))),
      `seed=${seed}: 正準形は同じなのに形が違う (合併の書き順)`,
    );
  }
});

test("property: a band and the positions it derives are one building (30 seeds, whole notation)", () => {
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const banded = render([...header, ...body]);
    const positioned = render([...header, ...bandToPositions(body)]);
    assert.notEqual(positioned, banded, `seed=${seed}: 書き直しが空振りしている`);
    checked++;
    assert.equal(
      toCanonical(parse(positioned)),
      toCanonical(parse(banded)),
      `seed=${seed}: 帯と、それが導く位置指定が別の建物になった`,
    );
    assert.equal(
      JSON.stringify(derive(parse(positioned))),
      JSON.stringify(derive(parse(banded))),
      `seed=${seed}: 正準形は同じなのに形が違う (帯と位置)`,
    );
  }
  assert.equal(checked, 30, "全ての種で帯が生成されていなければ、母集団が帯を含んでいない");
});

test("property: lifting attributes into over gives the same building (30 seeds, whole notation)", () => {
  let lifted = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const one = render([...header, ...body]);
    const layers = liftAttrsToOver(header, body);
    const overs = layers["over.muro"]!.trim().split("\n").filter((l) => l !== "");
    if (overs.length === 0) continue; // 括り出すものが無い種は飛ばす (下で件数を縛る)
    lifted++;
    const j0 = toCanonical(parse(one));
    assert.equal(
      toCanonical(parseFiles(layers, "main.muro")),
      j0,
      `seed=${seed}: ${overs.length} 件を over へ括り出したら別の建物になった`,
    );
    assert.equal(
      JSON.stringify(derive(parseFiles(layers, "main.muro"))),
      JSON.stringify(derive(parse(one))),
      `seed=${seed}: 正準形は同じなのに形が違う (over へ括り出した版)`,
    );
  }
  assert.ok(lifted >= 25, `括り出しが起きた種が少なすぎる: ${lifted}/30 — 変形が空振りしている`);
});

/**
 * **P5 — 同じ entry からは常に同じ層の列・同じモデル。**
 *
 * [規則1](../docs/reference/muro/composition.md)は「強度は import の順が宣言する」と言い、
 * **走査の順ではない**と名指しで否定する。`parseFiles` はファイルを `Record` で受けるので、
 * **その鍵の並びは入力の偶然**である (ファイルシステムの列挙順・オブジェクトリテラルの書き順)。
 * 偶然が結果に効けば規則1が破れる。
 *
 * だから縛るのは二つ。**二度読んで同じバイト** (決定性そのもの) と、**鍵の並びを変えても同じバイト**
 * (走査の順が結果に残らない)。手で書いた witness は [composition.test.ts](composition.test.ts) に
 * あるが、母集団の上では試されていなかった。
 */
test("property: the same entry always gives the same model, whatever order the files arrive in (30 seeds)", () => {
  let layered = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const layers = liftAttrsToOver(header, body);
    if (layers["over.muro"]!.trim() === "") continue;
    layered++;
    const j0 = toCanonical(parseFiles(layers, "main.muro"));

    // 決定性 — 同じ入力を二度読む
    assert.equal(toCanonical(parseFiles(layers, "main.muro")), j0, `seed=${seed}: 二度読んで結果が違う`);

    // 鍵の並びを変える — 中身は一字も変えない
    const keys = Object.keys(layers);
    assert.equal(keys.length, 3, `seed=${seed}: 層が ${keys.length} 枚 — 3枚のはず`);
    // 恒等置換を掴まないよう、実際に並びが変わったものだけを試す (3枚なので 1/6 で恒等になる)
    const orders: string[][] = [[...keys].reverse()];
    for (let k = 0; orders.length < 2 && k < 20; k++) {
      const cand = shuffle(keys, lcg(seed + 1000 + k));
      if (cand.join(" ") !== keys.join(" ") && cand.join(" ") !== orders[0]!.join(" ")) orders.push(cand);
    }
    assert.equal(orders.length, 2, `seed=${seed}: 並べ替えが二通り作れなかった`);
    for (const order of orders) {
      assert.notEqual(order.join(" "), keys.join(" "), `seed=${seed}: 並べ替えが恒等だった`);
      const permuted: Record<string, string> = {};
      for (const k of order) permuted[k] = layers[k]!;
      assert.deepEqual(
        Object.keys(permuted).sort(),
        keys.slice().sort(),
        `seed=${seed}: 並べ替えで層が落ちた`,
      );
      assert.equal(
        toCanonical(parseFiles(permuted, "main.muro")),
        j0,
        `seed=${seed}: ファイルが届く順が結果に漏れている (${order.join(" ")}) — 規則1が破れている`,
      );
    }
  }
  assert.ok(layered >= 25, `層に割れた種が少なすぎる: ${layered}/30`);
});

/**
 * **P5 の本体 — 強い層が勝つこと、層の列、入れ子、そして import の順が意味であること。**
 *
 * ここが縛るのは、上の `liftAttrsToOver` では**構造上縛れない**四つである。
 */
test("property: the stronger layer wins, the layer sequence is the depth-first import order (30 seeds)", () => {
  let contested = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { header, body } = generate(lcg(seed));
    const c = contestStrength(header, body);
    assert.ok(c.contested >= 5, `seed=${seed}: 争っている属性が ${c.contested} 件しかない`);
    contested += c.contested;
    assert.notEqual(c.one, render([...header, ...body]), `seed=${seed}: 置換が空振りしている`);

    // 強い層 (後の import) が勝つ — 弱い層は元の値を主張し続けている
    const j1 = toCanonical(parse(c.one));
    for (const [label, files, layers] of [
      ["flat", c.flat, ["main.muro", "base.muro", "over.muro"]],
      ["nested", c.nested, ["main.muro", "mid.muro", "base.muro", "over.muro"]],
      ["doubled", c.doubled, ["main.muro", "mid.muro", "base.muro", "over.muro"]],
    ] as const) {
      const m = parseFiles(files, "main.muro");
      assert.equal(
        toCanonical(m),
        j1,
        `seed=${seed}/${label}: 強い層が勝っていない (強度の向きが逆か、平坦化が違う)`,
      );
      assert.equal(
        JSON.stringify(derive(m)),
        JSON.stringify(derive(parse(c.one))),
        `seed=${seed}/${label}: 正準形は同じなのに形が違う`,
      );
      // 層の列は正準JSONに出ないので、ここでしか見られない。二重に取り込んだ層は一度だけ現れる
      assert.deepEqual(m.layers, layers, `seed=${seed}/${label}: 層の列が違う`);
    }

    // import の順は意味である — over を定義より前に置けば、黙って別の答えを出さずに言葉になる
    assert.throws(
      () => parseFiles(c.swapped, "main.muro"),
      /No such target for over/,
      `seed=${seed}: import を入れ替えても通った — 強度が import の順で決まっていない`,
    );
  }
  assert.ok(contested >= 150, `争った属性の総数が少なすぎる: ${contested}`);
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

/**
 * **約束1の逆は成り立たない — その証人。**
 *
 * 「正準形が等しければ形も等しい」は[約束1](../docs/reference/form/index.md)である。
 * **その逆 (バイトが違えば形も違う) は規範のどこにも無く、かつ偽である。**
 * 運搬層の属性 (台帳の tier `carry`) は正準形に載るが core が解釈しないので、形に届かない。
 *
 * ここを試験で留めておくのは、逆を性質として書き足したくなったときに**それが偽だと分かる**ためと、
 * 運搬層の属性が形へ漏れ出したときに落ちるためである (漏れれば下の等値が破れる)。
 */
test("witness: different bytes do not imply a different shape (the converse of promise 1 is false)", () => {
  const src = (v: number) => `koyu 1.1
unit mm
grid X 0 3000
grid Y 0 3000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 acme.sensor:${v}
`;
  const a = parse(src(21));
  const b = parse(src(99));
  assert.notEqual(toCanonical(a), toCanonical(b), "運搬層の属性は正準形に載る");
  assert.equal(
    JSON.stringify(derive(a)),
    JSON.stringify(derive(b)),
    "運搬層の属性が形へ漏れている — core が解釈しない値は形に届いてはならない",
  );
});
