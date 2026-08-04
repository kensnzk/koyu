# koyu core 0.18.0 — TypeScript API 公開面監査

日付: 2026-08-03

対象: `@kensnzk/koyu` 0.17.0 の package exports と root TypeScript API

性格: 0.18.0 実装前の review / work record。公開文書ではなく、ADRでもない。

## 0. 結論

0.17.0 の root は、実行時の値 **69件**と型 **80件**、合計 **149件**を一つの入口から公開している。正本は `src/index.ts:18-211`、公開表は `docs/reference/api/index.md:48-66`、集合一致の門番は `test/public-api.test.ts:32-133` である。package が公開する入口は `package.json:8-27` の root、`/validate`、`/draw`、`/node` と三つの data subpath である。

0.18.0 の JavaScript 入口は次の12件にする。この監査では、この集合を「承認済み入口」と呼ぶ。

```text
@kensnzk/koyu
@kensnzk/koyu/model
@kensnzk/koyu/diagnostics
@kensnzk/koyu/graph
@kensnzk/koyu/form
@kensnzk/koyu/analysis
@kensnzk/koyu/diff
@kensnzk/koyu/vocabulary
@kensnzk/koyu/validate
@kensnzk/koyu/validate/builtin
@kensnzk/koyu/draw
@kensnzk/koyu/node
```

data subpath の `/examples/*`、`/syntax`、`/package.json` は維持する。したがって `package.json#exports` の最終キーは JavaScript 12件 + data 3件 = 15件である。`/diagnostics`、`/graph`、`/diff`、`/vocabulary` はファイル別の細分ではない。それぞれ、構造保証、空間トポロジー、二つのModel間の演算、外部拡張の語彙契約という独立した利用者と安定性を持つため、`/model` や `/analysis` に畳まない。

root に残すのは基本ループだけである。

```ts
parse
parseFiles
parseWith
checkDiagnostics
toCanonical
derive
SourceError

type LayerLoader
type Model
type Diagnostic
type DiagnosticCode
type Form
type DeriveOptions
```

判定、描画、Node専用処理、graph、diff、語彙台帳、部分導出、formatterはrootから再輸出しない。

---

## 1. 監査方法と用語

1. `src/index.ts` の明示 `export { ... } from ...` を読み、値と型を別々に数えた。
2. `package.json#exports` を読み、JavaScript入口とdata入口を分けた。
3. `src/`、`eval/`、`scripts/`、`test/` の静的importを検索し、各公開名のrepository consumerを追った。
4. 型は直接importが無くても、公開値の署名を綴るために必要ならconsumerがあるものとした。例えば `FormBoundary` は直接importが少なくても `Form.boundaries` の公開契約である。
5. package外の未観測consumerは存在し得る。しかし0.18.0は互換面を残さず全公開面を切り替える版であり、repository内のconsumerを移行した上でpackage smokeと外部fixtureで新面を実証する。

処遇は四つである。

| 処遇 | 意味 |
|---|---|
| **root維持** | 0.18.0 rootにも同名で残す。必要なら専門subpathにも同名を置く |
| **移動** | 同じ意味・同じ名前で指定subpathへ移し、rootからは外す |
| **置換** | 現行契約を公開面から除き、新しい明示契約へ移行する。旧名の互換wrapperは残さない |
| **削除** | package公開面から除く。実装内部のexport/importは必要なら残せる |

### 1.1 公開削除を成立させる条件

名前を「削除」としただけでは完了しない。各削除は次の全条件を満たしたときに成立する。

1. CLI、MCP、eval、scripts、skills、testsのpackage-level consumerが代替入口または内部実装へ移っている。
2. その能力がCLI/MCPで必要なら、同じ意味を返す高水準APIが残っている。文字列formatterの同一公開は要求しない。
3. `package.json#exports`、全entrypointの明示export台帳、API文書が集合一致する。
4. `npm pack` したtarballのrootから旧名をimportできず、新しい全subpathをimportできるnegative/positive smoke testがある。
5. canonical JSONと`Form`が改修前後で一致する。今回のAPI整理だけを理由にmuro版やcanonical format版を動かさない。
6. 置換対象の採光・敷地・判定は、CLI JSON、MCP structured result、TS operationの同値テストがある。

---

## 2. package subpath の移行台帳

根拠: `package.json:8-27`。現行の `/validate` は `src/validate/index.ts` をそのまま指すため、文書上は非契約とされる `finding` まで実行時に見える (`docs/reference/api/index.md:38`)。0.18.0では各entrypoint自体を明示面にする。

