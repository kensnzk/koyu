# koyu 0.18.0 — published documentation migration audit

日付: 2026-08-03

対象: 0.17.0 から、十二の TypeScript 公開入口と assessment protocol へ切り替える際の公開文書

性格: 実装・公開文書を変更する前の内部 review / work record。これは公開文書ではない。

## 0. 結論

公開対象は `test/guide.test.ts` と `website/scripts/prepare-content.mjs` が定める **153ページ**
である。全ページを走査した結果、既存 **97ページを更新**し、**11ページを追加**する必要が
ある。公開ページの削除は要らない。残る56ページは、muro の構文、構造診断、Form/JSON の
意味だけを扱い、今回の公開面変更後も現在の文が成り立つ。

公開文書に履歴的な「旧API一覧」や移行記録は置かない。公開文書は 0.18.0 の契約を現在形で
述べ、削除名は表から消す。current → next の対応と削除理由は、この review と API surface
audit にだけ残す。

最も大きい変更は import path の書換えではない。次の四つである。

1. package root は基本loopだけになり、領域別の能力は十一の明示subpathへ移る。
2. `daylightInputs` と `siteReport` が暗黙の係数・算入方針を持つcore queryではなくなり、
   `runAnalysis` が明示 `registry` / `profile` / `context` の下で `AnalysisReport` を返す。
3. `validate(model): Finding[]` と暗黙の全規則実行はなくなり、`assess` が同じ三つの明示入力の
   下で `AssessmentReport` を返す。builtinは明示的に選ぶcatalogである。
4. CLI `light` / `site` / `validate` と同名MCP toolも profile と context を必須にし、TSと同じ
   machine DTOを返す。旧ad-hoc JSONや `Finding[]` は返さない。

この変更は muro の意味、canonical JSON、Form の意味を変えない。したがって言語版と
canonical format版を動かす理由にはならない。

## 1. 監査の境界と方法

公開集合は次の九入口から再帰的に採った。

```text
docs/start/
docs/why/
docs/howto/
docs/reference/
docs/examples/
docs/glossary/
docs/index.md
docs/glossary.md
docs/roadmap.md
```

`docs/decisions/`、`docs/log/`、`docs/reviews/`、`docs/notes/`、`docs/img/` と、
`policy.md` 等の loose internal files は公開集合に含めていない。rootの `README.md` /
`README.ja.md` は `test/guide.test.ts` のcode-fence検査には入るが、今回変更するAPI名、profile、
context、旧判定DTOを記していないため変更不要である。

走査は次を組み合わせた。

- `src/index.ts` の現行149名と削除候補を全公開ページへ照合
- `@kensnzk/koyu` の import、公開subpath、`src/index.ts` を名指す箇所の抽出
- `daylightInputs`、`siteReport`、`validate(model)`、`Finding`、`VALIDATION_RULES` の抽出
- CLI/MCPの `light` / `site` / `validate` の引数、出力、exit/error contractの抽出
- builtin ruleの短い現行IDと、15件という手書き数の抽出
- `0.17.0`、Formの削除helper、`deriveDefaultBoundaries` の抽出
- 公開ページからADR、`docs/decisions/`、`spec/`へ権威を委譲していないかの確認

## 2. 公開文書が述べる最終契約

### 2.1 十二のJavaScript入口と三つのdata入口

`docs/reference/api/index.md` は次の十二件をJavaScript入口の全件として述べる。

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

data入口も同じ表に置く。

```text
@kensnzk/koyu/examples/*
@kensnzk/koyu/syntax
@kensnzk/koyu/package.json
```

wildcardの `/analysis/*`、`/form/*`、source directoryへのdeep importは公開しない。十二件は
directory一覧ではなく、利用者が意味と安定性を選ぶ契約一覧である。

rootの全契約は次だけである。

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

`/analysis`、`/validate`、`/validate/builtin` の最終export名は実装レビュー後に確定する。公開文書は
少なくとも `runAnalysis`、`assess`、`createAssessmentRegistry`、protocol DTO、builtin catalog /
profile valuesを載せ、最終的には全facadeの明示export集合と表をmachine set-equalityにする。

### 2.2 閉じた事実、profile付き解析、判定、presentation

公開文書は「coreが数を返しvalidationが線を引く」という二分を、次の境界へ書き換える。

| 面 | 入力 | 出力 | 言ってよいこと |
|---|---|---|---|
| model / diagnostics / graph / Form / diff / vocabulary | `.muro`から構成したModel（diffだけ二つ） | 構成事実、構造診断、graph、唯一のForm、差分 | sourceだけで閉じる事実 |
| analysis | readonly Model + local registry + explicit profile + dated/provenanced context | `AnalysisReport` / `AnalysisArtifact` | 測定、算入、経路、evidence、不足。pass/failは言わない |
| assessment | analysis evidence + context + explicit rules/profile | `AssessmentReport` | applicable outcome、pass/fail/indeterminate、rule error |
| presentation / adapters | 上記DTOまたはForm | 人向け文字列、SVG、transport | 意味を再計算しない |

`AnalysisArtifact.state` の `complete` は「宣言した入力が揃った」であって適合ではない。
`AssessmentReport.summary.state` の `complete` は「選んだ判定が完走した」であって全件passでは
ない。overall `ok` は置かない。core diagnostic、execution issue、rule outcomeは別の型・fieldの
まま保持する。`findings` はfail outcomeのprojectionであり、source of truthではない。

