# ADR-0054: 解析と建築判定を再現可能な assessment protocol で接続する

- 状態: 採用
- 日付: 2026-08-03
- 対象: `@kensnzk/koyu/analysis`、`@kensnzk/koyu/validate`、CLI、MCP

## 文脈

公開面を muro の事実、外部条件を受ける解析、規則による判定へ分けても、その間を渡る値と失敗の意味が定まらなければ、外部 rule pack、CLI、MCP は別々の解釈を持つ。とくに裸の finding 配列は、全件合格、対象なし、情報不足、解析失敗、模型の不整合を空配列一つへ潰す。

一方、規則へ `Model` を渡せば、各 rule pack が面積、経路、外皮、採光を再実装する。解析が process-global な台帳へ登録されれば、import 順と過去の call が現在の結果を変える。日付または管轄を暗黙に補えば、同じ入力が実行日や機械によって違う判定になる。

必要なのは、模型を読む権限、解析を読む権限、判定を述べる権限を型で分け、案件情報不足と実装失敗を異なる状態で残し、TypeScript、CLI、MCP が同じ JSON を返す protocol である。

## 決定

### 1. protocol を越える動的な値は JSON に限定する

context、解析値、evidence、rule evaluation、report と transport DTO に現れる値は、次の再帰型だけとする。

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
```

`undefined`、`Map`、`Set`、`Date`、function、symbol、`NaN`、正負の infinity は境界検査で拒否する。extension definition の純粋な実行関数は registry の実装値として存在できるが、artifact、evaluation、report、CLI JSON、MCP structured result には現れない。

全 component と context key は次の identity を持つ。

```ts
interface ComponentIdentity {
  id: string;
  revision: string;
}
```

`id` は `^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$` に合う小文字の namespaced ID とする。`id` は継続する概念、空でない `revision` はその実行可能な意味を同定する。一つの registry に同じ `id` の複数 revision を置かず、report は常に両方を記録する。

### 2. 外部条件は日付と provenance を持つ ContextSnapshot にする

外部条件を `.muro` や現在時刻から推測しない。呼出側は案件ごとに snapshot を渡す。

```ts
interface ContextSource {
  kind: "authority" | "survey" | "brief" | "user" | "import" | "other";
  ref: string;
  observedAt?: string;
  retrievedAt?: string;
}

interface ContextEntry {
  value: JsonValue;
  source: ContextSource;
}

interface ContextSnapshot {
  schema: "koyu-context/1";
  asOf: string; // YYYY-MM-DD; required
  jurisdiction?: JurisdictionRef;
  values: Record<string, ContextEntry>;
}
```

`asOf` は timestamp でなく ISO calendar date であり、engine は今日の日付を補わない。profile と rule set が effective range または jurisdiction を宣言する場合、call 開始前に exact match を検証する。省略 field は wildcard ではない。

analysis と rule は、definition が宣言した namespaced context key だけを `ContextReader` から読める。key 自身が JSON 値を pure に decode する。必須 entry の欠落または不正は案件情報不足であり、analysis を `unavailable`、rule を `indeterminate` にする。snapshot 自体が非 JSON、`asOf` が不正、key definition が衝突する場合は構成エラーとして実行前に止める。

report は実際に要求または読取った entry と provenance だけを key 順で写し、無関係または機微な entry を丸ごと反射しない。

### 3. analysis は readonly Model から AnalysisArtifact を作る

`Model` を受け取れる extension は analysis provider だけである。provider が見る型は再帰的な `DeepReadonly<Model>` とし、built-in provider は実行前後の canonical snapshot が一致する試験で非変更を保証する。runtime deep-freeze を security boundary とはしない。

analysis definition は identity、model consistency 要件、依存 analysis、context requirements を先に宣言する。provider は宣言した依存と context だけを restricted reader から読める。未宣言の `get` は execution error である。

解析値は `JsonValue` に限り、返り値は次の discriminated union とする。

```ts
type AnalysisArtifact<T extends JsonValue> =
  | { state: "complete"; value: T; evidence: Evidence[] }
  | {
      state: "partial";
      value: T;
      missing: [MissingInput, ...MissingInput[]];
      evidence: Evidence[];
    }
  | {
      state: "unavailable";
      missing: [MissingInput, ...MissingInput[]];
      issues: [ExecutionIssue, ...ExecutionIssue[]];
    };