| 0.17.0 key | 0.18.0 | 処遇 | 内容 / 理由 |
|---|---|---|---|
| `.` | `.` | 再構成 | 上記12名だけの基本loop。validation、draw、Node、内部配管を除く |
| `./validate` | `./validate` | 置換 | closedな内蔵判定ではなく、`Rule` / `RuleSet` / `Profile` / `AssessmentReport` とrunnerのSPI |
| — | `./validate/builtin` | 新設 | 0.17.0の15判定を明示builtin rule packとして収容 |
| `./draw` | `./draw` | 維持 | `svgPlan` / `svgAxo` とoptions型だけ。root再輸出は廃止 |
| `./node` | `./node` | 維持 | `parseFile` / `parseFileWith`。唯一の`node:fs`入口 |
| — | `./model` | 新設 | Model型、同一性、分類、面積、canonical query |
| — | `./diagnostics` | 新設 | `checkDiagnostics`、診断型、コード台帳 |
| — | `./graph` | 新設 | `.muro`だけで閉じる隣接・通行・経路・境界線分 |
| — | `./form` | 新設 | `derive`、`Form`型群、導出定数と公差 |
| — | `./analysis` | 新設 | 外部context/profileを明示してModel/graph/Formを読む解析契約 |
| — | `./diff` | 新設 | `semanticDiff` と構造化差分型 |
| — | `./vocabulary` | 新設 | 属性台帳と語彙照会。editor/rule packがcore内部を写さないための入口 |
| `./examples/*` | `./examples/*` | 維持 | data。実行APIではない |
| `./syntax` | `./syntax` | 維持 | TextMate grammar data |
| `./package.json` | `./package.json` | 維持 | package metadata。0.17.0 API入口表には欠けているので0.18.0文書では明記する |

`/analysis/*` や `/form/*` のwildcardは置かない。明示していない内部ファイルがpackage面へ漏れる経路になるためである。

---

## 3. 実行時の値69件 — current → 0.18.0

### 3.1 parse / model の値

根拠: `src/index.ts:18-73`。`parse` / `parseWith` は読み込み出口でregionの正準化、凸片、既定境界まで導く (`src/core/parse.ts:87-119`)。したがってそれらの組立関数を別途公開しない。

| 現行値 | 0.18.0 | repository consumer / 証拠 | 判断 |
|---|---|---|---|
| `parse` | root維持 | 多数のcore tests、`eval/score.ts:24-39` | 唯一の文字列入口 |
| `parseFiles` | root維持 | composition/defaults/property tests | browser・仮想file setの正式入口 |
| `parseWith` | root維持 | `src/parse-file.ts:8,23` | loader差替えによる純粋な合成入口 |
| `tokenize` | 削除 | `test/core.test.ts`だけ。実装 `src/core/parse.ts:1160-1183` | lexer内部。parser契約ではない |
| `areaM2` | `/model` | CLI、MCP、derive/diff/light/site、eval、model/example tests | Modelから決まる基本量。法規上の床面積とは呼ばない |
| `canonicalBoundaryOrder` | 削除 | graph/derive/draw内部だけ | canonical/Form決定論の配管。`derive`が結果を返す |
| `columnsFor` | 削除 | derive/diagnose/validate内部、`test/runs.test.ts` | `derive(model).columns`と重複 |
| `DEFAULT_LANGUAGE_VERSION` | `/model` | parser、`test/release.test.ts` | 言語metadata。root基本loopには不要 |
| `displayName` | `/model` | CLI、MCP、draw | `name`→path fallbackという共通Model query |
| `effectiveUse` | `/model` | CLI、MCP、validate/access、design tests | zone継承を一箇所で答える |
| `heff` | `/model` | CLI、derive、diagnose、fabric | space→levelの高さ解決を一箇所で答える |
| `isCoveredAbove` | `/model` | derive、light | Modelだけで決まる被覆関係 |
| `isIndoor` | `/model` | derive、site、MCP、tests | koyuの分類。法規面積の算入判定とは区別して文書化 |
| `isOutside` | `/model` | core、CLI/MCP、validate、tests | `outside:1`という構成事実 |
| `isSemiOutdoor` | `/model` | core、CLI/MCP、validate、tests | graphから決まるkoyu分類 |
| `isVoid` | `/model` | core、CLI/MCP、validate、tests | `void:1`という構成事実 |
| `levelsSorted` | `/model` | CLI/MCP、derive/diagnose/fabric/vertical/validate | z順という共通query |
| `newUids` | `/model` | MCP、`test/identity.test.ts` | authoring用の明示API。rootからは外す |
| `pointInPolygon` | 削除 | diagnose、`test/polygon.test.ts` | 公開geometry集合が不完全。内部で維持 |
| `polyBounds` | 削除 | derive/draw、`test/runs.test.ts` | presentation/form内部。完全なgeometry APIを先に設計しない |
| `polygonAreaM2` | 削除 | derive/diff/site/MCP/validate、polygon/runs tests | site factsが必要量を返す。任意のpoly helperを凍結しない |
| `rectToPoly` | 削除 | derive/diagnose/graph内部 | 低水準geometry配管 |
| `SourceError` | root維持 | parser、CLI、eval、composition/core/conformance tests | parse失敗を型で識別する基本loop契約 |
| `srcRef` | 削除 | CLI/diagnose/graph、`test/diagnostics.test.ts` | 人向け位置文字列formatter。構造化位置はDiagnostic/Findingが持つ |
| `SUPPORTED_LANGUAGE_VERSIONS` | `/model` | parser/diagnose、`test/release.test.ts` | 言語metadata |
| `toCanonical` | root + `/model` | CLI/MCP/eval、多数のcontract tests | 基本loopとModelの機械出口の両方 |
| `unionAreaM2` | 削除 | site、`eval/score.ts` | evalは内部実装を使える。公開geometry断片を増やさない |
| `zoneAreaM2` | `/model` | CLI/MCP/eval/control、house/mansion/tower/compose tests | koyuの屋内集計。法規上の延床と混同しない名前・説明を付す |

