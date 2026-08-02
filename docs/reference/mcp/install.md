---
title: クライアントに登録する
mode: howto
---

# クライアントに登録する

`koyu-mcp` をエージェントのクライアントに繋ぐ。所要は一行から数行で、環境変数も認証鍵も要らない。

## 前提

- **Node 22 以上と `npx`。**サーバー自身は実行時依存を持たない。
- **`.muro` が git 管理下にあること。**[`write_layer`](tools-write.md#write_layer) は全置換で書き、取り消しを持たない。巻き戻しは git で行う。
- **エージェントに書かせる前にコミットしておくこと。**

## 起動コマンドは二択

どのクライアントでも、koyu 側が指定するのはこの一つだけである。

**npm から使う。**

```sh
npx -p @kensnzk/koyu koyu-mcp
```

**リポジトリをクローンして開発版を使う。**先に `npm install && npm run build` を通す。`dist/mcp.js` は実行時依存を持たないので、`node` から直接起動できる。

```sh
node /path/to/koyu/dist/mcp.js
```

transport は stdio、環境変数なし、認証なし、ネットワークアクセスなし。**クライアントに教えることはこの四点と起動コマンドだけである。**

## Claude Code (CLI)

一行で登録する。

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js   # 開発版
```

`claude mcp list` が登録済みのサーバーと接続状態を並べる。セッション中は `/mcp` でツール 12 個の一覧まで見える。

## リポジトリで共有する (プロジェクトスコープ)

リポジトリ直下に `.mcp.json` を置いてコミットすると、クローンした全員が同じ登録を持つ。`.muro` をリポジトリに置いている企てでは、これが既定にしてよい。

```json
{
  "mcpServers": {
    "koyu": {
      "command": "npx",
      "args": ["-p", "@kensnzk/koyu", "koyu-mcp"]
    }
  }
}
```

`.mcp.json` 由来のサーバーは初回に承認を挟む。承認するまで接続されず、一覧には保留として出る。

## Claude Desktop

「設定 → 開発者 → 構成を編集」で `claude_desktop_config.json` を開き、上と同じ `mcpServers` の形を書いてアプリを再起動する。

| OS | 置き場所 |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

**デスクトップアプリはシェルの PATH を継がないことがある。**`npx` や `node` は絶対パス (`which node` / `where node` の結果) で書くほうが確実である。

## その他の MCP クライアント

多くは同じ `mcpServers` 形の JSON を読む。キー名と置き場所はそのクライアントの流儀に従えばよい。

koyu 側が要求するのは次の四点だけである。

- transport は **stdio** (HTTP でも SSE でもない)
- 起動コマンドは上の二択のどちらか
- 環境変数は不要
- 認証は不要

サーバーは標準入力の行区切り JSON を読み、標準出力へ行区切り JSON を書く。標準入力が閉じたら終了コード 0 で終わる。詳しい面は[プロトコル](protocol.md)にある。

## entry は絶対パスで渡す

ツールの `file` 引数が相対パスのとき、それは**サーバープロセスのカレントディレクトリ**を基準に解決される。クライアントがどのディレクトリでサーバーを起動するかはクライアント次第なので、**絶対パスで渡すのが確実である。**

外すとこう返る。カレントディレクトリが `/tmp` だったときの例である。

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

## クライアント無しで確かめる

登録が疑わしいときは、エージェントを介さず stdio へ JSON-RPC を直接流す。リポジトリのルートで実行する。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.17.0"},"instructions":"Server for koyu, a space-first architectural description. Grasp the building with model_summary, read the original layers with layers, and edit with write_layer. check is the gatekeeper of the build and returns errors tagged layer:line — it guarantees structural consistency only. validate delivers the architectural verdicts, which are a separate and unfrozen surface. doors/light/site/spaces are different questions put to the same description. Form (plan_svg) is generated, never written."}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\n \"doors\": 2,\n \"path\": [\n  \"/L1/a\",\n  \"/L1/b\",\n  \"/out\"\n ]\n}"}]}}
```

インストール済みのパッケージで確かめるなら、末尾を `npx -p @kensnzk/koyu koyu-mcp` に、ファイルパスを絶対パスに差し替える。

同じ形で `{"jsonrpc":"2.0","id":3,"method":"tools/list"}` を投げると、12 件が `name` / `description` / `inputSchema` つきで返る。

## 関連

- [koyu-mcp](index.md) — 無状態であること・標準ループ・12 のツール
- [プロトコル](protocol.md) — `initialize` が名乗るもの、エラーの返り方
- [書く — write_layer / new_uids](tools-write.md) — 書き込みの爆発半径
- [koyu コマンド](../cli/index.md) — 同じ導出を人の手で呼ぶ
