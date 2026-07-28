[English](en/tools.md) · **日本語**

# ツールリファレンス — CLI・MCP・公開API

koyu v1.0.0-rc.1 現在。すべてのツールは同じ導出 (semantics.md) の別の入口である — CLIは人の手、MCPはエージェント、APIはプログラム。

## CLI (`koyu` / `npm run koyu --`)

```
koyu <check|validate|layers|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [引数...]
```

| コマンド | 引数 | 出力 | 終了コード |
|---|---|---|---|
| `check` | `--json` (Diagnostic[]をJSON出力 — 構文・合成エラーはSYN01の1件に写して有効JSONのまま), `--strict` (警告があれば終了コード1) | 構造整合の可否・エラー/警告 (出所つき)。診断コード台帳は semantics.md §5。**建築的な妥当性は言わない** (scope.md §3) | 0=緑 / 1=エラー (--strict時は警告も) |
| `validate` | `--json` (Finding[]をJSON出力) | 建築的な判定 (validation.md の台帳)。**checkの保証ではない** — 型もコードの綴りも別で、終了コードの流儀だけが同じ | 0=違反なし / 1=違反あり |
| `layers` | `--attrs` (属性ごとの最終値の出所) | 合成に参加した層を弱い順に。**暗黙の解決はどこにも無い**ことを目で確かめる面 (composition.md 規則1・6) | 0 |
| `diff` | `<b.muro>` (比較先 — entryが比較元), `--json` (ModelDiffをJSON出力) | 構成の言葉の差分 (ADR-0018): grid移動・改名 (uid一致・パス不一致)・空間/境界/開口のフィールド変化。行順・書式・素wall宣言と省略 (既定壁) の違いは差分にしない | 0=差分なし / 1=差分あり / 2=入力が壊れている |
| `plan` | `-l レベル` (既定: 最初のレベル), `-o 出力.svg` (既定: `<entry>-<レベル>.svg`) | 平面SVG生成 | 0 / 2 (未宣言のレベル名 — 呼び方の問題。ADR-0028) |
| `axo` | `-o 出力.svg` (既定 `out/axo.svg`), `-d NE\|NW\|SE\|SW` (既定 SE), `-l L1..L5` または `-l L1,L3`, `-s 縮尺`, `--no-walls`, `--ceilings` | 軸測図SVG生成 — 床・屋根・壁・柱・縦動線を投影する (ADR-0026)。実行環境もWebGLも要らないので、平面と同じ「生成して見る」手で立体を確かめられる | 0 / 2 (未宣言のレベル名・読めない縮尺・未知の向き — 空のSVGも `NaN` のSVGも黙って書かない。ADR-0028) |
| `doors` | `/パスA /パスB` | 扉数と経由列、到達不能なら1 | 0/1/2 |
| `graph` | — | 空間ごとの隣接 (境界種別・扉数) | 0 |
| `stats` | — | レベル別面積・半屋外別掲・ゾーン別・型別・use別 | 0 |
| `levels` | — | テキストの矩計 (階高の積み上がり) | 0 / 1 |
| `runs` | — | 縦動線の一覧 — 装置・上る高さ・折返しの有無・導出された勾配と走り長 (ADR-0021)。段数と踏面は `check` の RUN06 が検査する | 0 |
| `light` | — | **`daylight:1` と宣言された室**の1/7採光判定 (対象は型から推定しない — ADR-0020) | 0=全て✔ / 1 / 1=対象なし |
| `site` | — | 敷地面積 (宣言/導出照合)・接道・建蔽率・容積率 | 0 / 1=敷地なし |
| `json` | — | 正準JSON (canonical-json.md) | 0 |

entryは常にファイルパスで、importは自動で合成される。

## MCPサーバー (`koyu-mcp` — ADR-0012)

stdio上のMCP (JSON-RPC 2.0、行区切りJSON)。依存ゼロ・ステートレス (全ツールが `file` = entryパスを受け、毎回合成する)。登録例: `claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp`。