### 3.2 diagnostics / graph の値

根拠: `src/index.ts:75-102`。構造診断とgraphはどちらも`.muro`だけで閉じるが、利用者と結果型が異なるため別入口にする。

| 現行値 | 0.18.0 | repository consumer / 証拠 | 判断 |
|---|---|---|---|
| `check` | 削除 | CLI/MCP、多数のtests。実装 `src/core/diagnose.ts:222-229` | code/位置を文字列へ落とすadapter。CLI formatterへ内部化 |
| `checkDiagnostics` | root + `/diagnostics` | CLI/MCP/eval/scripts、多数のcontract tests | 構造保証の唯一の機械入口 |
| `DIAGNOSTIC_CODES` | `/diagnostics` | diagnostics/docs/domain/guide tests | machine-readableな凍結台帳 |
| `deriveDefaultBoundaries` | 削除 | parser、`test/defaults.test.ts` | parseが常に実行する可変組立。二度呼ぶ外部面を作らない |
| `doorsBetween` | `/graph` | CLI/MCP/eval、core/defaults/design/example tests | 安定した経路query |
| `envelopeGaps` | `/graph` | validate/envelopeだけ | 合否ではなく線分を返す中立graph query。rule pack拡張に必要 |
| `neighbors` | `/graph` | CLI、core/defaults tests | 安定した隣接query |
| `passable` | `/graph` | validate/access | graphの辺分類。robot/simulation/rule packの基礎 |
| `placeBand` | 削除 | derive/diagnose内部 | 個別配置の低水準配管 |
| `placeOpening` | 削除 | derive/diagnose/validate/access、`test/core.test.ts` | 個別配置の低水準配管。外部は`Form.openings`を読む |
| `segmentsFor` | `/graph` | derive/diagnose/site、design/runs tests | boundary relationから導く中立線分 |

### 3.3 Form / fabric / vertical の値

根拠: `src/index.ts:104-162`。`src/core/derive.ts:540-545` は `derive` を「形の唯一の入口」と定義し、返る`Form`はcolumns、runs、slabs、plansを全て含む (`src/core/derive.ts:305-318`)。

| 現行値 | 0.18.0 | repository consumer / 証拠 | 判断 |
|---|---|---|---|
| `band` | 削除 | draw/plan、`test/draw.test.ts` | Formを紙へ写す内部primitive |
| `bandLine` | 削除 | `test/draw.test.ts`だけ | 内部primitive |
| `columnRect` | 削除 | draw/axoだけ | 内部primitive |
| `derive` | root + `/form` | draw、eval/control/run、多数のForm tests | 形の唯一の高水準入口 |
| `DERIVATION_CONSTANTS` | `/form` | derive/draw tests、form constants docs | 導出規則のmachine-readable台帳 |
| `levelPitch` | 削除 | `test/derive.test.ts`だけ | `derive(model).levels[].pitch`と重複 |
| `runPrism` | 削除 | draw/axo、`test/draw.test.ts` | 内部primitive |
| `thicken` | 削除 | draw/axo、`test/draw.test.ts` | 内部primitive |
| `TOLERANCES` | `/form` | `test/derive.test.ts`、form constants docs | 導出の公差台帳 |
| `slabs` | 削除 | derive、diagnostics/runs tests | `derive(model).slabs`と重複 |
| `RUN_KEYS` | 削除 | repository importなし | `ATTR_LEDGER`と`RunDevice`型で十分。二つ目の語彙台帳を作らない |
| `runDecls` | 削除 | diagnose/fabric内部 | typed attrsからrunを読む実装配管 |
| `runDrawsForLevel` | 削除 | derive、`test/runs.test.ts` | `derive(model).plans`と重複 |
| `runSolids` | 削除 | derive、`test/runs.test.ts` | `derive(model).runs[].solids`と重複 |
| `slopeText` | 削除 | CLI、draw/plan、validate/runs | 人向けformatter |
| `verticalRuns` | 削除 | CLI、derive、validate/runs、`test/runs.test.ts` | `derive(model).runs`と重複。builtin内部では計算実装を再利用可 |

### 3.4 analysis / diff / vocabulary の値

根拠: `src/index.ts:142-196`。現行の「数ならcore、閾値ならvalidation」という分離では、係数や算入方針を数の側へ固定できてしまう。実例として`daylightInputs`は覆われた半屋外へ0.7を固定適用する (`src/core/light.ts:12-14,35-66`)。`siteReport`は庇・バルコニー算入が粗いfootprintと、koyuの`isIndoor`を延床として返す (`src/core/site.ts:29-41,44-89`)。

