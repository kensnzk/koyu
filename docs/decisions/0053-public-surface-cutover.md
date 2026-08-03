# ADR-0053: 公開面を十二の入口へ切り替え、解析と判定を分ける

- 状態: 採用
- 日付: 2026-08-03
- 対象: koyu core 0.18.0 の TypeScript API、CLI、MCP

## 文脈

現在の package root は、`.muro` を読む処理、模型から導く事実、建築的判定、描画、低水準の部品を一つの面から再輸出している。利用者は一つの import で何でも得られる一方、その名が muro の意味として守られるのか、外部条件に依存する解析なのか、入れ替え可能な判定なのかを import から見分けられない。root に名を足すことが、そのまま別領域の契約を増やしている。

採光、敷地、経路、形状について、模型だけから答えられる事実と、法令、管轄、基準日、用途、外部資料を適用して初めて出せる結論は異なる。面積、開口量、接道長、最短経路は事実である。「足りる」「適合する」「違反である」は、どの根拠をどの条件で適用したかを伴う判定である。前者に後者を混ぜれば muro の意味が管轄ごとに揺れ、後者から条件を省けば同じ呼出しが何を判定したのか再現できない。

拡張のために module-level の規則台帳へ `register` する形も採れない。import 順、試験の実行順、同一 process で先に扱った案件によって次の結果が変わり、CLI、長寿命の MCP server、並行 request の間で規則が漏れるからである。規則パックは明示的な値として渡せば足りる。

koyu core 0.18.0 は公開前の 0.x で公開面を切り替える版である。新旧二面を残すと、古い入口を使う新規 consumer が 0.18.0 の後にも増え、1.0.0 で同じ切替費用をもう一度払うことになる。

## 決定

### 1. TypeScript の公開入口を十二に固定する

JavaScript / TypeScript の公開入口は次の十二だけとする。

| 入口 | 責務 |
|---|---|
| `@kensnzk/koyu` | `.muro` を読む、構造整合性を確認する、標準的な導出へ進むための最小 facade |
| `@kensnzk/koyu/model` | `Model` と、模型だけから答える基本的な問い |
| `@kensnzk/koyu/diagnostics` | `.muro` の構造整合性を読む診断 |
| `@kensnzk/koyu/graph` | 隣接、通行可能性、経路、境界 segment という graph の事実 |
| `@kensnzk/koyu/form` | 同じ模型から一意に導く `Form` |
| `@kensnzk/koyu/analysis` | 明示された context と profile の下で作る、判定前の解析結果 |
| `@kensnzk/koyu/diff` | 二つの模型の意味上の差分 |
| `@kensnzk/koyu/vocabulary` | 属性台帳と、muro が解釈する語彙 |
| `@kensnzk/koyu/validate` | 規則の SPI、規則集合の実行、`AssessmentReport` |
| `@kensnzk/koyu/validate/builtin` | koyu が同梱する規則、規則集合、profile |
| `@kensnzk/koyu/draw` | `Form` の presentation |
| `@kensnzk/koyu/node` | filesystem など Node 固有の adapter |

この十二は source directory の一覧ではなく、利用者が選ぶ契約の一覧である。`package.json` の export map、機械可読な公開面台帳、実装、型宣言、公開文書はこの集合と一致しなければならない。列に無い深い import は公開しない。

root は全 subpath の短縮形ではない。root に置くのは標準ループを始める最小 facade と、その署名に不可欠な型だけである。`model`、`graph`、`form`、`analysis`、`validate`、`draw`、`node` などの領域別の名を root から再輸出しない。領域の機能が必要な利用者は、その領域を名指して import する。

### 2. muro だけで閉じる面を判定から隔離する

root、`model`、`diagnostics`、`graph`、`form`、`diff`、`vocabulary` は、`.muro` とそこから構成された `Model` だけで意味が閉じる。二つの模型を受ける `diff` を除き、同じ入力は外部の法令、地域設定、時刻、process の状態に左右されず同じ事実を返す。

この領域の不変条件は次のとおりである。

- `diagnostics` が言う error / warning は、原本を一意に読めるかという構造整合性であり、建築的な適否ではない
- `graph` は経路、距離、通行可能性を返しても、それが避難経路として適法かという結論を返さない
- `form` は形を導くが、その形が基準を満たすとは言わない
- `model` と `vocabulary` は管轄、法令、基準日、内蔵規則を知らない
- これらの入口は `analysis`、`validate`、`validate/builtin`、`draw`、`node` に依存しない

`draw` は presentation であり、模型または `Form` の意味を変更しない。`node` だけが Node builtin へ依存できる。root と残る十の browser-safe な入口から `node:fs`、`node:path` その他 Node 固有処理を引かない。

### 3. analysis は明示 context / profile の下で事実だけを返す

`analysis` の全 operation は、対象模型に加えて context と versioned profile を呼出しごとに明示して受ける。context は、管轄、基準日、用途、方位、気象、敷地外条件など、その解析に必要な外部の与件を運ぶ。profile は、解析手法、その版、必要入力、選択した algorithm を同定する。必要な入力を省略した overload、暗黙の current jurisdiction、process-wide default profile は置かない。

