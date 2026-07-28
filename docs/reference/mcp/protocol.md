---
title: プロトコル
mode: reference
---

# プロトコル

`koyu-mcp` が話す JSON-RPC の面。ツールの中身ではなく、**その外側の封筒**を書き下す。エージェント基盤を自分で書く人、登録が繋がらない人、返りの形を機械で扱う人のための頁である。

この頁の出力はすべて実際に走らせて得たものである。

## 枠づけ

stdio 上の **JSON-RPC 2.0**。手書きの実装で、MCP の SDK は使っていない。

- **一行 = 一メッセージ。**標準入力から改行区切りの JSON を読み、標準出力へ改行区切りの JSON を書く。`Content-Length` のヘッダは無い。
- **空行は読み飛ばす。**
- **壊れた行は黙って捨てる。**JSON として読めない行にはエラーを返さない — stdio の流儀である。
- **標準入力が閉じたら終了コード 0 で終わる。**
- **通知には応答しない。**`id` を持たないメッセージ (`notifications/initialized` など) は受け取って何も返さない。
- **応答は処理しない。**`method` を持たないメッセージは無視される。

サーバーは自分からリクエストを送らない。ログもプログレスも標準出力へ流さない — 標準出力に出るのは JSON-RPC の応答だけである。

## initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.16.0"},"instructions":"Server for koyu, a space-first architectural description. Grasp the building with model_summary, read the original layers with layers, and edit with write_layer. check is the gatekeeper of the build and returns errors tagged layer:line — it guarantees structural consistency only. validate delivers the architectural verdicts, which are a separate and unfrozen surface. doors/light/site/spaces are different questions put to the same description. Form (plan_svg) is generated, never written."}}
```

| フィールド | 中身 |
|---|---|
| `protocolVersion` | **クライアントが送ってきた値をそのまま返す。**`params.protocolVersion` が無ければ `"2025-06-18"` を名乗る。版の交渉も拒否も行わない |
| `capabilities` | `{"tools":{}}` — ツールだけを宣言する。`listChanged` は宣言しないし、ツールの集合は動かない |
| `serverInfo.name` | `"koyu"` |
| `serverInfo.version` | `"0.16.0"` — **実装の版である。**記法の版 (`koyu 1.0`) とは別に動く |
| `instructions` | エージェント向けの一段落。標準ループと、`check` と `validate` の別を述べる |

`initialize` は状態を作らない。**`initialize` を送らずに `tools/call` を投げても動く** — サーバーは初期化済みかどうかを覚えていない。行儀の良いクライアントは送るが、手で確かめるときは省ける。

## ping

```json
{"jsonrpc":"2.0","id":1,"method":"ping"}
```

```text
{"jsonrpc":"2.0","id":1,"result":{}}
```

空のオブジェクトが返る。

## tools/list

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

12 件が `name` / `description` / `inputSchema` の三つ組で返る。ページングは無く、`nextCursor` も返らない。並びは実装の宣言順で、`model_summary` `check` `layers` `write_layer` `new_uids` `doors` `spaces` `light` `validate` `site` `plan_svg` `canonical_json` である。

`inputSchema` は素の JSON Schema で、`type: "object"` と `properties` と `required` だけを持つ。`file` の型は常に `{"type":"string"}` である。

```text
  {
   "name": "plan_svg",
   "description": "Generates and returns the plan SVG for a level (form is generated, not written — the lowest level doubles as the site plan)",
   "inputSchema": {
    "type": "object",
    "properties": {
     "file": {
      "type": "string",
      "description": "Path to the entry .muro file (imports are composed automatically)"
     },
     "level": {
      "type": "string",
      "description": "Level name (e.g. L5)"
     }
    },
    "required": [
     "file",
     "level"
    ]
   }
  },