| 現行値 | 0.18.0 | repository consumer / 証拠 | 判断 |
|---|---|---|---|
| `daylightInputs` | 置換 → `/analysis` | CLI/MCP/eval、validate/light、design/tower/eval tests | raw opening/exposure factsとversioned profile計算へ分割。旧0.7計算はbuiltin operation内で出力互換を保つが旧名は公開しない |
| `siteReport` | 置換 → `/analysis` | CLI/MCP/eval、validate/site、diagnostics/house/polygon/tower tests | site geometry/frontage factsとprofileによる算入面積へ分割。旧名は公開しない |
| `renderDiff` | 削除 | CLI、eval/run/score、diff/identity tests | 人向けformatter。`semanticDiff`の構造化結果を公開契約とする |
| `semanticDiff` | `/diff` | CLI、eval/run/score、band/diff/identity tests | 二つのModel間の独立した安定演算 |
| `ASSET_ELEM` | 削除 | diagnose内部だけ | assetをopening台帳で読む実装alias |
| `ATTR_LEDGER` | `/vocabulary` | grammar/identity/vocabulary tests、diagnose | 外部toolが写してはならない語彙正本 |
| `attrSpec` | `/vocabulary` | diagnose、`test/vocabulary.test.ts` | 要素・鍵のmachine query |
| `CARRY_NAMESPACE` | 削除 | repository importなし | RegExp実体を凍結せず`isNamespaced`だけを約束する |
| `isNamespaced` | `/vocabulary` | diagnose | 外部attribute/rule packの検査に必要 |
| `known` | 削除 | repository importなし | `attrSpec(elem,key) !== undefined`と重複 |

### 3.5 draw / validation の値

根拠: `src/index.ts:198-211`。現在のrootは凍らない面まで再輸出する。`validate(model)`は5 analyzerを固定順に実行し (`src/validate/index.ts:99-106`)、`ValidationRule`はbuiltin 15名だけのclosed unionである (`src/validate/index.ts:36-55`)。

| 現行値 | 0.18.0 | repository consumer / 証拠 | 判断 |
|---|---|---|---|
| `svgPlan` | `/draw` | CLI/MCP、draw/defaults/office/core/uncounted tests | 同名維持、root再輸出のみ廃止 |
| `svgAxo` | `/draw` | CLI、draw/runs tests | 同名維持、root再輸出のみ廃止 |
| `validate` | 置換 → `/validate` | CLI/MCP/eval/scripts、多数のvalidation tests | `validate(model,{rules,profile,context})`型の明示runnerへ置換。暗黙builtin全実行をしない |
| `VALIDATION_RULES` | 置換 → `/validate/builtin` | docs/domain/guide tests | `BUILTIN_RULES`または同等の明示rule pack metadataへ置換 |

以上で値は 28 (parse/model) + 11 (diagnostics/graph) + 16 (Form) + 10 (analysis/diff/vocabulary) + 4 (draw/validate) = **69件**である。

---

## 4. 型80件 — current → 0.18.0

型は同じ行先・同じ理由のものを束ねるが、0.17.0でroot公開される80名を全てこの節に綴る。

### 4.1 root / model

根拠: `src/index.ts:19,21-44`。

| 現行型 | 0.18.0 | consumer / 理由 |
|---|---|---|
| `LayerLoader` | root維持 | `parseWith`の署名 |
| `Model` | root + `/model` | 全高水準operationの入力 |
| `Area` | `/model` | `Space.areas` |
| `Asset` | `/model` | `Model.assets` |
| `Attrs` | `/model` | Space/Zone/Boundary等の公開構造、eval/control |
| `AttrValue` | `/model` | `Attrs`の値 |
| `Boundary` | `/model` | `Model.boundaries`、graph/Form入力 |
| `BoundaryKind` | `/model` | Boundary/FormBoundaryのkind |
| `Column` | `/model` | FormColumnの基底 |
| `ColumnDecl` | `/model` | `Model.columns` |
| `DrawnLine` | `/model` | Boundaryの宣言構造 |
| `Edge` | `/model` | opening/run方向 |
| `GridAxis` | `/model` | `Model.grid` |
| `GridRef` | `/model` | `Space.grids` |
| `Level` | `/model` | `Model.levels` |
| `Opening` | `/model` | `Boundary.openings` |
| `Pt` | `/model` | site/model/Formの共通座標型 |
| `Rect` | `/model` | Space/run/columnの共通領域型 |
| `Seg` | `/model` | Boundaryの宣言されたseg。`/graph`の`Segment`とは別 |
| `SitePolygon` | `/model` | `Model.polygons` |
| `Space` | `/model` | `Model.spaces`、ほぼ全queryの主体 |
| `Zone` | `/model` | `Model.zones` |

### 4.2 diagnostics / graph

根拠: `src/index.ts:75-102`。

| 現行型 | 0.18.0 | consumer / 理由 |
|---|---|---|
| `CheckResult` | 削除 | 削除する文字列adapter `check`だけの返り値 |
| `Diagnostic` | root + `/diagnostics` | `checkDiagnostics`の返り値、CLI JSON |
| `DiagnosticCode` | root + `/diagnostics` | Diagnostic.codeと台帳のclosed key |
| `Band` | 削除 | placement内部型 |
| `BandCode` | 削除 | placement内部型 |
| `BandError` | 削除 | placement内部型 |
| `PlacedBand` | 削除 | placement内部型 |
| `NeighborInfo` | `/graph` | `neighbors`の返り値 |
| `Route` | `/graph` | `doorsBetween`の返り値 |
| `Segment` | `/graph` | `segmentsFor` / `envelopeGaps`とFormBoundaryの線分 |

