# ADR-0037: 公開面を書き下す — `export *` を廃し、利用者のいない名を落とす

日付: 2026-07-27 / 状態: 採用 (v0.16.0、言語版 muro 1.0) / 起点: [方針の総覧](../policy.md) §11-8・§12 / 関連: [ADR-0032](0032-three-domains.md) (三つの領域)

## 文脈

1.0.0 が凍らせる八つの面の八番目は「公開 API と CLI」である ([spec/scope.md §8](../../spec/scope.md))。凍らせるとは「壊さないと約束する」ことであって、**何を約束したかが言えなければ、約束は成立しない。**

実測すると、面はそもそも書かれていなかった。`src/index.ts` の公開シンボルは 137 名で、そのうち **75 名は `export * from "./core/model.js"` と `export * from "./core/graph.js"` による自動流出**である。誰も「これを約束する」と決めていない。モジュールに `export` を一つ足せば、その瞬間に凍る面が一つ増える。

そして自動流出した面は、実際に腐っていた。

| 事実 | 実測 |
|---|---|
| リポジトリ全体 (koyu の `src/` `test/` `eval/` `scripts/` `editors/` と ugatsu の `src/`) で**呼び出しゼロ**の値 | `clipHalfPlane` / `rectEscapesPolygon` / `sharedSegment` の三つは、自分のモジュールの中ですら呼ばれていない |
| その三つを **spec/tools.md と guide/api.md が「導出の部品」として推していた** | 節と実行例つき。**動く例を書いて載せた覚えのない関数を、規範が勧めていた** |
| 逆に ugatsu が実際に使う `slabs` `runSolids` `runDrawsForLevel` `verticalRuns` | spec/tools.md に一行も無い |
| `guide/api.md` が節を立てて説明していた `daylight(model)` | **そんな関数は無い。**実物は `daylightInputs` で、返す型も違う (`ok` も `need` も持たない) |

**推している面が動かず、動いている面が書かれていない。**この状態の「公開API」は、凍結の対象として意味をなさない。方針 §12 の完成条件 —「公開されている面に、使われていないもの・意味が定まっていないものが無い」— を満たしていない。

CLI も同じ穴を持っていた。凍らせるのは「コマンド、引数、終了コード」なのに、テストは `check` と `diff` の二つしか無かった。実際に `koyu axo -s abc` は `width="NaN"` の SVG を書き出し、「生成しました」と印字して**終了コード 0 で終わっていた。**呼び方の問題が、作品の問題に化けていた。

## 決定

**面を書き下す。載せる基準は「面の外に利用者がいること」の一つだけにする。**

**1. `export *` を廃し、`src/index.ts` を名前の列にする。**再輸出だけを書き、自分では何も宣言しない。何を約束したかは、このファイルを読めば分かる。

**2. 載せる基準を四つの入口で定める。**次のどれかを満たす名だけを載せる。

- パッケージの外 (ugatsu・`eval/`・`scripts/`・`editors/`) が実際に呼ぶ
- CLI か MCP が答えるものを、API からも答えるために要る (「CLIが答えるものはすべてこのAPIが答える」は guide/api.md が掲げてきた約束である)
- spec が名指しで約束する導出 ([scope.md §4](../../spec/scope.md) の問い・§6 の導出、[semantics.md](../../spec/semantics.md) の導出規則)
- `test/` が契約として固定している

**core のモジュール同士が引き合うだけの配管は、面ではない。**`src/core/*.js` を直接引けば足りるものを、公開面に置いて凍らせる理由が無い。

**3. 型は、載せた値の署名を書き下すのに要るものだけを載せる。**この規則は型を削らない — `Model` から辿れる型 (`Space` `Boundary` `Rect` `Pt` …) はモデルの語彙そのものだからである。逆に**穴が二つ見つかった**: `Diagnostic.code` の型 `DiagnosticCode` と、`ModelDiff.columns` の要素型 `ColumnItem` が公開されていなかった。利用者は返り値の型を書き下せなかったので、この二つを足した。

**4. spec/tools.md が面の台帳になり、テストが集合一致を縛る。**日英どちらの表も `src/index.ts` と一致しなければならない。表と実装が食い違えば `test/public-api.test.ts` が落ちる。**直す先は二つしかない — 面を足したなら表に書く。表から消したなら export を外す。**

**5. 呼び方の問題は、必ず終了コード 2 で止める。**`-s abc` (数でない縮尺) と `-d XYZ` (無い向き) を弾く。**空の SVG も `NaN` の SVG も、黙って書かない** — ADR-0028 が未宣言のレベル名について定めたのと同じ規律を、値を取る引数へ広げた。

**6. 配布物に仕様を同梱する。**`files` に `spec` を足し、`@kensnzk/koyu/spec/*` で引けるようにした。**契約はパッケージの中にある。**あわせて凍らない二つの領域をサブパスとして分けた — `@kensnzk/koyu/validate` と `@kensnzk/koyu/draw`。`import` の一行を見れば、それが凍る面か凍らない面かが分かる ([ADR-0032](0032-three-domains.md) の領域を、配布の形にも通した)。動作環境も宣言した (`engines.node: ">=22"`)。

## 落とした名

**32 の値を公開面から外した。**すべて「面の外に利用者がいない」ものである。

