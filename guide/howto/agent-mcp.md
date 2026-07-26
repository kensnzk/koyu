[English](../en/howto/agent-mcp.md) · **日本語**

# MCP でエージェントに繋ぐ

`koyu-mcp` を MCP サーバーとして登録し、LLM エージェントに建物を読ませ・編集させ・検証させる。

サーバーは koyu 本体に同梱されている。ステートレスで、すべてのツールが `file` (entry の .muro パス) を受け、毎回ゼロから合成する。原本はファイルシステムにあり、履歴は git が持つ ([ADR-0012](../../docs/decisions/0012-mcp-server.md))。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- Node と `npx` が使えること。サーバーは実行時依存を持たない。
- `.muro` ファイルが git 管理下にあること。`write_layer` は全置換で書き、履歴を持たない。取り消しは git で行う。
- エージェントに書かせる前にコミットしておくこと。

## 手順

### 1. サーバーを登録する

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

リポジトリをクローンして開発版を使うときは、ビルド後の `dist/mcp.js` を指す。

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js
```

### 2. ツールを確かめる

10個のツールが返る。すべて `file` を必須引数に持つ。

| ツール | 引数 | 返り |
|---|---|---|
| `model_summary` | `file` | 名前・単位・レイヤー構成・レベル・ゾーン・アセット・面積 (延べ/半屋外/レベル別/use別)・check件数。**まずこれを呼ぶ** |
| `check` | `file` | `ok`・`errors`/`warnings` (出所レイヤー:行つきの文字列)・`diagnostics` (構造化診断 — 文字列と同件・同順)。**編集のたびに呼ぶ門番** |
| `layers` | `file` | 合成に参加した全レイヤーの `{file, source}` — 原本を読む |
| `write_layer` | `file`, `layer`, `content` | レイヤーを全置換して書く。返りは `written`・`ok`・`errors`/`warnings` |
| `doors` | `file`, `from`, `to` | 最少扉数の経路 `{doors, path}`、到達不能なら `{unreachable: true}` |
| `spaces` | `file`, `level` (省略可) | 空間一覧 (パス・型・名前・レベル・面積・半屋外・出所レイヤー) |
| `light` | `file` | 居室ごとの 1/7 採光判定 |
| `site` | `file` | 敷地レポート (面積照合 `areaMatch`・接道・`coverageRatio`・`floorAreaRatio`) |
| `plan_svg` | `file`, `level` | 指定レベルの平面図 SVG 文字列 |
| `canonical_json` | `file` | 正準 JSON (合成後の単一モデル) |

正確な契約は [spec/tools.md](../../spec/tools.md) の MCP 節。

### 3. 標準ループを回す

エージェントの作業は git のそれと同型にする。

```text
model_summary  →  layers  →  write_layer  →  (check がエラーなら直して再度 write_layer)
                                                        ↓
                                         doors / light / site で帰結を確かめる
