# ADR-0055: 既存の建築判定を法適合判定ではなく明示的な schematic rule pack として移す

- 状態: 採用
- 日付: 2026-08-03
- 対象: koyu core 0.18.0 の built-in analysis、rule、rule set、profile

## 文脈

旧 `validate(model)` は十五の failure-only 判定を常に実行する。採光比、一部の階段寸法、接道長には法令または慣行を想起させる定数があるが、管轄、基準日、用途別の適用条件、例外、行政解釈を入力しない。他の判定も `.muro` の自由な type 語や `use:` から運用上の意図を推測する。したがって旧実装をそのまま `jp.bsl.*` のような法令 namespace へ移すと、数値上の概略確認を法適合判定として過大に表明する。

0.18.0 の目的は、既存の有用な早期検討を失わずに、事実を作る analysis と結論を述べる rule を分離し、明示 profile の下で再現可能にすることである。この切替の中で暗黙に適用条件を追加すると、API 移行と判定意味の変更を区別できない。

また旧 `run.slope` は、一つの名前で二つの別の意味を扱う。ramp は `.muro` に設計者が書いた許容勾配との比較であり、escalator は実装内の慣用帯との比較である。根拠も将来の revision も別なので、一つの rule identity を共有させる理由がない。

## 決定

### 1. built-in 判定は schematic design lint とする

旧判定を `koyu.schematic.*` namespace の built-in rule pack へ移す。`jp.bsl.*` その他の法令・管轄 namespace は使わず、法適合、確認申請適合または網羅的な code screening を名乗らない。

rule set と profile は次の identity とする。revision はいずれも `"1"` とする。

```text
koyu.ruleset.schematic-screen@1
koyu.profile.schematic-screen@1
```

rule set の `purpose` は `design-lint` とし、jurisdiction と effective range は持たない。rule の authority citation は、実際の適用条件と根拠を protocol 上で表せない限り空とする。定数と比較は machine-readable evidence に残すが、それ自体を法令上の結論とは呼ばない。

呼出側はこの非管轄 profile にも `ContextSnapshot` を明示する。互換移行に必要な context value は無いため、標準 fixture は固定した `asOf` と空の `values` を渡す。engine が日付または profile を補うことはない。

### 2. 六つの analysis が事実を一度だけ計算する

built-in catalog は次の六 analysis を持つ。すべて revision `"1"`、`model: "consistent"`、required context key なしとする。

```text
koyu.analysis.envelope
koyu.analysis.daylight
koyu.analysis.vertical-runs
koyu.analysis.access
koyu.analysis.door-column-collisions
koyu.analysis.site
```

analysis は対象母集団、幾何、距離、面積、経路、欠落入力、provenance を返す。`pass`、`fail`、rule level、旧 rule ID、法適合 summary は返さない。CLI と MCP は同じ provider を呼び、採光比、敷地面積許容差、接道長、経路または勾配を再計算しない。

### 3. access の現行 type/use 推論を revision 1 で保存する

`access.throughtenant` と `access.backofhouse` は、外部の経路権限 context を新設せず、旧実装が使う `.muro` の type 語と `use:` による母集団・回避条件を `koyu.analysis.access@1` に保存する。person、void 回避、rentable 回避、vehicle、common/backyard 回避という異なる traversal を一つへ丸めない。

この選択は、type/use 推論が一般に運用上の真実であるという主張ではない。0.18.0 の parity profile が何を観察したかを evidence と analysis revision で明示し、暗黙だった仮定を追跡可能にするための決定である。

### 4. `run.slope` を二つの rule に分ける

旧 `run.slope` は次の二 rule へ一対多で移す。

```text
koyu.schematic.ramp.declared-slope@1
koyu.schematic.escalator.usual-slope@1
```

前者は正の `slope:` が宣言された ramp だけを対象に、導出勾配と案件内の宣言値を比較する。後者は escalator だけを対象に、既存の慣用帯を比較する。別の対象が無い場合、それぞれ独立に `not-applicable` となる。