```

`complete` は provider が宣言した入力を満たしたことだけを意味し、適合を意味しない。`partial` は有用な部分値と不足を持つ。`unavailable` は値を持たない。後二者の `missing` は空にできない。analysis result は identity、artifact、evidence と provenance を失わない。

依存 requirement は `complete` だけを受けるか `partial` も受けるかを宣言する。必要な依存が得られない、required context が無い、または `model: "consistent"` の provider に core error がある場合、provider を呼ばず `unavailable` を作る。core warning は実行を止めない。

### 4. rule は Model でなく、宣言した analysis と context だけを見る

rule には `Model` を渡さない。`RuleRunContext` が公開するのは、definition で宣言した `AnalysisArtifact` と context key の restricted reader だけである。これにより面積、経路、幾何の意味は analysis に一つだけ存在し、rule pack は閾値と適用条件へ集中する。

rule は namespaced id と revision、固定の level、必要 analysis、必要 context、authority citation を宣言する。level を状況で変える必要がある場合は別の rule ID にする。

rule の返り値は次の三つである。

```ts
type OutcomeStatus = "pass" | "fail" | "indeterminate";

type RuleEvaluation =
  | {
      applicability: "not-applicable";
      reason: string;
      evidence: Evidence[];
    }
  | {
      applicability: "indeterminate";
      reason: string;
      missing: [MissingInput, ...MissingInput[]];
      evidence: Evidence[];
    }
  | {
      applicability: "applicable";
      outcomes: [RuleOutcome, ...RuleOutcome[]];
    };
```

対象母集団が空なら `not-applicable` であり、空の applicable result ではない。applicable rule は一件以上の outcome を返し、各 outcome は `pass`、`fail`、`indeterminate` のいずれか、stable subject ref、一件以上の evidence を持つ。partial analysis を受けると宣言した rule は、判明した対象の pass / fail と未確定対象の indeterminate を同時に返せる。

report 上の rule state は **`evaluated`、`not-applicable`、`indeterminate`、`error` の四つだけ**とする。

- `evaluated`: applicable evaluation を正常に完了した
- `not-applicable`: rule 自身が対象外と判断した
- `indeterminate`: 必要情報または受理可能な analysis が足りず、結論へ到達できなかった
- `error`: rule implementation または返却 protocol が失敗した

`not-assessed` という曖昧な state は採らない。実行できなかった理由は expected missingness なら `indeterminate`、実装失敗なら `error` へ分ける。

### 5. namespaced subject と evidence で結論を追跡可能にする

artifact と outcome は mutable な model object を埋め込まず、model、level、space、zone、boundary、opening、run、site または extension の namespaced kind から成る `SubjectRef` を使う。evidence は subject、source、`producedBy: ComponentIdentity` を持つ。

組込 evidence は少なくとも fact、単位つき comparison、route、geometry、missing を区別する。数値比較は finite な observed quantity、operator、required quantity を machine-readable に持ち、理由を message の読解へ委ねない。authority citation と model/context provenance も source として保持する。extension evidence kind は namespaced JSON object とし、組込 spelling を上書きしない。

### 6. catalog から局所的で immutable な AssessmentRegistry を作る

analysis definition、rule set、profile は side effect で登録せず、package が export する catalog value として合成する。

```ts
interface AssessmentRegistry {
  readonly analyses: readonly AnalysisDefinition<JsonValue>[];
  readonly ruleSets: readonly RuleSet[];
  readonly profiles: readonly Profile[];
}