### 2.3 profileとcontextは全入口で必須

`runAnalysis` と `assess` は、どちらもcallごとに次を受ける。

- callerが構築したimmutableな `AssessmentRegistry`
- exactなprofile IDまたはID/revision ref
- ISO calendar dateとprovenanceを持つ `ContextSnapshot`

process-global default、今日の日付、path・room type・座標からの管轄推測、import-time registration、
last-registration-winsはない。required project inputの不足は `partial` / `unavailable` /
`indeterminate` であり、configuration errorとは分ける。

CLIでは三commandに、実装が確定するrequired spelling（計画上は `--profile <id>` と
`--context <snapshot.json>`）を必須にする。MCPでは三toolの `inputSchema.required` に
`profile` と `context` を置く。profile欠落はCLI exit 2、MCP invalid argumentsで、provider/rule
execution errorを含む妥当なincomplete reportはtransport errorにしない。

### 2.4 同じmachine DTO

次はdeep-equalである。

```text
TypeScript operation result
JSON.parse(CLI --json stdout)
MCP structuredContent
```

analysisは三入口とも `AnalysisReport`、assessmentは三入口とも `AssessmentReport` を返す。
CLIの人向け表示とMCP text blockはDTOから作り、係数、面積算入、閾値、rule順、summaryをadapterに
再実装しない。

## 3. 追加する公開ページ

全追加ページは現在形で完結させ、内部reviewやADRへリンクしない。

| 追加ページ | 現在 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/why/analysis-is-not-judgement.md` | 不在 | muroだけで閉じる事実、profile/context付きanalysis、rule outcomeの三段を、採光・敷地・経路の例で説明する | D, N |
| `docs/howto/run-an-assessment.md` | 不在 | context snapshotを作り、profileを選び、TS/CLI/MCPで同じreportを読む手順。pass、not-applicable、indeterminate、errorを区別する | G, C, M, N |
| `docs/howto/write-a-rule-pack.md` | 不在 | namespaced identity/revision、analysis provider、rule/rule set/profile、local registry、明示合成、外部I/O禁止の手順 | D, L, G, N |
| `docs/reference/analysis/index.md` | 不在 | `/analysis` の全公開名、`runAnalysis` のrequired options、profile reachability、`AnalysisReport` | A, L, N |
| `docs/reference/analysis/context.md` | 不在 | JSON-only value、`ContextSnapshot`、date/jurisdiction/provenance、context key decode、used-entryだけのreport trace | L, G, N |
| `docs/reference/analysis/artifacts.md` | 不在 | providerだけがDeepReadonly Modelを読むこと、dependency、complete/partial/unavailable、evidence/subject、deterministic order | D, L, G, N |
| `docs/reference/validate/registry.md` | 不在 | Rule/RuleSet/Profile/catalog、`createAssessmentRegistry` preflight、duplicate/revision/cycle/date/jurisdiction error、global registration禁止 | D, L, G, N |
| `docs/reference/validate/report.md` | 不在 | RuleEvaluation、四つのRuleRun.state、outcome/evidence、AssessmentReport、findings projection、complete/incomplete | L, G, C, M, N |
| `docs/reference/validate/builtin.md` | 不在 | `/validate/builtin` のcatalog values、各analysis/rule/rule set/profile identity+revision、purpose、required context、family pageへのledger | A, L, G, N |
| `docs/reference/cli/profile-and-context.md` | 不在 | 三command共通のrequired flags、context file、external catalog config、exit 2、JSON DTOの不変性 | C, G, N |
| `docs/reference/mcp/assessment.md` | 不在 | 三tool共通のrequired schema、startup時catalog、call時profile/context、structuredContent同値、invalid argsとincomplete report | M, L, N |

gate略号は §9 に定義する。

## 4. 更新する既存ページ — package / API / derivation

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/start/first-program.md` | `areaM2` / `isOutside` をrootからimportし、入口をrootとnodeの二つと説明 | root、`/model`、`/node`へimportを分ける。二入口ではなく「基本loop + 必要な領域」を説明する | A, G, N |
| `docs/howto/embed-in-a-program.md` | rootにmodel queries、暗黙`validate(model)`、`slabs`、`daylightInputs`、`siteReport`、`deriveDefaultBoundaries`がある | 十二入口の選択表、explicit assessment、profile付きanalysis、`derive(model).slabs`、canonical JSONはread-back入口でないことへ全面改稿 | A, D, G, N |
| `docs/howto/survive-a-rename.md` | `newUids`をrootからimport | `@kensnzk/koyu/model`からimport | A, G, N |
| `docs/howto/troubleshooting.md` | canonical consumerが`deriveDefaultBoundaries`を呼ぶ、旧light verdictと旧finding出力 | canonical JSONはread-back APIでない。high-level parse/graph/Formを使う。analysis/assessment例はprofile/context付きで実行 | A, G, C, N |
| `docs/reference/api/index.md` | 4 JS + 2 data入口、rootがwhole surface、149名、rootがvalidate/drawを再輸出 | 12 JS + 3 data入口、root最小13名、facade別values/types表、browser/Node境界、旧名なし | A, L, N |
| `docs/reference/identity.md` | `newUids`をrootからimport | `/model`のauthoring queryとして記す | A, G, N |
| `docs/reference/json/index.md` | consumerが公開`deriveDefaultBoundaries`を適用して意味を戻す | canonical JSONはcompositionの一方向出口。意味を問う正式入口は`.muro`→parseであり、削除helperを要求しない | A, G, N |
| `docs/reference/form/index.md` | `levelPitch`、`canonicalBoundaryOrder`、`thicken`、`bandLine`、`band`、`columnRect`、`runPrism`をpublic primitiveとして列挙 | 公開入口は`derive`と到達可能なForm型/定数だけ。pitch等はForm fieldsとして説明し、低水準関数名を契約から除く | A, L, G, N |
| `docs/reference/form/bodies.md` | `levelPitch`と`thicken`を公開query名で説明 | 同じ導出規則を現在形で説明するが、値の取得は`derive(model)`のFormから行う | A, G, N |
| `docs/reference/form/boundaries.md` | `passable` / `envelopeGaps`を文中で名指すだけ | APIとして使う箇所は`/graph`入口を明記。envelope gapの判定はbuiltin rule/profileへの依存として区別 | A, D, N |
| `docs/reference/form/constants.md` | 定数名だけを公開と記す | `DERIVATION_CONSTANTS` / `TOLERANCES` は `/form` から出ると記す。表と実装の既存数値同値testを維持 | A, L, N |
| `docs/reference/diagnostics/reading.md` | 削除する`check(model): {errors,warnings}`をcompatibility layerとして説明し、`"koyu"`からimport | `checkDiagnostics` / `DIAGNOSTIC_CODES`だけを`/diagnostics`からimport。rootからも得られるのは基本loop分だけ | A, L, G, N |
| `docs/reference/diagnostics/retired.md` | `Finding {rule,level}`と暗黙validateへ移った、と説明 | core codeがbuiltin assessment ruleへ移った歴史は保ちつつ、現在のmachine型をRuleRun/outcome/AssessmentFindingとして記す。ledger importは`/diagnostics` | L, G, N |
| `docs/reference/diagnostics/uid.md` | APIの`newUids`のみ名指し | `/model` subpathを明記 | A, N |
| `docs/reference/muro/column.md` | 削除する`columnsFor(model,"L1")`のprogram例 | `derive(model).columns`を`/form`から読む例に置換 | A, G, N |

