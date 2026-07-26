[English](en/tools.md) · **日本語**

# ツールリファレンス — CLI・MCP・公開API

koyu v0.13.0 現在。すべてのツールは同じ導出 (semantics.md) の別の入口である — CLIは人の手、MCPはエージェント、APIはプログラム。

## CLI (`koyu` / `npm run koyu --`)

```
koyu <check|diff|plan|doors|graph|stats|levels|light|site|json> <entry.muro> [args...]
```

| コマンド | 引数 | 出力 | 終了コード |
|---|---|---|---|
| `check` | `--json` (Diagnostic[]をJSON出力 — 構文・合成エラーはSYN01の1件に写して有効JSONのまま), `--strict` (警告があれば終了コード1) | 整合の可否・エラー/警告 (出所つき)。診断コード台帳は semantics.md §5 | 0=緑 / 1=エラー (--strict時は警告も) |
| `diff` | `<b.muro>` (比較先 — entryが比較元), `--json` (ModelDiffをJSON出力) | 構成の言葉の差分 (ADR-0018): grid移動・改名 (uid一致・パス不一致)・空間/境界/開口のフィールド変化。行順・書式・素wall宣言と省略 (既定壁) の違いは差分にしない | 0=差分なし / 1=差分あり / 2=入力が壊れている |
| `plan` | `-l レベル` (既定: 最初のレベル), `-o 出力.svg` (既定: `<entry>-<レベル>.svg`) | 平面SVG生成 | 0 / 2 (未宣言のレベル名 — 呼び方の問題。ADR-0028) |
| `axo` | `-o 出力.svg` (既定 `out/axo.svg`), `-d NE\|NW\|SE\|SW` (既定 SE), `-l L1..L5` または `-l L1,L3`, `-s 縮尺`, `--no-walls`, `--ceilings` | 軸測図SVG生成 — 床・屋根・壁・柱・縦動線を投影する (ADR-0026)。実行環境もWebGLも要らないので、平面と同じ「生成して見る」手で立体を確かめられる | 0 / 2 (未宣言のレベル名 — 空のSVGを黙って書かない。ADR-0028) |
| `doors` | `/パスA /パスB` | 扉数と経由列、到達不能なら1 | 0/1/2 |
| `graph` | — | 空間ごとの隣接 (境界種別・扉数) | 0 |
| `stats` | — | レベル別面積・半屋外別掲・ゾーン別・型別・use別 | 0 |
| `levels` | — | テキストの矩計 (階高の積み上がり) | 0 |
| `light` | — | 居室ごとの1/7採光判定 | 0=全て✔ / 1 |
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
| `spaces` | file, [level] | 空間一覧 (パス・型・面積・半屋外・出所) |
| `light` | file | 居室ごとの採光判定 |
| `site` | file | 敷地レポート (面積照合 `areaMatch`・接道・建蔽率・容積率) |
| `plan_svg` | file, level | 平面SVG文字列 |
| `canonical_json` | file | 正準JSON |

エージェントの標準ループ: `model_summary` → `layers` → `write_layer` → (返ってきたcheckがエラーなら直す) → `doors`/`light`/`site` で帰結を確かめる。履歴はgitに任せる。

## 公開API (`@kensnzk/koyu`)

**ルートエントリはブラウザ安全** (node:fs を引かない)。fsを使う入口だけ `@kensnzk/koyu/node` に分離。

```ts
import { parse, parseFiles, parseWith, check, doorsBetween, daylight, siteReport,
         svgPlan, toCanonical, areaM2, zoneAreaM2, isSemiOutdoor, /* … */ } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
```

- **合成の入口**: `parse(source)` (単一ソース — importはエラー) / `parseFiles(files, entry)` (仮想ファイル群 — キー空間の中でimport解決。ブラウザ向け) / `parseFile(path)` (fs) / `parseFileWith(path, overlay)` (fs+差し替え — 書き込み前の門番用) / `parseWith(loader, entry)` (独自ローダー)。合成に参加した全レイヤーは `model.layers` (合成順)。
- **検査と問い**: `checkDiagnostics(model)` → `Diagnostic[]` (一次形式 — code/severity/message/出所/path/related。台帳は `DIAGNOSTIC_CODES`、コード表は semantics.md §5。ADR-0016) / `check(model)` → {errors, warnings} (互換の文字列形式 — 同件・同順)。`doorsBetween` / `daylight` / `siteReport` / `zoneAreaM2` / `neighbors` / `passable`。
- **導出の部品**: `segmentsFor` / `sharedSegment` / `deriveDefaultBoundaries` (既定境界 — parse系は適用済み。正準JSON由来のモデルに意味を与えるときに使う) / `placeOpening` / `placeBand` (この「帯」は境界線分上の区間 = 開口・seg のことで、記法のキーワード `band` 〈language.md §3〉とは別の層である) / `mergeCollinear` / `heff` / `isSemiOutdoor` / `isCoveredAbove` / `levelsSorted` / `polygonAreaM2` / `pointInPolygon` / `rectEscapesPolygon` / `polygonSelfIntersection`。
- **生成**: `svgPlan(model, {level, scale?})` / `toCanonical(model)`。
- **差分**: `semanticDiff(a, b)` → `ModelDiff` (構成の言葉の差分 — 改名はuidで検出、境界は実効集合で比較。`toCanonical` 同一なら空。ADR-0018) / `renderDiff(d)` → 日本語の行 (空配列=差分なし)。
- **エラー**: 構文・合成エラーは `SourceError` (line / raw / file — messageは `レイヤー:行目: 本文`)。checkは投げず配列で返す。
- サブパス: `@kensnzk/koyu/examples/*` で同梱例を配布物として参照できる。

利用例はビューワー ugatsu (github.com/kensnzk/ugatsu) — 導出をすべてこのAPIの呼び出しで行い、自前の「答え」を持たない。
