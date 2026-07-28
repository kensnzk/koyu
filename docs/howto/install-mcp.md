---
title: MCP をクライアントに登録する
mode: howto
---

# MCP をクライアントに登録する

`koyu-mcp` をエージェントのクライアントに繋ぎ、**繋がったことを一段ずつ確かめる**までの手順である。所要は数分で、環境変数も認証鍵もネットワークも要らない。

登録の形そのもの — クライアント別の設定ファイルの置き場所、起動コマンドの二択、`.mcp.json` の綴り — は[クライアントに登録する](../reference/mcp/install.md)に一枚で並んでいる。この頁が足すのは**順序と、各段の確認**である。「登録したのにエージェントが建物を読めない」の原因は、ほぼすべてこの確認のどれかを飛ばしたところにある。

## 0. 先にコミットする

これが最初の手順である。

```sh
git add . && git commit -m "before letting the agent write"
```

[`write_layer`](../reference/mcp/tools-write.md#write_layer) はレイヤーを**全置換**で書き、取り消しを持たない。サーバーは版を一つも保存しない。巻き戻し・分岐・レビューはすべて git の仕事である。

登録より前にこれを書いているのは、順序として先だからである。**繋いだ直後にエージェントは書ける。**

## 1. Node を確かめる

```sh
node --version
```

**Node 22 以上が要る。**サーバー自身は実行時依存を一つも持たないので、これ以外に入れるものは無い。

## 2. 登録する

npm から使うなら一行である。

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

リポジトリをクローンした開発版なら、先に `npm install && npm run build` を通してから `dist/mcp.js` を直接指す。

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js
```

チームで共有するなら、リポジトリ直下の `.mcp.json` に同じ起動コマンドを書いてコミットする。他のクライアント (Desktop など) の設定ファイルの置き場所と、`.mcp.json` の書式は[クライアントに登録する](../reference/mcp/install.md)にある。

## 3. 繋がったことを確かめる

```sh
claude mcp list
```

`✓ Connected` が出るまで次に進まない。`.mcp.json` から来たサーバーは初回に承認を挟むので、承認するまでは保留のまま並ぶ。

セッション中は `/mcp` がツールの一覧まで見せる。**12 個あれば正しい。**数が違うなら、古い版に繋がっている。

## 4. サーバーが単体で動くことを確かめる

クライアントの一覧が疑わしいときは、クライアントを外して直接確かめる。これが原因の切り分けになる — 下が通ってクライアントで見えないなら、問題はクライアント側の設定にある。

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

手で叩く道具立ての全部は[stdio で MCP を手で叩く](debug-mcp.md)にある。

## 5. 自分の建物を読ませる

ここが最後の関門である。**entry のパスは絶対パスで渡す。**

ツールの `file` 引数が相対パスのとき、それは**サーバープロセスのカレントディレクトリ**を基準に解決される。クライアントがどのディレクトリでサーバーを起動するかはクライアント次第なので、相対パスは当たったり外れたりする。

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

これが出たら、パスの綴りではなく**基準ディレクトリ**を疑う。絶対パスに直せば消える。

エージェントへの最初の指示は、絶対パスを与えたうえでこう言えばよい。

```text
/Users/me/work/house/main.muro を model_summary で読んで、何が書かれているか要約して
```

返ってくる要約に、レイヤー構成・レベル・面積・`check` の件数が並んでいれば、登録は完了している。[`model_summary`](../reference/mcp/tools-read.md#model_summary) が何を返すかはリファレンスにある。

## 繋がらないときの切り分け

| 症状 | 見るところ |
|---|---|
| `claude mcp list` に出ない | 登録コマンドを打ったスコープ (ユーザー / プロジェクト) を確かめる |
| 保留のまま | `.mcp.json` 由来のサーバーは初回に承認が要る |
| 接続はするがツールが 0 個 | 起動コマンドが別のプログラムを指している。手順 4 を直接実行する |
| Desktop アプリだけ繋がらない | デスクトップアプリはシェルの `PATH` を継がないことがある。`npx` や `node` を絶対パス (`which node` の結果) で書く |
| ツールは見えるが `Cannot read file:` | 手順 5 — `file` を絶対パスにする |
| `Unknown tool:` | ツール名の綴り違い。名前の全部は[koyu-mcp](../reference/mcp/index.md) |

## 次に読む

- [エージェントに書かせる標準ループ](agent-loop.md) — 繋いだ後の作業の順序
- [stdio で MCP を手で叩く](debug-mcp.md) — クライアントを外して原因を掴む
- [クライアントに登録する](../reference/mcp/install.md) — 設定ファイルの形と置き場所
- [koyu-mcp](../reference/mcp/index.md) — 無状態であることと 12 のツール