## 5. 更新する既存ページ — architectureと情報設計

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/index.md` | `light`/`site`/`validate`を同じdescriptionからの無条件questionとして案内 | 「Model facts → profile付きanalysis → assessment」の入口と新how-toを案内 | N |
| `docs/glossary.md` | 三domain、Findingがprimary、15 rules、固定0.7係数、unprofiled light/site | analysis、context snapshot、profile、rule set、artifact、outcome、indeterminate、AssessmentReportを追加し、findingをprojectionへ変更 | L, D, N |
| `docs/glossary/japanese-building-terms.md` | 法規用語に対し`light`が無条件1/7、`site`が無条件算入を行う | 法規値はauthority/profile、案件値はcontext、算入結果はanalysis、比較はruleであるとする | L, N |
| `docs/roadmap.md` | current 0.17.0、旧public surface reviewが完了 | current 0.18.0、十二入口とassessment protocolの実装済み/未済を実態どおり現在形で記す | R, N |
| `docs/start/index.md` | tutorial終盤で引数なし`light`を実行し、1/7 verdictを得る | explicit builtin analysis profile/contextでfactsを読むか、named assessment profileでrule outcomeを読む | G, C, N |
| `docs/start/next.md` | validation=固定15 rules | generic assessment、explicit builtin pack、external rule pack、analysis volumeへの分岐を示す | L, N |
| `docs/why/index.md` | `site` / `validate`を暗黙の質問として例示 | 新説明ページをargument順に追加し、profileが意味の一部であることを示す | N |
| `docs/why/green-is-not-a-building.md` | fileだけのvalidateで旧finding文字列を返す | named builtin profile/contextのAssessmentReport由来の人向け出力を実走して載せる | G, C, N |
| `docs/why/ifc4-coverage.md` | frontage/FAR/daylightをsourceだけからの`site`/`light` derivationとする | raw geometryはModel/Form、算入法と外部条件を使う値はprofile付きanalysisであると分ける | D, N |
| `docs/why/open-vocabulary.md` | 旧lightの1/7 outputで「typeを読まない」を示す | coreがtypeを読まない事実は維持し、analysis/profileのpopulation/applicabilityを別に示す | G, C, N |
| `docs/why/resolution.md` | fileだけの`site` outputをschematic resolutionの証拠にする | 明示profileを伴うanalysis outputとして再実走し、coarsenessはprofileのclaimと記す | G, C, N |
| `docs/why/silence.md` | fileだけのvalidateがenvelope findingを返す | selected builtin rule/profileのoutcomeであり、rule未選択とpassを混同しない | G, C, N |
| `docs/why/source-and-derived.md` | daylight inputs、frontage、coverage ratioをすべてsourceから一意にderivedと分類 | source-closed factsと、context/profileで意味が決まるanalysis resultを別列にする | D, N |
| `docs/why/three-domains.md` | core/validation/presentation、validationは固定15 rules、Findingで区別 | core、assessment（analyses+rules+engine）、presentationの依存を示し、analysisとruleの内部一方向も記す | D, N |
| `docs/why/two-kinds-of-green.md` | Diagnostic対Finding[]、固定15 rules、core numbers対validation threshold | Diagnostic対AssessmentReport、complete対pass、not-applicable/indeterminate/error、profile/revision/evidenceを説明 | D, L, G, N |
| `docs/reference/index.md` | Diagnostics / Validation / CLI / MCP / APIだけ | Analysis volumeとgeneric assessment/builtin ledgerを別行で案内 | N |
| `docs/reference/not-held.md` | core returns numbers; validation draws lines | core facts、analysis evidence、rule outcomeの三段と、外部条件を`.muro`へ入れない理由へ更新 | D, N |
| `docs/reference/scope.md` | core questionsにdaylight/siteのpolicy値、validationはFinding/15 rules | source-closed guarantee、profile-dependent analysis、assessment outcomeを明確化。green checkの定義は維持 | D, L, G, N |
| `docs/reference/stability.md` | current 0.17.0、validation faceはversionなし | current 0.18.0、package API 12入口、component identity/revision、builtin packは非凍結、Form/canonical/language不変を説明 | R, A, N |

## 6. 更新する既存ページ — how-to

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/howto/index.md` | assessmentとrule packの手順がない | 新しい二how-toを「drive the tools」に追加 | N |
| `docs/howto/add-a-storey.md` | `doors`か暗黙`validate`を毎回実行 | `doors`はsource-closed、whole-model judgementはnamed profile/contextを伴う、と分ける | G, C, N |
| `docs/howto/agent-loop.md` | MCP light/site/validateはfileだけ、green後に無条件実行 | snapshot/profileを準備し、三toolへ毎回渡す。contextをagentが推測・取得しない | M, G, N |
| `docs/howto/by-symptom.md` | short rule IDとunprofiled commandを直接処方 | core symptom、analysis missingness、builtin outcomeを分け、profile identity付きの参照へ直す | L, C, N |
| `docs/howto/choose-dimensions.md` | fixed builtin thresholdsを`validate`/`light`の一般契約として使う | 数値はnamed schematic profileのconventionであるとし、実行例へprofile/contextを加える | G, C, N |
| `docs/howto/connect-storeys.md` | implicit builtin `run.*` / `stair.*` finding | selected builtin profileのrule outcome/evidenceとして再実走 | G, C, N |
| `docs/howto/debug-mcp.md` | tools/listは名前とschemaを返すが、三toolのrequired profile/contextを確認しない | schemaのrequired集合、missing profileのinvalid-arguments例、structuredContent DTOを実走して追加 | M, L, N |
| `docs/howto/describe-a-site.md` | site算入法を一つのcore derivationとし、旧site JSON/finding/exit policyを掲載 | raw site facts、profile算入analysis、rulesを分離。全commandをexplicit profile/contextで再実走 | G, C, L, N |
| `docs/howto/find-unreachable.md` | implicit validateが全spaceをsweepしFinding[]、violationだけexit 1 | graph queryとselected access ruleを分離し、AssessmentReport/新exit policyでCI例を更新 | G, C, N |
| `docs/howto/install-mcp.md` | server登録だけで全judgementが使える | builtin catalogのprofile IDと、外部packはserver startupで明示configすることを追加。callでmodule pathは受けない | M, N |
| `docs/howto/windows-and-daylight.md` | light自体が1/7 verdict、固定0.7、nothing-in-scope=exit 0 | daylight facts analysisとthreshold ruleを分離。profile/context、partial/unknown、not-applicableを説明 | G, C, L, N |
| `docs/howto/write-docs.md` | `muro-fail`/`muro-caution`を暗黙validateで検査し、`docs/decisions/`を公開文中で名指す | guide gateがexplicit builtin profile/contextでoutcomeを検査すると記す。公開文からinternal decision treeへの言及を除く | G, L, CANON, N |