### 4.3 Form / vertical / fabric

根拠: `src/index.ts:104-162`。公開する型は`derive`が返す`Form`の到達可能な構造に限定する。

| 現行型 | 0.18.0 | consumer / 理由 |
|---|---|---|
| `DeriveOptions` | root + `/form` | `derive`入力 |
| `Form` | root + `/form` | `derive`返り値、eval/control |
| `FormBoundary` | `/form` | `Form.boundaries`、eval/control |
| `FormColumn` | `/form` | `Form.columns` |
| `FormInput` | `/form` | `Form.input` |
| `FormLevel` | `/form` | `Form.levels` |
| `FormOpening` | `/form` | `Form.openings` |
| `FormPanel` | `/form` | `FormBoundary.material.panels` |
| `FormPlan` | `/form` | `Form.plans` |
| `FormPrism` | 削除 | 削除する`runPrism`だけの返り値。Form本体に現れない |
| `FormRun` | `/form` | `Form.runs` |
| `FormSeg` | `/form` | `Form.segs` |
| `FormSite` | `/form` | `Form.site` |
| `FormSpace` | `/form` | `Form.spaces` |
| `FormSwing` | `/form` | `FormOpening.swing` |
| `PlanClass` | `/form` | `PlanEntity.class` |
| `PlanEntity` | `/form` | `FormPlan.entities`、draw/plan |
| `PlanRole` | `/form` | `PlanEntity.role` |
| `PlanSubject` | `/form` | `PlanEntity.of` |
| `Slab` | `/form` | `Form.slabs` |
| `SlabKind` | `/form` | `Slab.kind` |
| `RunArrow` | 削除 | 削除する`runDrawsForLevel`の内部構造 |
| `RunDecl` | 削除 | 削除する`runDecls`の返り値 |
| `RunDevice` | `/form` | `VerticalRun.device` |
| `RunDraw` | 削除 | 削除する`runDrawsForLevel`の返り値 |
| `RunForm` | `/form` | `VerticalRun.form` |
| `RunPart` | `/form` | `VerticalRun.parts` |
| `RunSolid` | `/form` | `FormRun.solids` |
| `Seg2` | `/form` | `PlanEntity.lines` |
| `VerticalRun` | `/form` | `FormRun`の基礎構造 |

### 4.4 analysis / diff / vocabulary

根拠: `src/index.ts:142-196`。

| 現行型 | 0.18.0 | consumer / 理由 |
|---|---|---|
| `DaylightInput` | 置換 → `/analysis` | `Space`本体と係数適用済み数を同居させる型を廃止。plain raw facts、profile result、evidenceへ分割 |
| `RoadFrontage` | 置換 → `/analysis` | `Space`本体を返さずroad ref + raw shared segment factsを返す |
| `SiteReport` | 置換 → `/analysis` | raw site factsとprofile-dependent metricsを別型にする |
| `BoundaryChange` | `/diff` | `ModelDiff.boundaries` |
| `BoundaryItem` | `/diff` | 構造化diff項目 |
| `ChangedItem` | `/diff` | 構造化diff項目 |
| `ColumnItem` | `/diff` | `ModelDiff.columns` |
| `FieldChange` | `/diff` | 各changed itemのfield差分 |
| `GridChange` | `/diff` | `ModelDiff.grid` |
| `ModelDiff` | `/diff` | `semanticDiff`返り値、`test/diff.test.ts` |
| `RenamedItem` | `/diff` | uidによるrename差分 |
| `SpaceItem` | `/diff` | `ModelDiff.spaces` |
| `AttrSpec` | `/vocabulary` | `ATTR_LEDGER` / `attrSpec`の値 |
| `AttrTier` | `/vocabulary` | `AttrSpec.tier` |

### 4.5 draw / validation

根拠: `src/index.ts:198-211`。

| 現行型 | 0.18.0 | consumer / 理由 |
|---|---|---|
| `PlanOptions` | `/draw` | `svgPlan`入力 |
| `AxoOptions` | `/draw` | `svgAxo`入力 |
| `Finding` | 置換 → `/validate` | 名前は維持可。ただしclosed rule unionとhuman messageだけの型から、namespaced rule ID、rule set/version、observed、required、unit、evidenceを持つopen contractへ移す |
| `ValidationRule` | 置換 → `/validate` | builtin 15名のclosed unionを廃止し、`RuleId` / `Rule` / `RuleSet`へ分割 |

以上で型は 22 (root/model) + 10 (diagnostics/graph) + 30 (Form) + 14 (analysis/diff/vocabulary) + 4 (draw/validation) = **80件**である。

---

## 5. 0.18.0で新設する契約

この節は新APIの完全な型定義ではなく、旧exportを何へ置換したと証明するための最低境界である。

### 5.1 `/analysis`

`/analysis` は「主題別の便利関数置場」ではなく、Model/graph/Formの事実へ外部contextとversioned profileを明示して解釈を加える面である。少なくとも次を分離する。

