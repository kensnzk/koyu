---
title: TypeScript API
mode: reference
---

# TypeScript API

`@kensnzk/koyu` は `.muro` を読み、検査し、問いに答え、形を導き、図を吐くライブラリである。**CLI が答えるものはすべてこの API が答える。**[`koyu` コマンド](../cli/index.md)・`koyu-mcp` サーバー・この API は同じ導出の三つの入口であり、どれかにしか無い答えというものは無い。

```sh
npm install @kensnzk/koyu
```

実行時依存はゼロである。パッケージが引くのは Node 標準モジュールだけで、それも `@kensnzk/koyu/node` の中だけに閉じている。動作環境は **Node 22 以上** (`engines.node` が `>=22`)。

## 入口

```ts
import { parse, checkDiagnostics, derive } from "@kensnzk/koyu";
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";
import { validate, VALIDATION_RULES } from "@kensnzk/koyu/validate";
import { svgPlan, svgAxo } from "@kensnzk/koyu/draw";
```

| 入口 | 中身 | `node:fs` |
|---|---|---|
| `@kensnzk/koyu` | 面の全部 — 解析・診断・問い・導出・生成・差分・検証 | **引かない** |
| `@kensnzk/koyu/node` | `parseFile` `parseFileWith` の二つだけ | 引く |
| `@kensnzk/koyu/validate` | `validate` `VALIDATION_RULES` と型 `Finding` `ValidationRule` | 引かない |
| `@kensnzk/koyu/draw` | `svgPlan` `svgAxo` と型 `PlanOptions` `AxoOptions` | 引かない |
| `@kensnzk/koyu/examples/*` | 同梱の建物の原本 (`examples/two-rooms.muro` など)。テストや評価から読む | — |
| `@kensnzk/koyu/syntax` | エディタの文法 (TextMate 文法の JSON)。VS Code と Shiki が共有する | — |

上の四つが JS モジュールの入口で、`import` して名を引く。下の二つはデータ (同梱の建物の原本と文法ファイル) なので、`node:fs` の欄を持たない。**パッケージが公開しているサブパスはこの表で尽きている** — 宣言されたサブパスがこの頁に書かれていることはテストが縛るので、入口を足して書かなければ落ちる。

**ルートは `node:fs` も `node:path` も引かない。**ブラウザ・Web Worker・エッジランタイムでそのまま動く。ファイルシステムを触る入口だけが `/node` に分離してある。分けてあるのはパーサ本体を純粋に保つためで、合成 (`import` の解決) は「レイヤーをどう読むか」という関数を外から受け取る形になっており、fs はその実装の一つでしかない。ブラウザは仮想ファイル群 (`parseFiles`) か独自ローダー (`parseWith`) を渡す — [解析と合成](parsing.md)。

`/validate` と `/draw` はルートが再輸出している面の一部でもある。**領域を混ぜないための別入口**であって、別の実装ではない。ルートから `validate` を呼んでも `@kensnzk/koyu/validate` から呼んでも同じ関数である。(`/validate` のモジュールには `Finding` を組み立てる補助 `finding` も出ているが、これはルートが再輸出していない — 下の一覧に無い名は約束の外にある。)

## 面は書き下されている

パッケージのルートは **`export *` を使わない。**モジュールに export を足した瞬間に、誰も宣言していない約束が凍る面に増えてしまうからである。約束は書き下されていなければならない。

したがって**この面の全部は、`src/index.ts` に一つずつ書かれた名の集合である** — 実行時の値が **59**、型が **77**。ここに無い名は、ソースの中にあっても約束ではない。

**約束の全部がこの表である。**この表と `src/index.ts` の集合の一致はテストが縛るので、export を足して表に書かなければ落ちる。名の並びは照合順で、面の分け方は名がどのモジュールから出ているかである。

<!-- api-surface -->