## 7. 更新する既存ページ — CLIとMCP

### 7.1 CLI

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/reference/cli/index.md` | validate=`Finding[]`、light=1/7 verdict、site=unprofiled report、fileが常に唯一のrequired input | 三commandのrequired profile/context flags、analysis対assessment、machine DTO、config error exit 2を表とusageに反映 | C, L, G, N |
| `docs/reference/cli/check.md` | 同じfileをimplicit validateへ渡せば三finding | named profile/contextを伴うassessmentであるとする。check自体の契約は不変 | C, G, N |
| `docs/reference/cli/ci.md` | check+implicit validate、cautionは0、Finding[]を手でcount | context/profile fixtureをversion管理し、report summary/outcomes/model stateからgateする。failまたはincompleteのexit policyへ更新 | C, G, N |
| `docs/reference/cli/doors.md` | whole-model verdictはimplicit validate | doorsはgraph fact、whole-model ruleはselected access profileと記す | C, N |
| `docs/reference/cli/editor.md` | editor外のdaylightはunprofiled light | editorはcheckだけという事実を維持し、analysis/assessmentにはprofile/contextが必要と補う | C, N |
| `docs/reference/cli/graph.md` | verdictはimplicit validate | `/graph`/CLI graph factsとprofile-selected ruleを区別 | C, D, N |
| `docs/reference/cli/light.md` | 1/7を判定しcheckmark、固定係数、no scopeをpass-like exit 0 | explicit profileの`AnalysisReport` presenter。pass/failやthresholdを持たず、partial/unavailableとused context/evidenceを示す | C, L, G, N |
| `docs/reference/cli/runs.md` | derived dimensionsの判定をimplicit builtin rulesへ直結 | runs factsはsource-closed、rule outcomeはnamed builtin profileと記す | C, N |
| `docs/reference/cli/site.md` | 一つのrough footprint/FAR算入を無条件contractにする | explicit profileのsite analysis。profile identity、context、算入evidence、partial/unavailableを示す | C, L, G, N |
| `docs/reference/cli/stats.md` | FARはunprofiled site、verdictはimplicit validate | statsのindoor sumはModel query、regulatory/site aggregationはprofile analysis、limit comparisonはruleと分ける | C, D, N |
| `docs/reference/cli/validate.md` | file+`--json`、implicit 15 rules、Finding[]、cautionはexit 0 | required profile/context、AssessmentReport JSON、四RuleRun states、complete≠pass、fail/incomplete exit、config exit 2 | C, L, G, N |

### 7.2 MCP

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/reference/mcp/index.md` | 全toolはfile required、validate/light/siteもfileだけ、旧ad-hoc result | 三toolだけはprofile/contextもrequired。analysis/assessment structuredContent、startup catalog、標準loopを更新 | M, L, N |
| `docs/reference/mcp/install.md` | 0.17.0 initialize outputと旧instructions | 0.18.0の実走output、builtin profileの利用、external catalog moduleはstartup時のみ指定 | M, R, G, N |
| `docs/reference/mcp/protocol.md` | required引数表で三toolが`["file"]`、0.17.0 instructions | tools/list schemaを新required集合へ、missing profile/contextのinvalid args、structuredContent同値、0.18.0 outputへ更新 | M, L, R, G, N |
| `docs/reference/mcp/tools-ask.md` | lightは固定0.7 array、siteはad-hoc site object、file only | 両toolをprofile/context付きAnalysisReportへ置換。fact/evidence/missingnessを説明し、thresholdを除く | M, L, G, N |
| `docs/reference/mcp/tools-read.md` | site toolをfileだけで呼べば固定site areaを返す | site analysisはprofile/contextが必要とcross-referenceを修正。read tools自体は不変 | M, N |
| `docs/reference/mcp/tools-verify.md` | validateはfile-only、findings/counts/note object、旧15 rule ledger | profile/context付きAssessmentReport、四state、no overall ok、valid incomplete responseを説明 | M, L, G, N |