```text
raw facts       .muro / graph / Form だけで決まる。plain JSON、単位明示、丸め前
profile result  係数、算入、用途、管轄、基準日を明示
evidence        どのfactsとprofileから値を得たか
```

`daylightInputs`の置換は、window/opening ref、幅、高さ、隣接先、外部/半屋外、上部被覆、床面積をraw factsにし、0.7係数をprofileへ移す。`siteReport`の置換はsite polygon、site child、各階floor shape、road shared segmentをraw factsにし、footprint/total floorの算入をprofileへ移す。分析結果は`Space`、`Zone`、`Boundary`の可変本体を返さず、path/refとplain dataを返す。

### 5.2 `/validate` と `/validate/builtin`

`/validate` はglobal registryを持たない。runnerは呼出側が渡した`RuleSet`だけを実行する。最低限、次を公開契約にする。

```text
RuleId
Rule
RuleSet
Profile
ValidationContext
Finding
AssessmentReport
validate(model, { ruleSets, profile, context })
```

`/validate/builtin` は現行15規則を明示的に束ねる。CLI/MCP/examples gateがbuiltinを使うなら、その選択を呼出コードと文書に明示する。現行のrule IDは結果互換のため維持できるが、`ValidationRule`型を全世界のclosed unionにはしない。`Finding.level`の既定はrule metadataが持ち、`observed`、`required`、`unit`、`evidence`をmachine-readableにする。

---

## 6. repository consumer の全移行範囲

### 6.1 production / tooling consumers

静的importで確認したtest以外のconsumerは次で尽きる。

| consumer | 現在読む公開名 / 内部名 | 0.18.0移行 |
|---|---|---|
| `src/cli.ts:17-41` | diagnostics、diff、graph、light、validate、site、model query、node、draw、vertical | 新operationをdogfoodする。`check`/`renderDiff`/`slopeText`はCLI内部formatter、runsは`derive(model).runs`、light/site/validateはanalysis + builtin |
| `src/mcp.ts:11-33` | root一括、diagnostics、draw、site、node | root一括を廃止し、新subpath operationと同じstructured resultを返す。独自のareaMatch/ratio/閾値計算を残さない (`src/mcp.ts:328-350`) |
| `src/parse-file.ts:7-8` | `Model`, `parseWith` | `/node`実装としてmodel/rootの契約を使う。外部面は現行2名維持 |
| `src/validate/access.ts` | graph placement/passability、model query | builtin Rule群へ移す。`placeOpening`は内部利用可 |
| `src/validate/envelope.ts` | `envelopeGaps`、model分類 | builtin Rule。中立factsは`/graph` |
| `src/validate/light.ts` | `daylightInputs`、`finding` | analysis facts/profileを読むbuiltin Ruleへ置換 |
| `src/validate/runs.ts` | `verticalRuns`、`slopeText`、`finding` | internal Form derivation + builtin Ruleへ置換。message formattingをrule evidenceから分ける |
| `src/validate/site.ts` | `siteReport`、polygon/model helper、`finding` | analysis site facts/profileを読むbuiltin Ruleへ置換 |
| `src/validate/index.ts` | fixed analyzer list、closed ledger | generic SPIとbuiltin packへ分割。`finding`の偶発公開を止める |
| `src/draw/plan.ts:12-14` | derive primitives、model formatter | packageから削除するprimitiveを内部importし続けてよい。外部は`/draw`だけ |
| `src/draw/axo.ts:13-14` | derive primitives | 同上 |
| `eval/score.ts:23-39` | node + rootのmodel/diagnostic/analysis/graph/diff/validate | 新subpathへ移行。oracleの旧数値は0.17 baselineと同値に保つ |
| `eval/run.ts:45-49` | diff、derive、node | `/diff`、`/form`、`/node`へ移行。formatterは内部化 |
| `eval/control/export.ts:21-25` | Form、Model、zone area、node | `/form`、`/model`、`/node`へ移行 |
| `eval/control/oracle.ts:22-23` | model Pt、internal poly | public rule fixtureとは分ける。control内部geometry利用はpackage APIとは数えない |
| `scripts/gate.mjs:31-33` | diagnostics、node、fixed validate | `/diagnostics`、`/node`、明示builtin rule packへ移行 |

core内部の相互import (`derive`→fabric/graph/vertical、diagnose→graph/vertical/vocabulary等) はpackage consumerではない。公開削除後も実装モジュールのnamed exportを維持してよい。禁止するのは`package.json#exports`から到達する公開面への再流出である。

検索で得たcore内部のconsumerも省略せず記録する。これはsubpathへのimport移行対象ではなく、公開削除後も残る実装依存の台帳である。

