---
title: stdio で MCP を手で叩く
mode: howto
---

# stdio で MCP を手で叩く

エージェントもクライアントも外して、`koyu-mcp` に直接 JSON-RPC を流す手順である。

**使いどきは三つある。**

1. **登録が疑わしい。**サーバー単体が動くことを確かめれば、原因がクライアント側にあると切り分けられる。
2. **エージェントの言うことが信じられない。**同じ引数で自分で呼べば、返ってきたバイト列が読める。
3. **クライアントを自分で書いている。**返りの形と、エラーがどの層で返るかを確かめる必要がある。

以下の出力は実際に走らせて得たものである。パイプの終端はリポジトリをクローンした場合の `npx tsx src/mcp.ts` で、インストール済みのパッケージなら `npx -p @kensnzk/koyu koyu-mcp` に、ファイルパスを絶対パスに差し替える。

封筒の仕様 — `initialize` が名乗るもの、実装されている method の全部、エラーコードの一覧 — は[プロトコル](../reference/mcp/protocol.md)にある。この頁は**叩き方**である。

## 一番短い呼び出し

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

**`initialize` を先に送らなくてよい。**サーバーは初期化済みかどうかを覚えていないので、いきなり `tools/call` を投げても動く。行儀の良いクライアントは送るが、手で確かめるときは省ける。

標準入力が閉じた時点でサーバーは終了コード 0 で終わる。だから `printf` の出力を流し込むだけで一往復が完結する。

## 複数の呼び出しを一度に流す

**一行 = 一メッセージ**である。`printf '%s\n'` に引数を並べれば、その順に処理されて応答が順に返る。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

`id` を変えておくと、どの応答がどの要求のものか読める。

## 返りの中身を読めるようにする

`tools/call` の返りは、**JSON の文字列の中に JSON が入っている**二重構造である。生のままでは読めないので、剥がす。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spaces","arguments":{"file":"examples/two-rooms.muro","level":"L1"}}}' \
  | npx tsx src/mcp.ts \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const l of s.trim().split("\n"))console.log(JSON.parse(l).result.content[0].text)})'
```

```text
[
 {
  "path": "/L1/a",
  "type": "room",
  "name": "居室A",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<absolute path>/examples/two-rooms.muro"
 },
 {
  "path": "/L1/b",
  "type": "room",
  "name": "居室B",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<absolute path>/examples/two-rooms.muro"
 }
]
```

`node` を挟んでいるのは、**追加の道具を入れずに済ませるため**である。`jq` があるなら `jq -r '.result.content[0].text'` でも同じことができる。

`plan_svg` だけは文字列を返すツールなので、剥がした結果がそのまま SVG のソースになる。残りのツールは値のオブジェクトを**字下げ空白 1 個**で書いた JSON を返す。

## ツールの一覧と入力スキーマを見る

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx src/mcp.ts
```

12 件が `name` / `description` / `inputSchema` で返る。数だけ確かめるなら剥がして数える。

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | npx tsx src/mcp.ts \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s).result.tools;console.log(t.length);console.log(t.map(x=>x.name).join(" "))})'
```

```text
12
model_summary check layers write_layer new_uids doors spaces light validate site plan_svg canonical_json
```

**12 でなければ、古い版か別のプログラムに繋がっている。**

## エラーがどの層で返るかを確かめる

**二層ある。**この区別を知らないままクライアントを書くと、ツールの失敗をプロトコルの失敗として扱ってしまう。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"blueprint","arguments":{}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a"}}}' \
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"check","arguments":{"file":"nope.muro"}}}' \
  '{"jsonrpc":"2.0","id":6,"method":"resources/list"}' \
  '{"jsonrpc":"2.0","id":7,"method":"completion/complete"}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"Unknown tool: blueprint"}}
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"to (a string) is required"}],"isError":true}}
{"jsonrpc":"2.0","id":5,"result":{"content":[{"type":"text","text":"line 0: Cannot read file: <absolute path>/nope.muro"}],"isError":true}}
{"jsonrpc":"2.0","id":6,"result":{"resources":[]}}
{"jsonrpc":"2.0","id":7,"error":{"code":-32601,"message":"Unsupported method: completion/complete"}}
```

- **`error` で返るのはプロトコルの誤りだけ** — 知らない method (`-32601`) と、12 に無いツール名 (`-32602`)。
- **ツールの中で起きた失敗は成功した応答である。**`result` が返り、`isError: true` が立ち、本文が `content[0].text` に入る。エージェントはこれを読んで自分で直せる。
- **`resources/list` と `prompts/list` は空を返す。**「持っていない」の意味であって、後から増える予告ではない。

`id: 5` の返りは、`file` が相対パスのときそれが**サーバープロセスのカレントディレクトリ**を基準に解決されることを示している。実際のパスを見れば基準がどこかが分かる。

## 書き込みを安全に試す

`write_layer` は原本を書き換えるので、**必ず作業用のコピーに対して試す。**そのうえで、次の三つは原本に触れずに返る。

**parse できない内容は書かれない。**

```text
{
 "written": false,
 "target": "<dir>/rooms.muro",
 "ok": false,
 "parseError": "<dir>/rooms.muro:line 1: Undefined grid line name: X9"
}
```

**entry のディレクトリの外へは書けない。**

```text
Cannot write outside the entry's directory
```

**`.muro` 以外は書けない。**

```text
Only .muro files can be written
```

一方で、**parse は通るが `check` がエラーになる内容は書かれる。**これは仕様であって事故ではない。複数レイヤーにまたがる編集を段階的に進めるための余地である。

```text
{
 "written": "<dir>/rooms.muro",
 "ok": false,
 "spaces": 2,
 "errors": [
  "<dir>/rooms.muro:line 3: References an undefined space: /L1/c"
 ],
 "warnings": []
}
```

`content` に**空文字列は渡せない。**空にしたければコメント一行を書く。

```text
content (a string) is required
```

## 返事が来ないとき

サーバーは**壊れた行を黙って捨てる。**JSON として読めない行にエラーは返らない。応答が一つも来ないときの原因は、ほぼこれである。

| 症状 | 疑うところ |
|---|---|
| 応答が一つも出ない | その行が JSON として壊れている。シェルの引用符 — 特に `content` に入れる `\n` の綴り |
| 応答が一つ足りない | `id` を持たないメッセージ (通知) には応答しない |
| `Cannot read file:` | `file` が相対パス。サーバープロセスのカレントディレクトリを基準に解決される |
| ファイルパスが化ける | 日本語を含むパスは NFC で書く |

`content` に複数行を渡すときの綴りは、JSON の中では `\n` (バックスラッシュ + n) であって実際の改行ではない。**行の中に生の改行が入った瞬間、その行は二つの壊れた行になる。**

## 関連

- [プロトコル](../reference/mcp/protocol.md) — 封筒の仕様とエラーコードの全部
- [MCP をクライアントに登録する](install-mcp.md) — 手順 4 がこの頁の入口である
- [エージェントに書かせる標準ループ](agent-loop.md) — 手で叩いて確かめたことを、そのまま作業の順序にする
- [書く — write_layer / new_uids](../reference/mcp/tools-write.md) — 書き込みの爆発半径
- [koyu-mcp](../reference/mcp/index.md) — 無状態であることと 12 のツール