## 8. 更新する既存ページ — builtin rulesとその参照

最終builtin rule IDは実装レビュー後に確定する。公開ページでは常にexact `id` と `revision` を
示し、旧short spellingをmachine identityとして推測しない。もし人向け表示が短縮名を使うなら、
短縮表示であることを明記し、report fixtureには完全な `ComponentIdentity` を載せる。

### 8.1 builtin rule family pages

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/reference/validate/index.md` | generic validateと暗黙builtin 15-rule ledgerを一頁に混在 | `/validate` SPI/engineのindexへ改稿。builtin ledgerは`builtin.md`へ分離 | A, D, L, N |
| `docs/reference/validate/access.md` | 5 rulesをModel scan/Findingとして説明 | 各ruleのid/revision/level、required route analyses/context、applicability、outcome/evidence、builtin profileを記す | L, G, N |
| `docs/reference/validate/column.md` | collision Findingを直接生成 | column/opening analysis requirementとrule outcome/evidenceへ更新 | L, G, N |
| `docs/reference/validate/daylight.md` | fixed factor/1÷7が一つのvalidation実装、Finding二種 | exposure analysis profileとthreshold rulesを分離し、required context、partial/indeterminateを記す | L, G, N |
| `docs/reference/validate/envelope.md` | Modelを直接scanするcoarse Finding | envelope gap analysisとrule applicability/outcomeを分離 | L, G, N |
| `docs/reference/validate/runs.md` | fixed schematic thresholdsをimplicit validation rulesとして説明 | derived-run analysis、declared/context limits、rule identity/revision/evidenceへ更新 | L, G, N |
| `docs/reference/validate/site.md` | siteReport numbersと三ruleを直接結合 | raw site geometry、profile area/frontage analysis、rule comparisonを分離。required jurisdiction/date/contextを記す | L, G, N |

各rule sectionの `muro-fail` / `muro-caution` は残せるが、gateは固定のexplicit builtin registry /
profile / contextで `assess` を実行し、そのruleのfail outcomeがちょうど期待数あることを検査する。

### 8.2 diagnostics / Form pagesからの参照

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/reference/diagnostics/att.md` | `site:1`が旧site check/判定への直接入口 | attributeはModel factだけを宣言し、analysis/ruleのpopulationはprofileが解釈すると記す | D, N |
| `docs/reference/diagnostics/col.md` | `column.blocksdoor`へ直接案内 | exact builtin rule identity/profileへ案内 | L, N |
| `docs/reference/diagnostics/day.md` | light population、固定0.7、1/7 verdictを一続きで説明 | declaration、exposure analysis、threshold ruleを三分し、profile/contextを明示 | L, C, N |
| `docs/reference/diagnostics/hgt.md` | implicit validateのrun judgementsを列挙 | builtin profileに含まれるruleであり、core height diagnosticではないと記す | L, N |
| `docs/reference/diagnostics/index.md` | Diagnostic対Finding、15 rules、unprofiled light/validate | Diagnostic対AssessmentReport、builtin ledger、profile-required commandsへ更新 | L, G, N |
| `docs/reference/diagnostics/run.md` | retired codesからfile-only validate/findingへ誘導 | selected builtin profileのrule outcomesへ誘導し、実走例を更新 | L, G, C, N |
| `docs/reference/diagnostics/sit.md` | unprofiled site/validate、fixed 2m rule | site declaration、analysis availability、selected rule applicabilityを区別 | L, G, C, N |
| `docs/reference/diagnostics/ver.md` | missing daylight declarationを旧lightのpass-like空出力で説明 | current analysis reportのempty population/not-applicableを区別して説明 | L, C, N |
| `docs/reference/form/vertical-runs.md` | `stair.proportion`をshapeから直接生じる判定として参照 | Form factをanalysis evidenceが読み、selected ruleが比較すると記す | D, L, N |