| internal consumer | 読むもの |
|---|---|
| `src/core/derive.ts` | model query/types、graph placement/segments、`slabs`、vertical run/solid/draw、tolerances |
| `src/core/diagnose.ts` | model query/types、graph placement/segments、vertical declarations/issues、vocabulary ledger |
| `src/core/diff.ts` | model types、area/canonical helpers |
| `src/core/fabric.ts` | model classifications/geometry types、poly operations、vertical declarations、tolerances |
| `src/core/graph.ts` | model types/canonical helpers、poly operations、tolerances |
| `src/core/light.ts` | model classifications、area、Model/Space types |
| `src/core/model.ts` | `src/core/poly.ts` のgeometry operations |
| `src/core/parse.ts` | model constructors/types、region normalisation、graphのpiece/default-boundary導出 |
| `src/core/poly.ts` | modelの`Pt`/`Rect`型、tolerances |
| `src/core/site.ts` | model classifications/area/types、graph segments、poly union |
| `src/core/vertical.ts` | model types/level query、tolerances |

この内部依存は、0.18.0の入口を増やすためにpublic subpath経由へ迂回させない。public entrypointは外向きの面であり、core内の循環を作る配線ではない。

### 6.2 tests consuming the affected names

以下は現在のimportを実測した全test群である。内部algorithm testは内部module importを維持できるが、公開契約を主張するtestは新entrypointへ移す。

| 分野 | test files | 影響 |
|---|---|---|
| root/API/package | `test/public-api.test.ts`, `test/identity.test.ts`, `test/eval-harness.test.ts`, `test/release.test.ts` | root集合を12名へ変更。全12 JS subpathとdata 3 subpathをmachine manifestで集合検査。`newUids`、analysisのroot importを移す |
| parse/composition/canonical | `test/band.test.ts`, `test/canonical-property.test.ts`, `test/compose.test.ts`, `test/composition.test.ts`, `test/conformance.test.ts`, `test/defaults.test.ts`, `test/guarantees.test.ts`, `test/identity.test.ts`, `test/polygon.test.ts`, `test/uniqueness.test.ts` | rootに残る基本loopのcontract smokeを追加。内部helper testsは内部importのまま |
| diagnostics | `test/canonical-property.test.ts`, `test/composition.test.ts`, `test/conformance.test.ts`, `test/design2.test.ts`, `test/diagnostics.test.ts`, `test/docs-ledger.test.ts`, `test/domains.test.ts`, `test/guide.test.ts`, `test/identity.test.ts`, `test/runs.test.ts`, `test/vocabulary.test.ts` | structured APIへ統一。`check`文字列のassertはCLI formatter testへ移す |
| graph | `test/core.test.ts`, `test/defaults.test.ts`, `test/design2.test.ts`, `test/house.test.ts`, `test/mansion.test.ts`, `test/office.test.ts`, `test/runs.test.ts`, `test/tower.test.ts`, `test/uncounted.test.ts`, `test/vertical.test.ts` | public smokeは`/graph`。`placeOpening`/`deriveDefaultBoundaries`のalgorithm testsは内部contractとして残す |
| Form/fabric/runs/draw | `test/canonical-property.test.ts`, `test/conformance.test.ts`, `test/derive.test.ts`, `test/draw.test.ts`, `test/eval-control.test.ts`, `test/eval-harness.test.ts`, `test/runs.test.ts`, `test/uniqueness.test.ts`, `test/diagnostics.test.ts` | public smokeは`derive`/`Form`だけ。slabs/runs/primitives testsは内部実装testと明記 |
| low-level polygon | `test/poly.test.ts`, `test/polygon.test.ts` | `src/core/poly.ts` と削除する公開geometry断片のalgorithm test。新しいpublic geometry subpathは作らない |
| daylight/site/validation | `test/design2.test.ts`, `test/diagnostics.test.ts`, `test/domains.test.ts`, `test/guarantees.test.ts`, `test/guide.test.ts`, `test/house.test.ts`, `test/polygon.test.ts`, `test/runs.test.ts`, `test/tower.test.ts`, `test/eval-harness.test.ts` | raw facts、profile result、builtin Findingを別々に検査。0.17 CLI/MCP数値との互換fixtureを置く |
| diff | `test/band.test.ts`, `test/diff.test.ts`, `test/identity.test.ts` | `semanticDiff` public contractを`/diff`で検査。`renderDiff`はinternal/CLI testへ移す |
| vocabulary/grammar | `test/grammar.test.ts`, `test/identity.test.ts`, `test/vocabulary.test.ts`, `test/docs-ledger.test.ts` | `/vocabulary`の台帳と文書を集合一致。削除名のnegative importを追加 |
| draw | `test/core.test.ts`, `test/defaults.test.ts`, `test/draw.test.ts`, `test/office.test.ts`, `test/runs.test.ts`, `test/uncounted.test.ts` | `/draw` smoke。rootに`svgPlan`/`svgAxo`が無いことを検査 |
| node | `test/compose.test.ts`, `test/conformance.test.ts`, `test/derive.test.ts`, `test/diagnostics.test.ts`, `test/diff.test.ts`, `test/eval-control.test.ts`, `test/eval-harness.test.ts`, `test/release.test.ts`, `test/tower.test.ts`, `test/uniqueness.test.ts` | `/node` smokeとroot browser-safetyを分離 |

### 6.3 新たに必要な契約テスト