解析結果が持てるのは、測定値、導出過程を追える evidence、入力と profile の identity、provenance、不足入力または不確かさである。解析結果は `pass` / `fail`、`compliant` / `non-compliant`、違反 level、総合 verdict を持たず、規制値との比較を最終結論として行わない。**analysis は判定材料を作るが、判定権限を持たない。**

同じ模型でも、異なる context または profile は異なる解析結果を返しうる。その差はすべて引数と結果の provenance に現れなければならず、隠れた process state に置かない。

### 4. validate だけが AssessmentReport を返す

建築的な適否を述べる公開 operation は `validate` に置く。`validate` は明示された profile、規則集合、context と解析 evidence を使い、結果を必ず `AssessmentReport` として返す。真偽値、裸の finding 配列、最も重い level だけを公開契約にしない。

`AssessmentReport` は少なくとも次を失わない。

- 適用した profile の id と version
- 適用した各 rule set と rule の id と version
- 管轄と基準日を含む、判定を再現する context の identity
- 各 rule の outcome と、その根拠になった analysis evidence への対応
- `pass`、`fail`、`not-applicable`、`not-assessed` を混同しない結果
- 不足入力、実行不能、rule 自体の error を、適合扱いせずに表す状態
- 個別結果から機械的に導く summary

`@kensnzk/koyu/validate` は外部 rule pack が実装する SPI と実行器を持つが、内蔵規則を暗黙には登録も実行もしない。内蔵規則と内蔵 profile は `@kensnzk/koyu/validate/builtin` に隔離する。したがって generic validation が builtin に依存することはなく、依存は `validate/builtin` から `validate` と `analysis` への一方向になる。

### 5. mutable global registry を置かない

規則、規則集合、profile は immutable な値として組み立て、各 validation call へ明示して渡す。公開 API に `registerRule` / `unregisterRule`、暗黙の singleton registry、import しただけで規則を追加する副作用を置かない。内蔵規則も同じ SPI を使う明示的な rule pack であり、特権的な別経路を持たない。

この不変条件により、同じ入力集合の結果は call 順に依存せず、異なる profile の判定を同一 process で並行または交互に実行しても互いを汚染しない。外部 rule pack の追加は core、analysis、他の pack の変更を要求しない。

### 6. CLI と MCP の法規判定にも profile を必須とする

CLI と MCP が規則に基づく validation を行うときは、profile を呼出し側が明示しなければならない。内蔵 profile を黙って選ばず、所在地、ファイル名、locale、環境変数から管轄を推測しない。profile が無い呼出しは、CLI では usage error、MCP では invalid arguments として判定開始前に止める。

構造整合性だけを見る `check` は profile を要求しない。analysis だけを呼ぶ operation は context と analysis profile を明示する。regulatory validation の出力は TS、CLI JSON、MCP structured result のどの入口でも、使用した profile と rule set の identity を含む同じ `AssessmentReport` の意味を返す。CLI と MCP は閾値、面積算入、rule の順序、summary を独自に再実装しない。

### 7. 0.18.0 で一度に切り替える

十二入口への移行、root の縮小、新しい analysis / validation 契約への移行、不要 API の削除を 0.18.0 の一変更として完遂する。

repository 内の TS、CLI、MCP、scripts、eval、skills、examples、editor support、tests は全て新入口と新契約へ移す。旧 root export、旧 subpath、旧 validation の返り値、旧規則台帳、重複した解析経路、不要になった実装は削除する。deprecated alias、互換 wrapper、旧新を選ぶ flag、二重の JSON schema は置かない。互換面の削除を 1.0.0 へ延期しない。

## 公開面の不変条件

実装後に守る境界を、否定形を含めてまとめる。

1. TypeScript の公開入口は上記十二と集合一致し、未宣言の深い import は解決しない。
2. root は領域の集約面ではなく、標準ループの最小 facade である。
3. muro-only な入口は外部法規、profile、builtin rules、process state を読まず、verdict を返さない。
4. analysis は context と versioned profile を必須とし、evidence を返すが verdict を返さない。
5. validate は明示した規則と profile だけを実行し、必ず `AssessmentReport` を返す。
6. builtin は generic validate から参照されず、外部 rule pack と同じ SPI を使う。
7. mutable global registry と import-time registration は存在しない。
8. regulatory validation は TS、CLI、MCP の全てで profile が必須であり、同じ入力から同じ意味を返す。
9. Node builtin は `node` 入口の向こうにだけ在り、root は browser-safe である。
10. 0.18.0 の配布物と repository consumer に旧公開面または互換層が残らない。

## 棄却した代替案

**root を従来どおり全部入りにし、subpath を別名として足す。**棄却する。入口が責務を示さず、同じ名が root と領域別入口の二面で約束される。root の利用者が増えるほど、後で領域を分けられなくなる。

**source file ごとに subpath を公開する。**棄却する。実装の分割が公開契約になり、内部の整理が破壊的変更になる。十二入口は利用者が選ぶ責務であり、source tree の写しではない。