### 8.3 muro referenceからの参照

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/reference/muro/attributes.md` | `daylight`/`site`を単一checkのon/offと説明 | coreが値域を解釈する契約と、profileがanalysis/rule populationを選ぶ契約を分ける | D, N |
| `docs/reference/muro/defaults.md` | omitted daylight/siteに旧light/site/validateの固定挙動 | Model defaultだけをnormとし、analysis/assessment側はnamed profileの挙動として記す | D, L, N |
| `docs/reference/muro/polygon.md` | polygonが旧site queryと二rulesへ直結 | polygonはgiven Model fact。どのsite analysis/ruleが読むかはprofileで選ぶ | D, L, G, N |
| `docs/reference/muro/space.md` | `daylight:1`がlightの1/7 testを直接起動 | declarationはcandidate populationのfactであり、applicability/thresholdはprofile/ruleとする | D, L, G, N |
| `docs/reference/muro/stack.md` | implicit validateの`run.disconnected`へ直結 | selected builtin profileのrule outcomeとして参照 | L, N |
| `docs/reference/muro/vertical-circulation.md` | file-only validateでfixed run findings | Form factsとbuiltin profile rulesを分離し、profile/context付きで再実走 | L, G, C, N |
| `docs/reference/muro/window.md` | window→fixed factor→1/7 judgementがpackage既定 | windowはModel/Form fact。factorはanalysis profile、thresholdはruleとする | D, L, G, N |
| `docs/reference/muro/zone.md` | site zone→一つのsiteReportと`site.area` | site markはModel fact、area reconciliation/ratio/ruleはexplicit profileへ移す | D, L, G, N |
| `docs/reference/muro/version.md` | 古い版の「daylight check」へ直接言及 | 言語上のpopulation declarationとして説明し、特定analysis/ruleの実行とは分ける | D, N |

## 9. 更新する既存ページ — examples

全outputは実装後に実際に走らせる。profileとcontext fixtureはexampleと一緒にversion管理し、文中で
exact profile identity/revisionを示す。

| ページ | 現在の記述 | 必要な現在形の契約 | 関連gate |
|---|---|---|---|
| `docs/examples/index.md` | 全bundled buildingがimplicit 15-rule validateをpass | named builtin profile/contextでの結果だけをclaimするか、pass claimを除く | G, L, N |
| `docs/examples/by-pattern.md` | validate/light/siteを引数なしの一般answerとして索引 | facts、analysis、assessmentの列へ分け、required profile/contextを示す | C, N |
| `docs/examples/basement.md` | `access.parking`と`run.slope`をimplicit validate結果として説明 | named builtin profileのoutcomeとして記す | G, L, N |
| `docs/examples/complex.md` | unprofiled siteと、`daylight:0`だけで法的applicabilityが決まる説明 | site analysis/profileを明記し、daylight declarationとrule applicabilityを分ける | G, C, N |
| `docs/examples/house.md` | unprofiled site/light、fixed coefficient、light verdict | profile付きanalysis resultへ置換し、threshold outcomeはassessmentとして別に示す | G, C, N |
| `docs/examples/mansion.md` | fixed 0.7 light calculationをpackage invariantとして実走 | named exposure profileのanalysis resultとして記す | G, C, N |
| `docs/examples/tower.md` | unprofiled site/light、fixed coefficient | exact profile/contextとanalysis identity/revisionを伴うoutputにする | G, C, N |
| `docs/examples/twin.md` | unprofiled site/validate、15 rules ran | site analysisとassessmentをexplicit profile/contextで再実走し、hand countを除く | G, C, L, N |
| `docs/examples/two-rooms.md` | light自体が1/7 verdict | analysis factsとselected threshold ruleを分ける | G, C, N |

## 10. ledger、domain、navigation gateの変更

略号は次のとおりである。

| 略号 | Gate |
|---|---|
| A | public API / package export-map set equality |
| L | diagnostics / builtin catalog / CLI / MCP / public-export docs ledger |
| D | domain dependency and type separation |
| G | published code fences, links, examples and CLI invocation gate |
| C | CLI arguments, JSON, exit codes and TS-operation equivalence |
| M | MCP inputSchema, structuredContent and TS-operation equivalence |
| R | implementation-version synchronization |
| N | prepared-content and navigation reachability |
| CANON | no ADR/spec/internal-authority reference |

### 10.1 `test/public-api.test.ts` と `test/public-api-subpaths.test.ts`

現行testはroot `src/index.ts` とAPI pageの一表だけを比較する。次へ置き換える。

1. `package.json#exports` からJavaScript 12入口とdata 3入口を採る。
2. 各facadeの明示export宣言をvalue/type別に採る。
3. 各facadeのruntime `Object.keys`、宣言集合、API pageの同じ入口の表をset-equalにする。
4. 全facadeで `export *`、duplicate、deep import漏れを拒否する。
5. rootを上記13名にexact-equalにする。
6. surface auditの削除候補が全該当facadeとpacked packageからimport不能であることをnegative testにする。
7. package export mapにある全subpathがAPI pageに現れ、文書だけの架空subpathもないことを双方向に見る。