| ツール | 引数 | 返り |
|---|---|---|
| `model_summary` | file | 名前・レベル・レイヤー構成・ゾーン・アセット・面積・check件数 — **まず呼ぶ** |
| `check` | file | ok・エラー/警告 (出所レイヤー:行つき)・diagnostics (構造化診断 — ADR-0016。文字列と同件・同順) — **編集のたびに呼ぶ門番** |
| `layers` | file | 合成に参加した全レイヤーの {file, source} — 原本を読む |
| `write_layer` | file, layer, content | 検査してから全置換 (parse不能な合成になる内容は書き込まれない — 原本不変。checkエラーは返すが途中状態の保存は許す)。書き込みはatomic。`.muro` のみ・entryのディレクトリ配下のみ (相対パスとsymlink実体で検査。合成に参加しないファイルの内容は検証されない) |
| `doors` | file, from, to | 最少扉数の経路、到達不能なら {unreachable} |
| `validate` | file | 建築的な判定 (`findings` は `rule`/`level`)。**checkの保証ではない** — 増える面である |
| `spaces` | file, [level] | 空間一覧 (パス・型・面積・半屋外・出所) |
| `light` | file | 居室ごとの採光判定 |
| `site` | file | 敷地レポート (面積照合 `areaMatch`・接道・建蔽率・容積率) |
| `new_uids` | file, [count] | 永続同一性トークン (uid) を作る — 合成済みのモデルとは衝突しない。**自分から付与するものは無い**ので、改名を跨いで指す必要が出たときにだけ呼ぶ |
| `plan_svg` | file, level | 平面SVG文字列 |
| `canonical_json` | file | 正準JSON |

エージェントの標準ループ: `model_summary` → `layers` → `write_layer` → (返ってきたcheckがエラーなら直す) → `doors`/`light`/`site` で帰結を確かめる。履歴はgitに任せる。

## 公開API (`@kensnzk/koyu`)

**ルートエントリはブラウザ安全** (node:fs を引かない)。fsを使う入口だけ `@kensnzk/koyu/node` に分離。動作環境は Node 22 以上 (`engines`)。

| 入口 | 中身 | 凍結 |
|---|---|---|
| `@kensnzk/koyu` | 下の一覧のすべて | core の部分が凍る (scope.md §8) |
| `@kensnzk/koyu/node` | `parseFile(path)` / `parseFileWith(path, overlay)` — fsから合成する二つだけ | 凍る |
| `@kensnzk/koyu/validate` | 建築的な判定 (validation.md) | **凍らない** — 増える面 |
| `@kensnzk/koyu/draw` | SVG生成 | **凍らない** — 呼び方は凍り、SVGの中身は凍らない |
| `@kensnzk/koyu/examples/*` | 同梱の建物 | — |
| `@kensnzk/koyu/spec/*` | この仕様書そのもの (配布物に同梱する) | — |

```ts
import { parse, check, doorsBetween, siteReport, svgPlan, toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
```

### 面の一覧

**この表と実装の export は集合として一致する** — 食い違えばテストが落ちる (ADR-0037)。`export *` は使わない。モジュールに export を足した瞬間に、誰も宣言していない約束が凍る面へ増えてしまうからである。**凍らせる面は、書き下されていなければならない。**

<!-- api-surface -->

| 面 | 値 | 型 |
|---|---|---|
| 解析と合成 | `parse` `parseFiles` `parseWith` `tokenize` | `LayerLoader` |
| モデルの語彙 | — | `Model` `Space` `Zone` `Boundary` `Opening` `Seg` `Area` `Asset` `Level` `Rect` `Pt` `GridAxis` `GridRef` `SitePolygon` `Column` `ColumnDecl` `DrawnLine` `Edge` `BoundaryKind` `Attrs` `AttrValue` |
| 問い・導出・機械形式 | `areaM2` `zoneAreaM2` `unionAreaM2` `polygonAreaM2` `pointInPolygon` `polyBounds` `rectToPoly` `columnsFor` `displayName` `effectiveUse` `heff` `isIndoor` `isSemiOutdoor` `isCoveredAbove` `levelsSorted` `newUids` `toCanonical` `srcRef` `SourceError` `SUPPORTED_LANGUAGE_VERSIONS` `DEFAULT_LANGUAGE_VERSION` | — |
| 構造整合の診断 | `check` `checkDiagnostics` `DIAGNOSTIC_CODES` | `Diagnostic` `DiagnosticCode` `CheckResult` |
| 空間グラフ | `doorsBetween` `neighbors` `passable` `segmentsFor` `envelopeGaps` `deriveDefaultBoundaries` `placeOpening` `placeBand` | `Segment` `Route` `NeighborInfo` `Band` `PlacedBand` `BandError` `BandCode` |
| 形の参照実装 | `derive` `levelPitch` `DERIVATION_CONSTANTS` `TOLERANCES` `thicken` `bandLine` `band` `columnRect` `runPrism` | `Form` `FormInput` `FormLevel` `FormSpace` `FormBoundary` `FormPanel` `FormOpening` `FormSwing` `FormSeg` `FormColumn` `FormRun` `FormSite` `FormPlan` `FormPrism` `PlanEntity` `PlanClass` `PlanSubject` `PlanRole` `DeriveOptions` |
| 床・天井・屋根 | `slabs` | `Slab` `SlabKind` |
| 採光 | `daylightInputs` | `DaylightInput` |
| 縦動線 | `verticalRuns` `runSolids` `runDrawsForLevel` `slopeText` | `VerticalRun` `RunPart` `RunSolid` `RunDraw` `RunArrow` `RunDevice` `RunForm` `Seg2` |
| 敷地 | `siteReport` | `SiteReport` `RoadFrontage` |
| 差分 | `semanticDiff` `renderDiff` | `ModelDiff` `FieldChange` `ChangedItem` `RenamedItem` `GridChange` `SpaceItem` `BoundaryItem` `BoundaryChange` `ColumnItem` |
| 生成 (凍らない) | `svgPlan` `svgAxo` | `PlanOptions` `AxoOptions` |
| 検証 (凍らない) | `validate` `VALIDATION_RULES` | `Finding` `ValidationRule` |