| 面 | 値 | 型 |
|---|---|---|
| [解析と合成](parsing.md) | `parse` `parseFiles` `parseWith` `tokenize` | `LayerLoader` |
| [モデルと問い](model.md) | `areaM2` `canonicalBoundaryOrder` `columnsFor` `DEFAULT_LANGUAGE_VERSION` `displayName` `effectiveUse` `heff` `isCoveredAbove` `isIndoor` `isOutside` `isSemiOutdoor` `isVoid` `levelsSorted` `newUids` `pointInPolygon` `polyBounds` `polygonAreaM2` `rectToPoly` `SourceError` `srcRef` `SUPPORTED_LANGUAGE_VERSIONS` `toCanonical` `unionAreaM2` `zoneAreaM2` | `Area` `Asset` `Attrs` `AttrValue` `Boundary` `BoundaryKind` `Column` `ColumnDecl` `DrawnLine` `Edge` `GridAxis` `GridRef` `Level` `Model` `Opening` `Pt` `Rect` `Seg` `SitePolygon` `Space` `Zone` |
| [診断](diagnostics.md) | `check` `checkDiagnostics` `DIAGNOSTIC_CODES` | `CheckResult` `Diagnostic` `DiagnosticCode` |
| [グラフと線分](queries.md) | `deriveDefaultBoundaries` `doorsBetween` `envelopeGaps` `neighbors` `passable` `placeBand` `placeOpening` `segmentsFor` | `Band` `BandCode` `BandError` `NeighborInfo` `PlacedBand` `Route` `Segment` |
| [導出 (Form)](derive.md) | `band` `bandLine` `columnRect` `derive` `DERIVATION_CONSTANTS` `levelPitch` `runPrism` `thicken` | `DeriveOptions` `Form` `FormBoundary` `FormColumn` `FormInput` `FormLevel` `FormOpening` `FormPanel` `FormPlan` `FormPrism` `FormRun` `FormSeg` `FormSite` `FormSpace` `FormSwing` `PlanClass` `PlanEntity` `PlanRole` `PlanSubject` |
| [属性の台帳](../muro/attributes.md) | `ASSET_ELEM` `ATTR_LEDGER` `attrSpec` `CARRY_NAMESPACE` `isNamespaced` `known` | `AttrSpec` `AttrTier` |
| [公差](../form/constants.md) | `TOLERANCES` | — |
| [面 — 床・天井・屋根](solids.md) | `slabs` | `Slab` `SlabKind` |
| [採光の入力](queries.md) | `daylightInputs` | `DaylightInput` |
| [縦動線](solids.md) | `RUN_KEYS` `runDecls` `runDrawsForLevel` `runSolids` `slopeText` `verticalRuns` | `RunArrow` `RunDecl` `RunDevice` `RunDraw` `RunForm` `RunPart` `RunSolid` `Seg2` `VerticalRun` |
| [敷地](queries.md) | `siteReport` | `RoadFrontage` `SiteReport` |
| [差分](diff.md) | `renderDiff` `semanticDiff` | `BoundaryChange` `BoundaryItem` `ChangedItem` `ColumnItem` `FieldChange` `GridChange` `ModelDiff` `RenamedItem` `SpaceItem` |
| [平面の描画](draw.md) | `svgPlan` | `PlanOptions` |
| [立体の描画](draw.md) | `svgAxo` | `AxoOptions` |
| [建築的な判定](validate.md) | `validate` `VALIDATION_RULES` | `Finding` `ValidationRule` |

面に載る基準は四つある。

1. パッケージの外 (ビューワー・評価ハーネス・スクリプト・エディタ拡張) が実際に呼ぶ
2. CLI か MCP が答えるものを API からも答えるために要る
3. 導出として名指しで約束されている
4. テストが契約として固定している

core のモジュール同士が引き合うだけの配管は面ではない。型は、載せた値の署名を書き下すのに要るものだけが載る。

## 最初のプログラム

読み込み、検査し、面積を出す。これだけで一巡している。