| 落とした名 | なぜ落としてよいか |
|---|---|
| `clipHalfPlane` `rectEscapesPolygon` `sharedSegment` | **呼び出しが一つも無い。**実体は `poly.clipHalf` / `shapeEscapesPolygon` / 凸片版の共有辺に置き換わっており、残っていたのは古い版である |
| `canonicalSpaceEntry` `canonicalBoundaryEntry` `canonicalOpeningEntry` `canonicalSegEntry` `sortBySerial` | `toCanonical` と `semanticDiff` が内部で共有する組み立ての部品。**機械形式の面は `toCanonical` の一本である** — 要素一つの正準形が要るなら、その出力を読めばよい |
| `planOverlap` `spacesOverlap` `polygonSelfIntersection` `shapeEscapesPolygon` `onPolygonEdge` | 重なりと敷地の**診断の内側**。利用者が要るのは答え (GEO01/GEO02/SIT03、`site.escape`) であって、その計算の途中ではない |
| `segmentLength` `mergeCollinear` | `segmentsFor` の周辺。長さは端点から測れるし、共線の併合は `segmentsFor` が既に済ませて返す |
| `regionOf` `derivePieces` `drawnCut` `columnSites` `runDecls` `runIssues` | parse と診断の配管。`Space.pieces` / `checkDiagnostics` という、既に公開されている答えの手前にある |
| `verticalRun` `toWorld` `RUN_KEYS` `RUN_FORMS` `CUT_HEIGHT` `COVERED_SEMI_FACTOR` | `verticalRuns` / `runSolids` / `daylightInputs` の内側。定数は spec の表と関数の既定値が持つ |
| `accessFindings` `daylightFindings` `envelopeFindings` `runFindings` `siteFindings` | 検証の章ごとの検査。面は `validate(model)` の一本である ([ADR-0032](0032-three-domains.md)) |
| 型 `RunIssue` | `runIssues` を落としたので、名指す先が無い |

呼び出しの無かった三つは**実装ごと消した**。残りは実装が内部で使われているので残し、`src/index.ts` から外しただけである。`package.json` の `exports` が深い import を塞いでいるので、外した時点で公開面ではない。

結果、**137 名 → 106 名** (値 80 → 48、型 57 → 58)。

## 代替案

**`export *` のまま、spec を実態に合わせる**案は、いちばん安い。だが凍結の意味が変わる — 誰かが core のモジュールに `export` を足した瞬間、宣言されていない約束が凍る面に増える。**面が「実装の副作用」であるかぎり、凍らせたと言えない。**

**呼び出しゼロの名だけを落とし、内部専用の配管は残す**案も採れた。11 名しか落ちず、変更は小さい。だが「利用者がいないものを残さない」という条件 (方針 §12) を満たさない。**凍結後に足すのは安く、外すのは破壊的である**以上、迷いは残さない側へ倒すのが正しい。

**深い import (`@kensnzk/koyu/core/graph.js`) を開き、落とした名をそこから引けるようにする**案は、公開面を二重にする。「凍る面」と「凍らないが引ける面」が並ぶと、利用者は後者を使い、実質的に凍結が骨抜きになる。

**型も呼び出し実績で削る**案は成り立たない。`Model` を返す関数を公開しながら `Space` を隠せば、利用者は返り値を分解できても書き下せない。**型は値の署名から辿って決める**のが唯一の一貫した規則である。

**`svgAxo` の壊れた縮尺を `NaN` のまま通し、描画側で既定値へ落とす**案は、呼び方の間違いを黙って直してしまう。`-s abc` と書いた人は縮尺を指定したつもりでいるので、指定が効かなかったことを言わなければならない。**呼び方の問題は、呼び方の問題として返す。**

## 帰結と代償

**面が読めるものになった。**`src/index.ts` は 4KB の名前の列で、上から下まで読めば公開しているものが全部分かる。spec/tools.md の表が同じ集合を持ち、テストが二つを縛る。

**CLI の面にテストができた。**`test/cli.test.ts` の 33 件が、14 のサブコマンド全部の正常終了と一行目の形、呼び方の間違いの終了コード 2、構成の側の答えが否のときの 1 を縛る。とくに `check` の人向け出力に診断コードが出ないこと、`check --json` が構文エラーでも有効な JSON を返すことは、これまで文でしか書かれていなかった。

**guide/api.md の嘘が消えた。**存在しない `daylight()` の節が `daylightInputs` になり、落とした名の節が消え、ugatsu が使う生成物 (`slabs` / `verticalRuns` / `runSolids` / `runDrawsForLevel`) の節が入った。

代償。**(1) 落とした 32 名を使っていた外部の利用者がいれば壊れる。**1.0.0 の前だから払える代償であり、これが「1.0 の前にやる」ことの理由そのものである。**(2) 面を足す手続きが一手増えた。**export を書き、spec の表に書く。ADR-0016 が診断コードに課したのと同じ二重記帳で、片方だけ動かせないことが目的である。**(3) 表が二つある** (日英)。訳の分だけ手が増えるが、テストが両方を縛るので、片方だけ古びることはない。

三点セットで着地した: 本 ADR (なぜ) + `test/public-api.test.ts` の 12 件と `test/cli.test.ts` の 33 件 (保証) + [spec/tools.md](../../spec/tools.md) (現在形)。