1. package manifestを唯一のmachine-readable export台帳にし、全entrypointの実行時値・型・`package.json#exports`・API文書を集合一致させる。
2. rootのnegative list: `validate`, `VALIDATION_RULES`, `svgPlan`, `svgAxo`, `parseFile`, graph、diff、vocabulary、全削除名が存在しない。
3. package内部pathを一切importしない外部fixtureが`RuleSet`を実装し、`/validate` runnerで実行できる。
4. global rule registryが存在せず、渡していないruleが実行されない。
5. analysis結果が`JSON.stringify`可能で、`Space`/`Boundary`/`Zone`本体を含まず、unit/profile/version/evidenceを持つ。
6. TS API、CLI `--json`、MCP structured resultが同じoperation IDと同じ意味を返す。
7. CLI/MCP sourceから独自閾値 (`1/7`, `2000`, `2400`等) と独自area算入をnegative scanする。
8. 0.17 baselineに対する全examplesのcanonical JSON/Form同値test。
9. packed tarballを空projectへ導入し、JS 12入口 + data 3入口をimport/readする。
10. root module graphに`node:fs`、`node:path`、validate、drawが入らない。

---

## 7. 文書への影響

### 7.1 同じ変更で書き換えるpublished documentation

| page / family | 必要な変更 |
|---|---|
| `docs/reference/api/index.md` | 4 JavaScript入口・flat 149名の表を廃止し、12入口とentrypoint別machine ledgerを現在形で説明。`./package.json`も列挙 |
| `docs/reference/scope.md` | 「coreは数、validationは線」という二分だけでなく、raw fact → profile analysis → rule assessmentの境界を定義 |
| `docs/reference/stability.md` | root、model/graph/Form/diagnostics/diff/vocabulary、analysis SPI、builtin pack、draw contentの各安定性を明記 |
| `docs/why/three-domains.md` | 三領域の説明を新しい依存方向へ更新。第二jurisdictionが来たら分離するという将来形を現在の分離へ書き換える |
| `docs/reference/validate/**` | builtin rule packの文書へ変更。generic SPI、profile、rule set、Finding evidenceを別に説明 |
| `docs/reference/cli/check.md` | TS APIは`checkDiagnostics`一つで、human formattingはCLI面であることを明記 |
| `docs/reference/cli/light.md` | raw facts、使用profile、builtin judgementを分ける。現行の「補正係数なし」とcoreの0.7適用の食い違いを解消 |
| `docs/reference/cli/site.md` | raw geometryとprofile-dependent footprint/total floorを分け、どのprofileを使ったか出力に含める |
| `docs/reference/cli/validate.md`, `docs/reference/validate/index.md` | builtin選択、rule set、context不足、result schemaを明記 |
| `docs/reference/mcp/**` | TS operationとの同値、profile/rule set、structured evidenceを明記。独自計算を記述しない |
| `docs/reference/form/**` | `derive`が唯一のpublic形入口であり、部分導出関数は公開しないことを反映 |
| `docs/reference/muro/attributes.md` | `/vocabulary`をmachine入口として案内 |
| `docs/reference/diagnostics/**` | `/diagnostics`をmachine入口として案内 |

公開文書からADR番号を根拠として引用しない。履歴と移行実測は本reviewと`docs/log/`、現在の契約だけをpublished docsに置く。

### 7.2 repository内部文書

- `AGENTS.md`: file map、公開entrypoint、MCP/CLI/APIの共通operation、変更時のgateを新境界へ更新する。
- `docs/log/2026-08-03.md`: 実装後に実測したexport差分、consumer移行、package smoke、canonical/Form比較、全gate結果を追記する。
- 本review: 実装中に判断を変えた場合は書き換えない。差分は作業logまたは新reviewに残す。本ファイルはPhase 0B時点の監査記録である。

---

## 8. 実装完了時の照合表

| 証拠 | 完了条件 |
|---|---|
| root面 | 値7件 (`parse`, `parseFiles`, `parseWith`, `checkDiagnostics`, `toCanonical`, `derive`, `SourceError`) と型6件だけ |
| 専門入口 | `/model`, `/diagnostics`, `/graph`, `/form`, `/analysis`, `/diff`, `/vocabulary`, `/validate`, `/validate/builtin`, `/draw`, `/node` が明示exportのみを持つ |
| package | JS 12 + data 3 subpathがbuild成果物を指す |
| 旧名 | 本監査で「削除」「置換」とした旧名をpacked packageからimportできない |
| consumers | §6.1の全consumerが新operationまたは明示内部実装へ移行済み |
| tests | §6.2の既存testを移行し、§6.3の新contract testがある |
| docs | §7.1が現在形で更新され、export manifestと集合一致する |
| 意味論 | canonical JSONとFormが0.17 baselineから不変。変更があるならAPI整理に混ぜず別の言語判断を行う |
| runtime | dependency zero、root browser-safe、Node built-inは`/node`だけ |
| gates | `npm test`, `npm run typecheck`, `npm run check:examples`, `npm run gate:examples`, `npm run gate:docs`, `npm run conformance`, 対象fileの`check`が全てgreen |

この照合を満たした時点で、0.18.0は「新入口を足した途中版」ではなく、不要な0.17面を撤去し、全repository consumerが一つの新しい契約へ移った1.0候補になる。