現在の `test/public-api-subpaths.test.ts` が固定する model/diagnostics/graph/form/diff/vocabulary の
approved setを土台にし、analysis/validate/builtin/draw/node/rootを同じ形へ広げる。

### 10.2 `test/docs-ledger.test.ts`

- root一枚でなく十二facadeの全公開名を `docs/reference/api/index.md` と照合する。
- `VALIDATION_RULES` のclosed ledgerをやめ、`/validate/builtin` のcatalogからbuiltin analysis、rule、
  rule set、profileの `id` / `revision` を採る。
- `docs/reference/validate/builtin.md` の表とfamily sectionsをcatalogへset-equalにする。
- test名の「15件」等の手書き数を消す。数はfailure messageでruntime ledgerから出せる。
- MCP tool名だけでなく各 `inputSchema.required` を採り、`light` / `site` / `validate` に
  `file` / `profile` / `context` があることと、MCP referenceのarguments表を照合する。
- CLI subcommand集合は維持し、三commandのrequired flagsをimplementationのoption ledgerと文書へ
  set-equalにする。flag parserを正規表現で二重実装しないため、可能ならmachine option descriptorを置く。

### 10.3 `test/domains.test.ts`

現行のDiagnostic対Finding検査を次へ変える。

- coreはanalysis、validate、builtin、draw、nodeをimportしない。
- analysis contract/providerはvalidate rule実装をimportしない。
- generic validateはbuiltinをimportしない。builtinだけがanalysis/validateを一方向にimportする。
- Rule/RuleRunContextのpublic型からModelへ到達できず、AnalysisRunContextだけがDeepReadonly Modelを持つ。
- core Diagnostic、Analysis ExecutionIssue、RuleOutcome/AssessmentFindingのfield集合が交差して混同されない。
- mutable global registry、`registerRule`、import-time registration、pack scanが公開面に存在しない。

### 10.4 `test/guide.test.ts`

`muro-fail` / `muro-caution` は現在 `validate(model)`を暗黙に呼ぶ。固定のexplicit builtin registry、
analysis/profile、dated empty-or-fixture contextを用意し、`assess`で検査する。

- core errorが0であることは維持する。
- expected levelの**fail outcome**が一件以上あることを見る。
- family sectionはそのexact rule identity/revisionのoutcomeを期待数だけ出す。
- `Finding[]`の有無でpassを推測しない。
- published JSON blockの `AnalysisReport` / `AssessmentReport` はJSON parseだけでなくprotocol validatorと
  canonical round-tripにも通す。
- 実行例のCLI invocationにrequired profile/contextが無ければ落とす。

### 10.5 CLI/MCP operation equivalence tests

文書の根拠になるmachine testsを追加する。

- direct TS operation = CLI JSON = MCP structuredContentをanalysis/assessment双方でdeep-equalにする。
- profile/context欠落はCLI exit 2 / MCP invalid argumentsで、provider/ruleを一度も呼ばない。
- provider/rule exceptionはstackを漏らさずvalid incomplete reportになり、transport errorにならない。
- human output/text blockは既存DTOだけをrenderし、analysis/ruleを再実行しない。
- CLI/MCP sourceに0.7、1/7、2m、area inclusion、rule ordering、summary countingの複製がない。

### 10.6 navigation と canonicality

追加ページに合わせて `website/sidebars.js` を更新する。

- Whyのargument順に `analysis-is-not-judgement` を入れる。
- How-to orderに `run-an-assessment` と `write-a-rule-pack` を入れる。
- Referenceに `Analysis` group (`reference/analysis/`) を追加し、Validation groupより前に置く。
- `docs/reference/index.md`、`docs/howto/index.md`、`docs/why/index.md`、`docs/index.md`から新入口へリンクする。

sidebar自体はtreeから導出されるため、`website/scripts/check-navigation.mjs` の変更は不要である。
`npm run gate:docs` が、追加した全ページのreachable/danglingを検査する。

## 11. ADRを公開文書から参照しない規則の確認

公開treeを生成して次を実行し、現状は0件だった。

