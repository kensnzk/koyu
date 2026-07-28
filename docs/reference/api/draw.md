---
title: 図の生成
mode: reference
---

# 図の生成

SVG の文字列を返す二つの関数である。**ここに形の規則は一つも無い** — 壁の厚みも、開口の位置も、扉の吊元も、階段がどこで切れるかも、[`derive(model)`](derive.md) が返す `Form` に既に入っている。この二つが決めるのは色・線種・線幅・書体・記号・注記の言葉・縮尺・投影・紙面の余白だけである。

```ts
import { svgPlan, svgAxo } from "@kensnzk/koyu";
import type { PlanOptions, AxoOptions } from "@kensnzk/koyu";
```

領域としては `@kensnzk/koyu/draw` にも分けてある。**同じ関数の別入口である。**

```ts
import { svgPlan, svgAxo } from "@kensnzk/koyu/draw";
```

## この面は凍らない

**SVG の中身は約束の外にある。**同じ入力から同じ形が出ることは約束されるが、**同じバイトが出ることは約束されない。**色・線種・書体・記号の見た目・要素の並びは断りなく変わる。

だから**この出力をゴールデンファイルにしてはならない。**図を機械で比べたいなら [`toCanonical`](canonical.md) か [`derive`](derive.md) の返り値を比べる — そちらは形そのものであり、決定性が約束されている。

## svgPlan

```ts
function svgPlan(model: Model, opts?: PlanOptions): string

interface PlanOptions {
  level?: string;   // 既定: 最初に宣言されたレベル
  scale?: number;   // px per mm。既定 0.05
  cut?: number;     // 切断面の高さ mm (FL から)。既定 1200
}
```

平面図を返す。`cut` は**形を決める引数**なので `derive` の入力へそのまま渡る — 縮尺と違って、これは見た目ではなく形の話である。

```ts
import { svgPlan } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const svg = svgPlan(a, { level: "L1" });
console.log(svg.length + " chars");
console.log(svg.split("\n")[0]);
```

```text
3843 chars
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="393" viewBox="0 0 528 393" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

`scale` と `cut` を動かすと紙面も変わる。

```ts
console.log(svgPlan(a, { level: "L1", scale: 0.1, cut: 800 }).split("\n")[0]);
```

```text
<svg xmlns="http://www.w3.org/2000/svg" width="888" height="618" viewBox="0 0 888 618" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

紙面の外接範囲には**書かれた割付も含める** — 線で切られた形より外へ割付がはみ出しても、紙には載る。敷地形状は最下階の平面 (配置図兼用) にだけ敷地境界線として描かれる。これは紙面の構成の判断であって、形の規則ではない。

### 投げることがある

**`Error` を投げる。**`SourceError` ではないので、位置も行番号も持たない。呼び出し側で捕まえること。

| メッセージ | いつ |
|---|---|
| `No level is defined` | `level` を省き、模型にレベルが一つも無い |
| `There is no space with a region on level <名>` | 指定したレベルに領域を持つ空間が無い |

```ts
try { svgPlan(a, { level: "L9" }); } catch (e) { console.log("throws:", (e as Error).message); }
```

```text
throws: There is no space with a region on level L9
```

## svgAxo

```ts
function svgAxo(model: Model, opts?: AxoOptions): string

interface AxoOptions {
  dir?: "NE" | "NW" | "SE" | "SW";   // 見る向き。既定 SE
  scale?: number;                     // px per mm。既定 0.02
  levels?: string[];                  // 描くレベル。既定すべて
  ceilings?: boolean;                 // 天井も描く。既定 false
  walls?: boolean;                    // 壁を描く。既定 true
}
```

軸測図 (アクソメ) を返す。平面図が「そのレベルで切った断面」であるのに対し、これは**立体をそのまま投影した図**である。WebGL も実行環境も要らない — 平面と同じく SVG のテキストが出るので、生成して見る、という同じ手で立体を確かめられる。

描かれるのは**生成物だけ**である。床・屋根、境界から現れた壁、通りの交点から現れた柱、縦動線。どれもソースには無い。

```ts
import { svgAxo } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const h = parseFile("examples/house/main.muro");
const ax = svgAxo(h);
console.log(ax.length + " chars");
console.log(ax.split("\n")[0]);
```

```text
33025 chars
<svg xmlns="http://www.w3.org/2000/svg" width="472.1363028335939" height="405.35" viewBox="0 0 472.1363028335939 405.35" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

`dir` は建物のどの隅から見下ろすかである。平面を90度ずつ回してから等角に落とすので、四つの向きで違う面が見える。

```ts
for (const dir of ["NE", "NW", "SE", "SW"] as const) console.log(dir, svgAxo(h, { dir }).length);
```

```text
NE 33140
NW 33016
SE 33025
SW 32957
```

**`ceilings` の既定が `false` なのは、描くと中が見えなくなるからである。**`walls: false` にすると床・屋根・柱・縦動線だけが残り、構造と面の関係が見える。

```ts
console.log("levels:", svgAxo(h, { levels: ["L1"] }).length,
  "ceilings:", svgAxo(h, { ceilings: true }).length,
  "walls:false", svgAxo(h, { walls: false }).length);
```

```text
levels: 19982 ceilings: 36021 walls:false 7425
```

### 投げることがある

描くものが一つも無ければ `Error` を投げる。

| メッセージ | いつ |
|---|---|
| `There is nothing to draw` | 立体が一つも生成されない (レベルが無い、領域を持つ空間が無い、`levels` の指定が全部外れている) |

## 自分で描くなら

`Form` を直接読んで自分の描画系へ写すのが正道である。**同じ規則から出た形を、違う見た目で描く** — それがこの分離の目的である。

```ts
import { derive } from "@kensnzk/koyu";

const form = derive(model, { cut: 1200 });
const plan = form.plans.find((p) => p.level === "L1")!;

for (const e of plan.entities) {
  // e.class は cut / below / above / swing / anchor
  // e.polygon は足あと、e.lines は芯線 — どちらで描くかは見た目の判断
}
```

分類と型の中身は [形の導出](derive.md)。芯線から実体を起こす構成子は [実体と生成物](solids.md)。**それを自分で書き直さないこと** — 部品を共有していても組み立ての規則を共有しなければ、同じ `Form` から違う形が出る。

## 関連

- [形の導出](derive.md) — この二つが描いている `Form`
- [実体と生成物](solids.md) — 芯線と厚みから実体を起こす構成子
- [`koyu plan`](../cli/plan.md) / [`koyu axo`](../cli/axo.md) — 同じ生成をコマンドラインから