残る十四の旧 ID は `koyu.schematic.<old-id>@1` へ一対一で移す。したがって built-in rule set は合計十六 rule である。二つの勾配 rule は旧 `run.slope` の位置に ramp、escalator の順で隣接させ、他は旧 ledger の章順を保つ。

### 5. 移行は意味の変更を混ぜずに完了させる

旧 fixture の母集団、level、fail subject、比較値、境界の包含・除外を parity 契約とする。新 protocol では失敗だけでなく、対象があれば各 subject の pass/fail/indeterminate を明示し、対象が無ければ `not-applicable` とする。

旧 validation 実装が残っている間に同じ `.muro` を旧新両経路へ通す一時的な parity oracle を置き、十五の旧 failure fixture と追加の境界 fixture を比較する。oracle が成功した後、旧 `validate(model)`、`VALIDATION_RULES`、`Finding` 契約、旧 ID、adapter 内の重複計算を 0.18.0 の同じ変更から削除する。互換 wrapper または deprecated alias は残さない。

この変更は muro の記法、canonical JSON または `Form` の意味を変えないため、muro language version は上げない。

## 棄却した代替案

**採光比と接道長だけを `jp.bsl.*` にする。** 棄却する。旧実装は条文の適用条件と例外を入力せず、法的な rule identity が表す範囲を実行できない。

**access に外部の route-permission context を直ちに必須化する。** 棄却する。現在の fixture が一斉に indeterminate となり、API 移行と判定意味の変更が混ざる。明示 context を使う別の analysis/rule revision は、この parity revision と同一視しない。

**旧 `run.slope` を一 rule のまま namespaced にする。** 棄却する。設計者の宣言値と内蔵慣用値は根拠も対象も異なり、片方だけを改訂できない。

**旧 finding が無いことを新しい pass とみなす。** 棄却する。旧関数の沈黙は対象なし、全件合格、入力不足を区別しない。新 rule は対象母集団を明示的に列挙して状態を返す。

## 帰結

0.18.0 の built-in 判定は、使える範囲と限界が名前から判別できる。koyu の neutral analysis は外部 rule pack から再利用でき、法令に基づく rule pack は jurisdiction、effective range、authority、必要 context を独自 identity で追加できる。

旧十五 ID は公開面から消え、十六の namespaced rule になる。とくに `run.slope` の consumer は二つの rule outcome を読む必要がある。access の現行 heuristic と既存定数は revision 1 の evidence と試験に固定されるが、法令または運用事実として保証されない。

## 証拠と受入条件

- 十五の既存 triggering fixture が対応する新 rule の fail outcome を一件ずつ作り、旧 level、subject、観測値、要求値と一致する
- ramp と escalator の fixture が別 rule を作り、rule set の総数が十六である
- 全 rule について pass、not-applicable、必要入力不足、provider/rule error が architectural fail と区別される
- daylight、stair、ramp、escalator、vehicle door、door/column、envelope gap、site containment、site area、frontage の境界値を試験が固定する
- 六 analysis の JSON artifact に verdict field、rule ID、法適合 summary が無い
- built-in catalog/profile は immutable value であり、import-time registration と process-global mutable registry が無い
- CLI、MCP、scripts、eval、skills、examples と全 repository test が明示 registry/profile/context へ移る
- repository scan が旧 ID、旧 `validate(model)`、`VALIDATION_RULES`、旧 `Finding` contract、adapter 内の重複閾値をゼロと示す
- bundled examples の canonical JSON と `Form` fingerprint が変更前と一致する
- TypeScript、CLI JSON、MCP structured result が同じ assessment/analysis fixture で一致する

実行 command、旧新対応、fixture 結果、境界 scan と全 gate の実測値は作業ログに記録する。公開文書は本 ADR を参照せず、schematic 判定の現在の契約と限界を自己完結して記述する。