```

**model_summary で建物を掴む。** レイヤー構成・レベル・面積・check件数が一度に返るので、以降どのファイルを読めばよいかが決まる。`examples/house.muro` に対する返りはこうなる。

```text
{
 "name": "小さな戸建住宅",
 "unit": "mm",
 "layers": [
  "examples/house.muro"
 ],
 "levels": [
  {
   "name": "L1",
   "z": 0,
   "h": 2400
  },
  {
   "name": "L2",
   "z": 2900,
   "h": 2400,
   "slab": 500
  },
  {
   "name": "R",
   "z": 5800,
   "slab": 500
  }
 ],
 "spaces": 13,
 "boundaries": 31,
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "areaM2": 0
  },
  {
   "path": "/home",
   "name": "住戸",
   "areaM2": 92.75
  }
 ],
 "assets": [],
 "totalFloorM2": 92.75,
 "semiOutdoorM2": 73.24,
 "floorsM2": {
  "L1": {
   "rooms": 2,
   "subtotalM2": 53
  },
  "L2": {
   "rooms": 2,
   "subtotalM2": 39.75
  }
 },
 "byUseM2": {
  "exclusive": 92.75
 },
 "check": {
  "errors": 0,
  "warnings": 0
 },
 "hint": "レイヤーの中身は layers で、検査は check で、変更は write_layer で (checkが門番)。"
}
```

`boundaries` は合成後の本数で、導出された既定の壁を含む — `layers` が返す原本の `boundary` 行数より多くなることがある。書かれた構成だけを見たいときは `canonical_json` を使う (既定境界は正準 JSON に出ない)。

**layers で原本を読む。** import は自動で辿られる。合成に参加したレイヤーだけが返るので、参照されていないファイルは見えない。

**write_layer で書く。** 引数は entry (`file`)・書き込み先 (`layer` — entry からの相対または絶対)・全文 (`content`)。差分ではなく全置換である。

**check が門番になる。** `write_layer` は書いた直後の check 結果を同じ応答に載せて返す — 編集と検証が一往復で済む。エラーが返ったら直して再度書く。

**問いで帰結を確かめる。** 面積が変われば `site`、間仕切りを動かせば `doors` と `light`。`check` はこれらを見ないので、意図した帰結が出たことは別に確かめる。

### 4. write_layer の安全性を理解しておく

**書き込みの前に検証する。** `write_layer` は差し替え後の内容で仮想的に合成し、parse できなければ**原本に一切触れない**。壊れた合成がファイルシステムに着地することはない。

```text
{
 "written": false,
 "target": "rooms.muro",
 "ok": false,
 "parseError": "rooms.muro:1行目: 未定義の通り名です: X9"
}
```

**parse は通るが check がエラーの内容は書かれる。** 複数レイヤーにまたがる編集の途中を許すための仕様で、`written` にはパスが入り `ok` が false になる。次の呼び出しで直す。

```text
{
 "written": "rooms.muro",
 "ok": false,
 "spaces": 3,
 "errors": [
  "rooms.muro:5行目: 未定義の空間を参照しています: /L1/bath"
 ],
 "warnings": []
}
```

**書き込みは atomic。** 同一ディレクトリ内の一時ファイル + rename で行うため、中途半端なファイルが残らない。

**書き込み先は限定されている。** `.muro` 拡張子のみ、かつ entry のディレクトリ配下のみ。相対パスでの脱出も symlink 経由の脱出も塞がれている。

```text
entryのディレクトリの外へは書き込めません
```

```text
書き込みは .muro ファイルに限ります
```

**合成に参加しないファイルの内容は検証されない。** どこからも `import` されていない新規レイヤーを書いたときは、entry に `import ./新レイヤー.muro` を足すまで中身が検査されない。新しいレイヤーを作るときは、import 行の追加を同じ作業単位に含める。

**履歴は持たない。** 取り消し・分岐・レビューは git の仕事である。エージェントに書かせる前にコミットしておく。

## 確かめる

エージェントを介さずに、stdio へ JSON-RPC を直接流して動作を確認できる。リポジトリのルートで実行する。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.11.0"},"instructions":"空間一次の建築記述koyuのサーバー。model_summaryで建物を掴み、layersで原本 (.muroレイヤー群) を読み、write_layerで編集する。checkが一棟のビルドの門番 — エラーは出所レイヤー:行つきで返る。doors/light/site/spacesは同じ記述への異なる問い。形 (plan_svg) は生成物。"}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\n \"doors\": 2,\n \"path\": [\n  \"/L1/a\",\n  \"/L1/b\",\n  \"/out\"\n ]\n}"}]}}
```

同じ形で `{"jsonrpc":"2.0","id":2,"method":"tools/list"}` を投げると、上表の10件が `name` / `description` / `inputSchema` つきで返る。`inputSchema.required` は `write_layer` が `["file","layer","content"]`、`doors` が `["file","from","to"]`、`plan_svg` が `["file","level"]`、残りは `["file"]` である。

ツール実行時のエラーは JSON-RPC のエラーではなく、`isError: true` を付けた結果として返る。エージェントはそれを読んで直せる。

## 関連

- [how-to 一覧](README.md)
- [複数ファイルに割る](split-into-files.md) — `write_layer` が書く単位を設計する
- [動線と避難を問う](doors-and-escape.md) — `doors` で帰結を確かめる
- [敷地を書いて建蔽率・容積率を出す](site-and-far.md) — `site` で帰結を確かめる
- [よくある詰まり](troubleshooting.md) — `check` が返すエラーの直し方
- [公開 API](../api.md) — MCP を経由せずプログラムから同じ導出を呼ぶ
- [spec/tools.md](../../spec/tools.md) — CLI・MCP・公開 API の規範
- [spec/canonical-json.md](../../spec/canonical-json.md) — `canonical_json` が返す形式
- [ADR-0012](../../docs/decisions/0012-mcp-server.md) — サーバーを本体に同梱し、依存ゼロ・ステートレスにした理由
- [ADR-0013](../../docs/decisions/0013-semantic-guarantees.md) — 書き込み前検証とディレクトリ限定の根拠