```

`required` の中身は四通りしかない。

| `required` | ツール |
|---|---|
| `["file"]` | `model_summary` `check` `layers` `new_uids` `spaces` `light` `validate` `site` `canonical_json` |
| `["file","layer","content"]` | `write_layer` |
| `["file","from","to"]` | `doors` |
| `["file","level"]` | `plan_svg` |

`new_uids` の `count` と `spaces` の `level` は `properties` にあるが `required` には無い。

## tools/call

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

返るのは `content` 一要素の配列だけである。`structuredContent` は返らない。

**`content[0].type` は常に `"text"`。**画像もリソースリンクも返さない。[`plan_svg`](tools-ask.md#plan_svg) は SVG を返すが、それも `text` である。

**テキストの中身は二通りある。**

- **文字列を返すツール** — `plan_svg` だけ。SVG のソースがそのまま入る。
- **それ以外のすべて** — 返り値のオブジェクトを `JSON.stringify(値, null, 1)` で書いた文字列が入る。**字下げは空白 1 個である。**

字下げが 1 個であることは [`canonical_json`](tools-read.md#canonical_json) に効いてくる。[`koyu json`](../cli/json.md) が書くファイルは空白 2 個なので、**バイト列としては一致しない。**キーの順序と値は一致する。

`params.arguments` を省略すると空のオブジェクトとして扱われる。したがって必須引数を欠いた呼び出しになり、下の「ツールのエラー」の経路を通る。

## エラーの返り方

**二層ある。**プロトコルの誤りは JSON-RPC のエラーで、ツールの中の失敗は成功した応答の中の `isError` で返る。

### プロトコルのエラー

```text
{"jsonrpc":"2.0","id":4,"error":{"code":-32601,"message":"Unsupported method: completion/complete"}}
{"jsonrpc":"2.0","id":5,"error":{"code":-32602,"message":"Unknown tool: blueprint"}}
```

| コード | いつ | 本文 |
|---|---|---|
| `-32601` | 下の一覧に無い `method` | `Unsupported method: <名>` |
| `-32602` | `tools/call` の `name` が 12 のどれでもない | `Unknown tool: <名>` |

この二つ以外の JSON-RPC エラーコードは返らない。壊れた JSON の行はエラーではなく黙殺である。

### ツールのエラー

**ツールの中で起きた失敗は JSON-RPC のエラーにならない。**`result` が返り、その中に `isError: true` が立ち、本文が `content[0].text` に入る。エージェントはそれを読んで直せる。

```text
{"jsonrpc":"2.0","id":6,"result":{"content":[{"type":"text","text":"to (a string) is required"}],"isError":true}}
```

この経路を通るのは主に三つである。

**引数が足りない・型が違う。**`inputSchema` はサーバー側で強制されない。欠けた引数はツールの中で見つかる。

```text
file (a string) is required
```

**ファイルが読めない・構文や合成が壊れている。**`file` を受けるすべてのツールが同じ経路を通る。位置は本文の先頭に `<パス>:line <行>:` の形で付き、ファイル自体が読めないときは `line 0:` になる。

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

```text
<abs>/bad.muro:line 8: The region has zero width
```

**ここが [`koyu check --json`](../cli/check.md) との違いである。**CLI は構文・合成エラーを `SYN01` の診断一件に写して有効な JSON を返すが、MCP の [`check`](tools-verify.md#check) は `isError` を立てて素のメッセージを返す。`diagnostics` の配列は返らない。

**問いの引数が建物に無い。**未宣言のレベル名などがここに来る。

```text
There is no space with a region on level L9
```

(`<abs>` は解決済みの絶対パスを略した表記である。実際の出力にはフルパスが出る。)

## 実装されている method の全部

| method | 返り |
|---|---|
| `initialize` | `protocolVersion` / `capabilities` / `serverInfo` / `instructions` |
| `ping` | `{}` |
| `tools/list` | `{tools: [...]}` — 12 件 |
| `tools/call` | `{content: [{type:"text", text}], isError?: true}` |
| `resources/list` | `{resources: []}` — **常に空** |
| `prompts/list` | `{prompts: []}` — **常に空** |

`resources/list` と `prompts/list` は `capabilities` が宣言していないのに答える。**空を返すのは「持っていない」の意味であって、後から増える予告ではない。**建物の原本はリソースとして配らない — 読むのは [`layers`](tools-read.md#layers) の仕事である。

これ以外 (`resources/read` `prompts/get` `completion/complete` `logging/setLevel` `roots/list` など) はすべて `-32601` である。

## 関連

- [koyu-mcp](index.md) — 無状態であること・標準ループ・12 のツール
- [クライアントに登録する](install.md) — 手で JSON-RPC を流して確かめる
- [読む](tools-read.md) / [書く](tools-write.md) / [確かめる](tools-verify.md) / [問う](tools-ask.md) — 各ツールの引数と返り
- [koyu check](../cli/check.md) — CLI 側の `--json` が構文エラーをどう扱うか