function createAssessmentRegistry(catalog: {
  analyses: readonly AnalysisDefinition<JsonValue>[];
  ruleSets: readonly RuleSet[];
  profiles: readonly Profile[];
}): AssessmentRegistry;
```

ここで `registry` は **caller が構築して call ごとに明示する、検証済みの immutable catalog value** の名である。再利用可能な値ではあるが、process へ install されない。禁止するのは module-level mutable singleton、`register` / `unregister`、import-time registration、`node_modules` scan、last-registration-wins である。局所的な registry value と forbidden global registration を同じものとして扱わない。

rule set は目的、任意の jurisdiction/effective range、宣言順の rules を持つ。profile は exact な analysis refs と rule-set refs を宣言順で列挙する。国、地域、会社の rule set を自動継承または merge せず、例外も明示した別 profile として表す。array の宣言順は実行順であり、override 順ではない。

`createAssessmentRegistry` と各 call の profile resolution は、最初の provider または rule を呼ぶ前に全体を検査する。

1. ID、revision、date range、context-key definition を検証する。
2. 同じ registry 内の duplicate ID を、revision が同じでも違っても拒否する。
3. analysis dependency、profile の analysis/rule-set ref、rule の analysis ref を exact revision で解決する。
4. analysis graph の直接・間接 cycle を完全な cycle path と共に拒否する。
5. profile が選んだ複数 rule set の duplicate rule ID を拒否する。未選択同士の重複は、その二つを同時に選ぶまでは許せる。
6. rule が要求する analysis が profile から到達可能であることを検証し、隠れた provider を許さない。
7. profile、rule set、`ContextSnapshot.asOf` と jurisdiction の一致を検証する。

duplicate、missing reference、revision mismatch、cycle、date/jurisdiction mismatch は `AssessmentConfigError` として preflight で止まり、部分 registry または途中 report を返さない。これらと、案件の required context が欠けている状態を混同しない。

### 7. provider と rule の例外を report の error に変換する

registry または public protocol value が不正な場合だけ、実行開始前の configuration error として throw する。実行開始後の provider / rule exception は engine が捕捉し、stack または任意の thrown object を漏らさず error name と安全な message だけを記録する。

provider exception、不正な artifact、非 JSON 値、重複 evidence ID は、その analysis の `unavailable` と `execution-error` になる。依存 consumer は通常の unavailable dependency として扱う。rule exception、不正な evaluation、空の applicable outcomes、重複 outcome ID、evidence の無い fail は、その rule run の `state: "error"` になる。どちらも pass または architectural fail を捏造せず、他の独立した実行と transport の応答を止めない。

### 8. AssessmentReport を唯一の判定契約にする

`assess` は、選択した判定の完全な機械契約として次を返す。

```ts
interface AssessmentReport {
  schema: "koyu-assessment/1";
  profile: ComponentIdentity;
  ruleSets: ComponentIdentity[];
  model: {
    languageVersion: string;
    name?: string;
    state: "consistent" | "inconsistent";
    diagnostics: Diagnostic[];
  };
  context: ContextSnapshot;
  analyses: AnalysisResult<JsonValue>[];
  rules: RuleRun[];
  findings: AssessmentFinding[];
  summary: {
    state: "complete" | "incomplete";
    rules: {
      evaluated: number;
      notApplicable: number;
      indeterminate: number;
      error: number;
    };
    outcomes: { pass: number; fail: number; indeterminate: number };
  };
}
```

`rules` とそれが参照する evidence が authoritative である。`findings` は fail outcomes だけを決定的順序で平坦化した convenience projection であり、source of truth ではない。core diagnostics、execution issues、architectural outcomes は互いの field 名と意味を保ち、一つの finding 配列へ混ぜない。

report に overall `ok` を置かない。`summary.state: "complete"` は選択した評価を最後まで行えたことだけを意味し、全件 pass を意味しない。fail があっても report は complete になりうる。`not-applicable` だけでも complete である。core error、rule/outcome の indeterminate、provider/rule error が一つでもあれば incomplete である。build を止める条件は consumer または adapter が fail count、indeterminate、model state、rule level から選ぶ。

### 9. assess と runAnalysis の両方に明示 profile を必須とする

公開する pure operation は次の二つである。

```ts
interface AssessmentOptions {
  registry: AssessmentRegistry;
  profile: ProfileRef | string;
  context: ContextSnapshot;
}

function assess(model: Model, options: AssessmentOptions): AssessmentReport;

interface RunAnalysisOptions {
  registry: AssessmentRegistry;
  profile: ProfileRef | string;
  context: ContextSnapshot;
}

