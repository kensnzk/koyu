---
title: koyu を入れる
mode: howto
---

# koyu を入れる

koyu を手元で走らせる道は二つある — npm から入れるか、リポジトリをクローンするか。どちらでも同じ `koyu` コマンドが手に入る。

## 要るもの

**Node.js 22 以上。**それだけである。koyu は実行時依存を一つも持たないので、入れると入るのは koyu 自身だけである。

```sh
node --version
```

```text
v26.5.0
```

## npm から

### 一度だけ試す

インストールせずに走らせる。

```sh
npx -p @kensnzk/koyu koyu check first.muro
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

### プロジェクトに入れる

`.muro` を置くディレクトリで npm プロジェクトを作り、devDependency として入れる。CI で `koyu check` を門番に使うならこれである。

```sh
npm install --save-dev @kensnzk/koyu
```

`node_modules/.bin/` に二つの実行ファイルが入る。

```text
koyu
koyu-mcp
```

`npm run` のスクリプトからは名前だけで呼べる。

```json
{
  "scripts": {
    "check": "koyu check building/main.muro"
  }
}
```

### どこからでも使えるようにする

```sh
npm install --global @kensnzk/koyu
```

`koyu` と `koyu-mcp` が PATH に入る。

## ソースから

記法そのものに手を入れたいとき、あるいは公開版より先の状態を使いたいときはこちらである。[チュートリアル](index.md)もこの道で書いてある。

```sh
git clone https://github.com/kensnzk/koyu.git
cd koyu
npm install
```

リポジトリの中では、次の二つが同じ意味を持つ。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
npm run koyu -- check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

TypeScript のまま走っているので、ビルドは要らない。ビルドしたものが要るなら `npm run build` が `dist/` を吐き、`node dist/cli.js` が同じ答えを返す。

```sh
npm run build
node dist/cli.js check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## 入ったことを確かめる

4行のファイルを作って通す。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

```sh
koyu check first.muro
koyu plan first.muro -o first.svg
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
Generated the plan: first.svg
```

`first.svg` をブラウザで開くと、通り芯と淡い矩形が一つあって、**壁は一本も描かれていない**。そこから先は[はじめての .muro](index.md) が引き受ける。

## 出力について

**人向けの出力は英語である。**機械が読む面 (診断・判定・MCP) と同じ言葉に揃えてあり、ロケールを切り替える引数は無い。同じ文言の台帳を二つ持たないためである。`.muro` に書く名前は書き手の言葉なので、日本語のままで構わない。

終了コードは `check` が 0 (問題なし) / 1 (エラーあり) / 2 (入力が壊れている)。CI に繋ぐ形は [CI に組み込む](../reference/cli/ci.md)にある。

## 隣にあるもの

- **エディタ支援** — VS Code 用の拡張が `.muro` に色を付け、保存のたびに `check` を写す。[エディタ支援](../reference/cli/editor.md)。
- **MCP サーバー** — `koyu-mcp` を LLM エージェントのクライアントに繋ぐ。登録は一行で済む。[クライアントに登録する](../reference/mcp/install.md)。
- **プログラムから使う** — TypeScript から同じ導出を呼ぶ。[プログラムから建物を読む](first-program.md)。