**analysis に閾値を持たせ、`ok` または `level` まで返す。**棄却する。同じ数値からどの法令を適用したかが隠れ、解析手法の再利用と規則の差替えができなくなる。値を得ることと、その値へ線を引くことを別の契約にする。

**context または profile を省略したとき、内蔵の標準値で動かす。**棄却する。「標準」がどの管轄、基準日、用途にも通用することはない。成功して見える無根拠な判定より、入力不足として止まる方を採る。

**validate は従来どおり finding 配列を返し、profile 情報は呼出し側が管理する。**棄却する。配列だけでは、何を適用し、何を適用しなかったか、空配列が適合なのか未評価なのかを復元できない。判定根拠を結果そのものに閉じるため `AssessmentReport` を契約にする。

**global registry へ plugin が規則を登録する。**棄却する。便利さと引換えに結果が import 順と process の履歴へ依存し、同じ MCP server で異なる案件を安全に扱えない。明示的な値の合成で同じ拡張性を得られる。

**CLI と MCP だけは内蔵 profile を暗黙に使う。**棄却する。TS と別の意味になり、automation が根拠を指定しないまま規制上の結論を受け取る。人向け入口にも machine 向け入口にも同じ明示性を課す。

**0.18.0 に deprecated alias と互換 wrapper を残し、1.0.0 で消す。**棄却する。猶予期間中に旧面の利用者が増え、二つの契約、文書、試験、schema を維持することになる。0.x で切り替える目的に反する。

## 帰結と代償

0.18.0 は既存 TypeScript consumer、CLI / MCP automation、外部 rule 利用者に対して破壊的である。import path、validation call、返り値の読取り、CLI / MCP の引数を同時に移す必要がある。

代わりに、import path が責務を示す。muro の意味として守る面、外部条件を受けて計算する面、規則を適用して結論を出す面、自由に変えられる presentation、Node 固有処理が混ざらない。不要な名前を root の都合で凍らせず、各領域を独立に育てられる。

法規判定は以前より冗長になる。呼出し側は profile と context を選び、結果も report として読む。しかし、同じ情報が再現性、監査可能性、複数管轄、基準日の違い、外部 rule pack の共存を可能にする。

mutable global registry を持たないため、規則パックを import しただけでは有効にならない。毎回明示して渡す一手が増える一方、試験隔離、並行実行、長寿命 process の安全性を得る。

API の切替と repository 全体の移行を一版で行うため、0.18.0 の変更量は大きい。互換負債を 1.0.0 へ持ち越さず、1.0.0 候補として観測する面を一つに絞れることが、その費用の見返りである。

## 証拠と受入条件

この決定は、少なくとも次の証拠が揃うまで実装完了としない。

- 機械可読な公開面台帳、`package.json` の export map、各入口の export、公開 API 文書が十二入口と全 symbol の集合一致を機械試験で示す
- `npm pack` した tarball を空の project に導入し、十二入口を package 名から import できる。旧入口、未宣言の深い import、旧 root symbol は import できない
- root の export 集合と依存 scan が、最小 facade であること、subpath の再輸出が無いこと、Node builtin を引かないことを固定する
- domain dependency test が、muro-only 領域から analysis、validation、builtin、drawing、Node への逆向き import を一つも許さない
- package 内部を import しない外部 analysis fixture が、context と versioned profile を明示して実行できる。どちらかを欠く呼出しは型と runtime の両方で拒まれる
- analysis の contract test が、値、evidence、profile identity、provenance、不足入力を保持し、verdict field または規制上の summary を持たないことを示す
- package 内部を import しない外部 rule pack fixture が public SPI だけで実行でき、profile、rule set、rule、evidence を辿れる `AssessmentReport` を返す
- `pass`、`fail`、`not-applicable`、`not-assessed`、不足入力、rule error の各 fixture が別の状態として round-trip し、空結果または実行不能が pass に化けない
- 二つの profile と二つの rule pack を同一 process で順序を入れ替え、交互および並行に実行しても各 report が不変である。公開 registration API、module-level mutable registry、import-time registration が無いことを negative scan でも固定する
- CLI と MCP は regulatory validation の profile 省略をそれぞれ usage error / invalid arguments として返し、明示した同一 profile では TS API の `AssessmentReport` と意味上同じ structured result を返す
- CLI と MCP の実装に独自の規制閾値、面積算入、rule 順、summary 集計が無く、共有 operation だけを呼ぶことを試験と scan で示す
- 変更前後の全 bundled examples について、別の言語変更を決定しない限り canonical JSON と `Form` が一致する
- 旧 export、旧 subpath、旧 validation contract、互換 alias / wrapper を列挙した移行台帳の全項目が「新入口へ移行」または「削除」で閉じ、repository 全域の consumer scan が旧利用をゼロと示す
- runtime dependency がゼロのままであり、typecheck、単体試験、examples、documentation gate、conformance、package smoke の全 gate が成功する

実行した command、実測した export 集合、移行前後の対応、fixture と gate の結果は作業ログに置く。公開文書は履歴や本 ADR を根拠にせず、受入後の契約を現在形で自己完結して説明する。