function runAnalysis<T extends JsonValue>(
  model: Model,
  analysis: AnalysisRef<T>,
  options: RunAnalysisOptions,
): AnalysisReport<T>;
```

**`runAnalysis` にも profile を必須とする。** profile を受けない分析 shortcut は公開しない。指定 analysis はその profile が明示した analysis から到達可能でなければならず、profile の effective range、jurisdiction、context contract を `assess` と同じ preflight で検査する。rule を走らせない analysis-only profile は ruleSets を空にして明示的に定義できる。

string profile は registry 内の exact ID を指す。一 registry 一 revision の不変条件があるため曖昧にならない。`ProfileRef` は revision も照合する。profile の省略、未知 ID、revision mismatch は work 開始前の configuration error である。

### 10. 実行順、cache、出力順を決定的にする

`assess` と `runAnalysis` は同じ per-call `AnalysisSession` を使う。session は `checkDiagnostics(model)` を一度だけ実行し、空の analysis cache を持つ。cache key は resolved analysis identity であり、一 call の中で共有 dependency を一度だけ実行する。別 call、別 model、別 profile と cache を共有しない。

依存 analysis は depth-first で definition の宣言順に評価する。report の順序は次で固定する。

| Collection | Order |
|---|---|
| model diagnostics | core の scan order |
| rule sets | profile declaration order |
| rules | rule-set declaration order |
| analyses | dependency post-order、同列は dependency declaration order |
| outcomes | `RuleOutcome.id` の code-point order |
| evidence | `Evidence.id` の code-point order |
| findings | rule order、次に outcome order |
| report context keys | key の code-point order |

`localeCompare`、外部 JSON object の insertion order、filesystem order、registration history、machine clock を tie-breaker に使わない。同じ Model、registry、profile、ContextSnapshot は byte-identical な JSON を返す。

### 11. TypeScript、CLI、MCP は同じ operation DTO を返す

filesystem を扱う共通 operation layer が file を `Model` にし、上の pure operation を一度だけ呼ぶ。assessment と analysis の operation input は、どちらも `file`、明示 `profile`、`context` を持ち、analysis 側だけ `analysis` ref を追加する。

TypeScript operation の返り値、CLI JSON を parse した値、MCP `structuredContent` は、それぞれ `AssessmentReport` または `AnalysisReport` と deep-equal でなければならない。transport 専用 field の追加、field の省略、verbosity による machine DTO の形の変更をしない。CLI の人向け表示と MCP text block は DTO から作る presentation であり、analysis または rule を再実行しない。

profile の欠落を CLI は exit 2、MCP は invalid arguments として work 前に返す。provider/rule execution error を含む妥当な incomplete report は transport error ではなく成功した structured response であり、CLI の終了方針は report から導く。CLI と MCP は閾値、面積算入、rule 順、summary を再実装しない。

## 棄却した代替案

**`validate(model): Finding[]` を拡張し続ける。**棄却する。空配列が pass、対象外、情報不足、解析失敗、模型不整合を区別できず、適用 profile と revision も残らない。

**rule が readonly Model を直接読む。**棄却する。readonly は再実装を防がず、rule pack ごとに面積、経路、幾何の意味が分岐する。Model を読む権限は analysis だけに置く。

**`runAnalysis` だけは profile を省略できる。**棄却する。公開 analysis operation 全てが明示 context/profile を要求する境界に穴を開け、algorithm revision、effective date、jurisdiction の選択が再び暗黙になる。

**registry という語を避けるため catalog を global singleton にする。**棄却する。問題は名称でなく mutable global state である。caller が渡す immutable registry/catalog value は許し、process へ install する registration は許さない。

**global `registerRule()`、自動 pack discovery、last registration wins を使う。**棄却する。import 順と process 履歴が構成になり、duplicate が黙って override され、同時に異なる案件を扱えない。

**profile を国、座標、room type、現在日付から推測し、rule set を国・地域・会社の順に自動 merge する。**棄却する。法的な適用と例外は一般的な継承ではなく、同じ source が日または機械で異なる結果になる。profile は exact sequence を明示する。

**案件情報不足も exception にする。**棄却する。不足は通常の設計状態であり、partial、unavailable、indeterminate として report に残す。throw は不正な registry または malformed protocol value に限る。

**provider/rule exception を call 全体から throw する、または fail に変える。**棄却する。前者は独立した結果と MCP 応答を失い、後者は programming failure を建築的違反へ捏造する。analysis unavailable / rule error として report に残す。

**rule state に `not-assessed` を置く。**棄却する。入力不足、前提解析の不足、実装失敗を区別できない。`indeterminate` と `error` に分ける。

**report に overall `ok` を置く。**棄却する。fail、caution、indeterminate、model warning をどこまで gate するかは consumer policy であり、protocol が一つの真偽へ潰さない。

**CLI と MCP の response shape を最適化し、別 DTO にする。**棄却する。transport code が第二の意味実装になり、field と状態が入口ごとに失われる。同じ machine DTO を使い、表示だけを変える。

**rule/provider の中で network、filesystem、dynamic import、現在時刻を読む。**棄却する。再現性と byte determinism を壊す。外部取得は実行前に終え、dated/provenanced `ContextSnapshot` と明示 catalog にする。

## 帰結と代償

extension author は analysis、context key、rule、rule set、profile を明示し、全 component に namespaced id と revision を付ける。小さな rule pack にも記述量が増えるが、他 pack と安全に合成でき、どの executable meaning が結論を出したかを report だけから復元できる。

caller は analysis 単体でも registry、profile、context を渡す。即席の一行呼出しは長くなる一方、暗黙の jurisdiction、日付、algorithm、global registration が無くなり、試験、並行 request、長寿命 MCP process が同じ条件で動く。

rule は Model を直接読めないため、新しい問いには先に analysis contract が必要になる。代わりに計算は一 call 一回へ cache され、TS、CLI、MCP、複数 rule pack が同じ結果を共有する。

report は finding 配列より大きい。完全性、対象外、未確定、実行失敗、根拠、profile、revision を失わないことが増加分であり、UI は `findings` projection を使って簡潔に表示できる。

同期、JSON-only、外部 I/O なしという制約により、rule 内で直接データ取得はできない。connector または adapter が先に取得し、snapshot を作る。将来 worker または async acquisition を使う場合も、この pure protocol の外側を包む。

## 証拠と受入条件

次をすべて機械的に実証するまで protocol の実装を完了としない。

### Identity、registry、preflight

- valid な独立 pack を一つの局所 immutable registry value に合成でき、元 array の後続変更または import 順で内容が変わらない
- unnamespaced/invalid ID、空 revision、同一または別 revision の duplicate ID、conflicting context key を拒否する
- missing analysis/rule-set/profile reference と revision mismatch を work 前に拒否する
- direct/indirect analysis cycle を完全な cycle path つきで拒否する
- selected rule sets 間の duplicate rule ID と profile から到達不能な required analysis を work 前に拒否する
- invalid effective range、`asOf` mismatch、jurisdiction mismatch を work 前に拒否する
- public registration API、module-level mutable registry、import-time registration、pack discovery が存在しないことを source/API negative scan で固定する
- 二つの registry/profile を同一 process で交互・並行・逆順に実行しても互いの結果が変わらない

### Context と JSON boundary

- required/optional context の present、missing、invalid を別々に round-trip し、全使用 entry の provenance を report に残す
- unused context entry を report に写さず、二 component が同じ key を読んでも一 entry に正規化する
- 非 JSON、`undefined`、`Map`、`Date`、`NaN`、infinity、不正 date を実行前または返却境界で拒否する
- snapshot に現在日付、locale、path、環境変数から値を補う経路が無い

### Analysis

- complete、non-empty missing を持つ partial、値を持たない unavailable を型と runtime の両方で区別する
- provider だけが `DeepReadonly<Model>` を受け、rule の public context から Model へ到達できない
- undeclared dependency/context access を execution-error にする
- shared dependency は一 call で一度だけ実行し、別 call/model/profile と cache を共有しない
- required dependency/context/model consistency の precondition が失敗した provider を呼ばない
- provider exception、不正 artifact、非 JSON result を unavailable/execution-error にし、stack を DTO に含めない
- built-in provider の前後で canonical model が一致する
- `runAnalysis` の profile を型/runtimeの両方で必須にし、missing/unknown/mismatched profile と profile から到達不能な analysis を work 前に拒否する

### Rules と report

- applicable pass、applicable fail、empty population の not-applicable、missing input の indeterminate、rule exception の error を別の `RuleRun.state` で round-trip する
- `RuleRun.state` の集合が `evaluated | not-applicable | indeterminate | error` と一致し、`not-assessed` が実装・schema・fixture に存在しない
- applicable result の空 outcomes、duplicate outcome/evidence ID、evidence の無い fail を rule error にする
- fail と indeterminate outcome の混在、partial analysis を明示受理する rule を実行できる
- fail だけなら complete、not-applicable だけでも complete、model error/indeterminate/provider-rule error があれば incomplete になる
- core diagnostics、execution issues、rule outcomes を別の型として保持し、findings が fail outcomes の決定的 projection と一致する
- `AssessmentReport` と `AnalysisReport` が JSON round-trip し、overall `ok` field を持たない

### Determinism と三入口同値

- 同じ Model、registry、profile、context の反復実行が byte-identical JSON を返す
- reverse order で返された outcomes/evidence、異なる context object insertion order、異なる locale が canonical order を変えない
- dependency post-order、profile/rule declaration order、diagnostic scan order、code-point sort を期待値で固定する
- direct TypeScript operation の DTO、CLI JSON、MCP `structuredContent` を assessment と analysis の双方で deep-equal にする
- CLI/MCP の profile 省略は exit 2 / invalid arguments となり、provider/rule error は transport error でなく妥当な incomplete report になる
- CLI/MCP に独自の閾値、面積算入、rule 順、summary、analysis implementation が無いことを dependency test と negative scan で固定する

### Domain と配布

- core は analysis/validate を import せず、rule implementation は Model を import/受領しない
- 外部 fixture pack が package 内部 path を使わず、公開 analysis/validate contract だけで registry、profile、analysis、rule を実行できる
- packed package から `analysis`、`validate`、`validate/builtin` と共有 DTO を import できる
- runtime dependency はゼロのままであり、typecheck、単体試験、外部 fixture、package smoke、examples、documentation gate、conformance の全 gate が成功する

実行 command、byte comparison、exception fixture、registry matrix、CLI/MCP 同値結果は作業ログに置く。公開文書は本 ADR を参照せず、この protocol の現在の契約を自己完結して説明する。