```ts
import { checkDiagnostics, areaM2 } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/two-rooms.muro");

const diags = checkDiagnostics(model);
console.log(`${model.name} — spaces ${model.spaces.size} / diagnostics ${diags.length}`);
for (const d of diags) console.log(`${d.severity} ${d.code} ${d.message}`);

for (const s of model.spaces.values()) {
  console.log(`${s.path}\t${s.type}\t${areaM2(s) ?? "-"}`);
}
```

```text
二室 — spaces 3 / diagnostics 0
/L1/a	room	16.2
/L1/b	room	16.2
/out	exterior	-
```

`model.spaces` は `Map<string, Space>`、`model.boundaries` は `Boundary[]` である。**パスが空間の同一性**であり、境界はどちらの空間にも属さない第一級の関係として配列に並ぶ — [Model と構成型](model.md)。

**診断が空でも建物が使えるとは限らない。**`checkDiagnostics` が言うのは「書かれたものがデータとして矛盾していない」までである。扉を一枚も書かない二階建ては、診断が空のまま完全に密封される。建築の側の判断は [`validate`](validate.md) が別に言う。

## 頁の地図

| 頁 | 何を引くか |
|---|---|
| [Model と構成型](model.md) | `Model` `Space` `Boundary` `Zone` `Level` `Opening` ほか、書かれた構成の型 |
| [解析と合成](parsing.md) | `parse` `parseFiles` `parseWith` `parseFile` `parseFileWith` `tokenize` `LayerLoader` |
| [診断](diagnostics.md) | `checkDiagnostics` `check` `DIAGNOSTIC_CODES` `Diagnostic` `CheckResult` |
| [検証](validate.md) | `validate` `VALIDATION_RULES` `Finding` `ValidationRule` |
| [モデルへの問い](queries.md) | `doorsBetween` `neighbors` `areaM2` `siteReport` `daylightInputs` ほか |
| [形の導出](derive.md) | `derive` と `Form` の全構成型、`DERIVATION_CONSTANTS` `TOLERANCES` |
| [実体と生成物](solids.md) | `thicken` `band` `columnRect` `runPrism` `slabs` `verticalRuns` ほか |
| [図の生成](draw.md) | `svgPlan` `svgAxo` とその選択肢 |
| [正準JSON](canonical.md) | `toCanonical` |
| [意味差分](diff.md) | `semanticDiff` `renderDiff` `ModelDiff` |
| [同一性の生成](identity.md) | `newUids` |
| [幾何の小物](geometry.md) | `polygonAreaM2` `pointInPolygon` `polyBounds` `rectToPoly` `envelopeGaps` |
| [エラー](errors.md) | `SourceError` `srcRef` |
| [言語版](versions.md) | `SUPPORTED_LANGUAGE_VERSIONS` `DEFAULT_LANGUAGE_VERSION` |

## 三つの領域

面の中身は三つに割れていて、**割れ方そのものが約束の一部である。**

| 領域 | 何を言うか | 凍るか |
|---|---|---|
| core | 構成の整合と、そこから導かれる数と形 | **凍る** — 意味論を変える変更は言語版を上げる |
| 検証 | 建築的な判定 (`Finding`) | 凍らない — 増える・精度が上がる・捨てられる |
| 生成 | SVG の中身 | 凍らない — 見た目は自由に変わる |

core は**合否を言わない。**面積・線分・凸片・立体を返すところまでが core であり、「足りているか」「守られているか」は検証が言う。この分離は型に現れている — core は `Diagnostic { code, severity }` を返し、検証は `Finding { rule, level }` を返す。フィールド名から違うので、二つの配列は取り違えようがない。

生成 (`svgPlan` / `svgAxo`) が返す SVG の中身は約束の外にある。**同じ入力から同じ形が出ることは約束されるが、同じバイトが出ることは約束されない。**色・線種・書体・記号の見た目は断りなく変わる。図を機械で比べるなら [`toCanonical`](canonical.md) か [`derive`](derive.md) の返り値を比べる。