```sh
npm --prefix website run prepare:content
npm --prefix website run gate:canonical -- --strict
```

結果は `no-adr-mention`、`no-adr-link`、`no-spec-mention`、`no-spec-link`、
`no-delegation-prose`、`no-rendered-external` の全て0である。

ただし `docs/howto/write-docs.md` は plain codeとして `docs/decisions/` を名指しており、現行gateの
patternはこれをADR mentionとして数えない。AGENTS.mdの「published docsはADRを参照しない」を文字どおり
満たすため、この一文も今回削る。新しい公開ページは「ADR-0054で決めた」「decision recordを参照」と
書かず、このreviewで準備した契約をそのページ自身の現在形で述べ切る。

## 12. 変更不要と判定した56ページ

次は全て実際に監査した。出現する `validate` の多くは `check` が現在表示する固定文の引用、または
安定した隣接ページへのリンクだけであり、API名、profileless operation、旧DTO、固定analysis policyを
契約にしていない。muro/diagnostic/Form/canonical semanticsも今回変わらない。

```text
docs/examples/office.md
docs/examples/vs-ifc.md
docs/howto/split-into-layers.md
docs/howto/subdivide-a-unit.md
docs/howto/typical-floors.md
docs/howto/uncounted-divisions.md
docs/howto/write-as-built.md
docs/reference/cli/axo.md
docs/reference/cli/diff.md
docs/reference/cli/json.md
docs/reference/cli/layers.md
docs/reference/cli/levels.md
docs/reference/cli/plan.md
docs/reference/diagnostics/bnd.md
docs/reference/diagnostics/geo.md
docs/reference/diagnostics/lin.md
docs/reference/diagnostics/lvl.md
docs/reference/diagnostics/opn.md
docs/reference/diagnostics/ref.md
docs/reference/diagnostics/seg.md
docs/reference/diagnostics/suf.md
docs/reference/diagnostics/syn.md
docs/reference/diagnostics/vrt.md
docs/reference/diagnostics/zon.md
docs/reference/form/plan.md
docs/reference/form/regions.md
docs/reference/json/schema.md
docs/reference/mcp/tools-write.md
docs/reference/muro/area.md
docs/reference/muro/asset.md
docs/reference/muro/band.md
docs/reference/muro/boundary.md
docs/reference/muro/composition.md
docs/reference/muro/door.md
docs/reference/muro/grid.md
docs/reference/muro/import.md
docs/reference/muro/index.md
docs/reference/muro/level.md
docs/reference/muro/line.md
docs/reference/muro/lines.md
docs/reference/muro/name.md
docs/reference/muro/orientation.md
docs/reference/muro/over-drop.md
docs/reference/muro/positions.md
docs/reference/muro/seg.md
docs/reference/muro/slab.md
docs/start/install.md
docs/why/bim-ifc-usd.md
docs/why/boundary-is-a-relation.md
docs/why/composition-is-for-time.md
docs/why/dsl-not-yaml.md
docs/why/form-must-be-unique.md
docs/why/paths.md
docs/why/plan-is-not-a-section.md
docs/why/space-is-primary.md
docs/why/vs-ifc.md
```

`docs/howto/install-mcp.md` と `docs/reference/muro/version.md` は初回機械抽出ではこの群に入ったが、
前者はexternal catalogのstartup設定、後者は旧「daylight check」とanalysisの用語分離が必要なので
更新群へ移した。したがって **97更新 + 56不変 = 153既存ページ** で漏れはない。

## 13. 削除する公開ページ

**なし。**

理由は三つである。

1. `docs/reference/validate/index.md` はgeneric assessmentのindexへ再利用できる。
2. 既存rule family pagesはbuiltin catalogの詳細ページとして現在形に更新できる。
3. CLI `light` / `site` / `validate` とMCP同名toolは廃止せず、profile-required adapterへ意味を狭める。

旧API名の一覧を残すdeprecated pageも追加しない。0.18.0の公開文書に旧名が出れば、それは移行案内
ではなく再び約束のように読まれる。migration mappingはunpublished review/logだけが持つ。

## 14. 実施順

1. analysis/assessment facadeとbuiltin catalogの最終export名、profile ID/revision、CLI flag spelling、
   MCP schemaを実装で確定する。
2. API/export-map/docs ledger testsを先に新契約へ切り替える。
3. analysis reference 3ページ、validate referenceの新規3ページと改稿するindex、API indexを書く。
4. CLI/MCP referenceを同じoperation DTOへ切り替え、実際のoutputを採る。
5. generic architecture pages、how-to、rule family pages、examplesの順に書き換える。
6. 全旧名、旧Finding[] shape、profileless invocation、固定policy wordingをnegative scanする。
7. `website/sidebars.js` と四indexを更新し、全gateを通す。

公開文書migrationの完了条件は次である。

```sh
npm test
npm run typecheck
npm run check:examples
npm run gate:examples
npm run gate:docs
npm run conformance
npm run build
```

加えてpacked packageから十二入口をpositive importし、削除候補をnegative importする。analysisとassessment
のdirect TypeScript result、CLI JSON、MCP structuredContentがdeep-equalであること、全published pageから
ADR/spec/internal authorityへの参照が0であることを、同じ完了証拠に含める。
