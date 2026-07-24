# ツールリファレンス — CLI・MCP・公開API

koyu v0.8.0 現在。すべてのツールは同じ導出 (semantics.md) の別の入口である — CLIは人の手、MCPはエージェント、APIはプログラム。

## CLI (`koyu` / `npm run koyu --`)

```
koyu <check|plan|doors|graph|stats|levels|light|site|json> <entry.muro> [引数...]
```

| コマンド | 引数 | 出力 | 終了コード |
|---|---|---|---|
| `check` | — | 整合の可否・エラー/警告 (出所つき) | 0=緑 / 1=エラー |
| `plan` | `-l レベル` (既定: 最初のレベル), `-o 出力.svg` (既定: `<entry>-<レベル>.svg`) | 平面SVG生成 | 0 |
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
| `check` | file | ok・エラー/警告 (出所レイヤー:行つき) — **編集のたびに呼ぶ門番** |
| `layers` | file | 合成に参加した全レイヤーの {file, source} — 原本を読む |
| `write_layer` | file, layer, content | レイヤー全置換→直後のcheck結果。`.muro` のみ・entryのディレクトリ配下のみ |
| `doors` | file, from, to | 最少扉数の経路、到達不能なら {unreachable} |
| `spaces` | file, [level] | 空間一覧 (パス・型・面積・半屋外・出所) |
| `light` | file | 居室ごとの採光判定 |
| `site` | file | 敷地レポート (面積照合・接道・建蔽率・容積率) |
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

- **合成の入口**: `parse(source)` (単一ソース — importはエラー) / `parseFiles(files, entry)` (仮想ファイル群 — キー空間の中でimport解決。ブラウザ向け) / `parseFile(path)` (fs) / `parseWith(loader, entry)` (独自ローダー)。
- **検査と問い**: `check(model)` → {errors, warnings}。`doorsBetween` / `daylight` / `siteReport` / `zoneAreaM2` / `neighbors` / `passable`。
- **導出の部品**: `segmentsFor` / `sharedSegment` / `placeOpening` / `placeBand` / `mergeCollinear` / `heff` / `isSemiOutdoor` / `isCoveredAbove` / `levelsSorted` / `polygonAreaM2` / `pointInPolygon`。
- **生成**: `svgPlan(model, {level, scale?})` / `toCanonical(model)`。
- **エラー**: 構文・合成エラーは `SourceError` (line / raw / file — messageは `レイヤー:行目: 本文`)。checkは投げず配列で返す。
- サブパス: `@kensnzk/koyu/examples/*` で同梱例を配布物として参照できる。

利用例はビューワー ugatsu (github.com/kensnzk/ugatsu) — 導出をすべてこのAPIの呼び出しで行い、自前の「答え」を持たない。