### 面の約束

- **合成の入口**: `parse(source)` (単一ソース — importはエラー) / `parseFiles(files, entry)` (仮想ファイル群 — キー空間の中でimport解決。ブラウザ向け) / `parseFile(path)` (fs) / `parseFileWith(path, overlay)` (fs+差し替え — 書き込み前の門番用) / `parseWith(loader, entry)` (独自ローダー)。合成に参加した全レイヤーは `model.layers` (合成順)。
- **検査と問い**: `checkDiagnostics(model)` → `Diagnostic[]` (一次形式 — code/severity/message/出所/path/related。台帳は `DIAGNOSTIC_CODES`、コード表は semantics.md §5。ADR-0016) / `check(model)` → {errors, warnings} (互換の文字列形式 — 同件・同順)。問いは `doorsBetween` / `daylightInputs` / `siteReport` / `zoneAreaM2` / `neighbors` / `passable` / `envelopeGaps` — **どれも合否を言わない** (scope.md §4)。
- **導出の部品**: `segmentsFor` / `deriveDefaultBoundaries` (既定境界 — parse系は適用済み。正準JSON由来のモデルに意味を与えるときに使う) / `placeOpening` / `placeBand` (この「帯」は境界線分上の区間 = 開口・seg のことで、記法のキーワード `band` 〈language.md §3〉とは別の層である) / `columnsFor` / `heff` / `isSemiOutdoor` / `isCoveredAbove` / `levelsSorted`。
- **形の唯一の入口**: `derive(model, {cut?})` → `Form` (ADR-0040)。**規則は [derivation.md](derivation.md) が持ち、これはその参照実装である。**`Form` は見た目を一つも持たない — 色も書体も線幅も注記文字列も記号も縮尺も返さない (scope.md §6)。定数の台帳は `DERIVATION_CONSTANTS`、許容値の台帳は `TOLERANCES` で、derivation.md §5・§6 の表はその写しである。`levelPitch(model, level)` は階高 (壁と柱がどこまで立つか) を単独で答える。
- **生成物** (Form が組み上げる部品。個別にも呼べる): `slabs(model)` (床・天井・屋根 — ADR-0024) / `verticalRuns(model)` (縦動線の形 — ADR-0021) / `runSolids(run)` (その立体) / `runDrawsForLevel(model, level)` (そのレベルで切った作図)。**どれも見た目を持たない** — 色も線幅も注記文字列も返さない。ビュアーはこれを幾何へ写すだけである (scope.md §6)。
- **描画**: `svgPlan(model, {level, scale?})` / `svgAxo(model, {dir?, levels?, scale?, ceilings?, walls?})` / `toCanonical(model)`。
- **差分**: `semanticDiff(a, b)` → `ModelDiff` (構成の言葉の差分 — 改名はuidで検出、境界は実効集合で比較。`toCanonical` 同一なら空。ADR-0018) / `renderDiff(d)` → 日本語の行 (空配列=差分なし)。
- **同一性**: `newUids(model, count?)` → 新しい uid の列 (ADR-0039)。**合成済みのそのモデルとは衝突しない**が、まだ合成されていない層との非衝突は 80 ビットの乱数による確率的な保証であり、証明するのは `check` の UID03 だけである ([scope.md §5](scope.md))。**呼ばないかぎり、どのツールも uid を書かない。**
- **エラー**: 構文・合成エラーは `SourceError` (line / raw / file — messageは `レイヤー:行目: 本文`)。checkは投げず配列で返す。

利用例はビューワー ugatsu (github.com/kensnzk/ugatsu) — 導出をすべてこのAPIの呼び出しで行い、自前の「答え」を持たない。
