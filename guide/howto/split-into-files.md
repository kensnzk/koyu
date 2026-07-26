[English](../en/howto/split-into-files.md) · **日本語**

# import で一棟を複数ファイルに割る

一つの `.muro` を層に切り出し、`import` で一棟として合成する。分担して書き、衝突はビルドエラーで捕まえる。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためディレクトリの頭を縮めてある。

## 前提

- 一つのファイルとして `check` がエラー0で通っている `.muro` があること。
- 分担の単位 (階・敷地・建具など) の見当がついていること。

## 手順

### 1. base層 (entry) を決める

建物全体の一貫性 — `koyu` (版) `name` `unit` `grid` `level` — は base層が**一度だけ**宣言する。これらをどこか一つの層に集めたファイルが entry になる。

```muro-part
koyu 0.4
name 小さな戸建住宅
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R 5800 slab:500
```

### 2. 残りを層に切り出す

空間・境界・ゾーン・アセット・敷地形状は、どの層に置いてもよい。切り口は分担の単位で決める。`examples/house/` は 5 ファイル 102 行で次のように割っている。

| ファイル | 持つもの |
|---|---|
| `main.muro` | base層 — 版・名前・単位・グリッド・レベル、`import`、階を跨ぐ関係 |
| `assets.muro` | 建具アセット (`asset`) — 建具表にあたる層 |
| `site.muro` | 敷地と外部空間 (`/site` `/out`)、塀・門扉 |
| `L1.muro` | 1階の空間と境界 |
| `L2.muro` | 2階の空間と境界 |

層は加算されるだけで、あとから読まれた層が先の層を黙って上書きすることはない。レイヤー強度のような仕組みは無い。

### 3. base層から `import` で重ねる

`import` のパスは、**それを書いたファイルからの相対**である (実行時のカレントディレクトリからではない)。

```muro-part
import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

同じファイルを二度 import しても、循環していても、合成は一度きりで冪等である。

### 4. 階を跨ぐ関係は base層に置く

垂直境界 (`type:stair` / `shaft` / `void`) と `stack` は、どの階の層にも属さない。base層に置く。

```muro-part
zone /home name:住戸 use:exclusive

boundary /home/hall1 /home/hall2 type:stair
boundary /home/ldk /home/void type:void
```

`boundary` は空間を前方参照してよい。上の 2 行は `L1.muro` / `L2.muro` を import する前に書いても、後に書いても同じく通る。

### 5. 敷地形状は隔離層に置く

`polygon` は測量由来の所与であり、設計の生成物ではない。別ファイルに分けて import する運用を標準とする。`examples/tower/site-geometry.muro` は宣言が `polygon` 1 行だけの層である。

## 確かめる

entry を `check` する。import は自動でたどられ、一棟として合成された結果が返る。これが一棟のビルドの門番になる。

```text
$ npx tsx src/cli.ts check examples/house/main.muro
✔ 整合 — 空間 13 / 境界 31
```

`stats` や `plan` も entry を渡せば合成後のモデルを見る。合成に参加した層の一覧が要るときは、MCP の `layers` ツールが `{file, source}` を返す ([spec/tools.md](../../spec/tools.md))。

## 層を単体で check しない

層のファイルは `grid` も `level` も持たないので、単独では読めない。

```text
$ npx tsx src/cli.ts check examples/house/L1.muro
✖ examples/house/L1.muro:3行目: 未宣言のレベルです: level:L1
```

検査はつねに entry に対して行う。

## 衝突したとき

同じものを二つの層が宣言すると、合成はエラーになる。エラーは両者の出所を `ファイル:行` で言う。

**空間パスの重複** — 別の階の層が同じパスを使ったとき。

```muro-part
# L2.muro に足すと
space /home/ldk   ldk  X1..X2 Y1..Y3 level:L2 name:LDK上部
```

```text
✖ house/L2.muro:6行目: 空間パスが重複しています: /home/ldk (既出: house/L1.muro:3行目)
```

パスは同一性そのものである。別の空間なら別のパスを与える。

**`grid` / `name` の再宣言** — 層が独立に動くようにと基盤を書き足したとき。

```text
✖ house/L2.muro:3行目: grid X は一度だけ宣言します (合成時はbase層で)
```

base層から消さずに、層の側の行を消す。

**アセット名の重複** — 建具の型を層ごとに書いたとき。

```text
✖ house/L2.muro:3行目: アセット名が重複しています: W1 (既出: house/assets.muro:7行目)
```

アセットは一つの層にまとめる。寸法違いが要るなら別の名前を与えるか、参照側で属性を上書きする (`window W1 h:1200`)。

## 関連

- [how-to 一覧](README.md)
- [敷地を書いて建蔽率・容積率を出す](site-and-far.md) — `polygon` の隔離層の置き方
- [MCP でエージェントに繋ぐ](agent-mcp.md) — 層単位で読み書きさせる (`layers` / `write_layer`)
- [チートシート](../cheatsheet.md) — `import` を含む全構文の一覧
- [spec/language.md](../../spec/language.md) §8 import — 合成の規則
- [spec/tools.md](../../spec/tools.md) — 合成の入口 (`parse` / `parseFiles` / `parseFile` / `parseWith`)
- [ADR-0010](../../docs/decisions/0010-assets-and-composition.md) — 加算合成を選び、レイヤー強度を採らなかった理由
- [ADR-0011](../../docs/decisions/0011-site-polygon.md) — 敷地形状を隔離層に置く運用
- 5 ファイルの実例 — `examples/house/`、9 ファイルの実例 — `examples/tower/` ([実例集](../gallery.md))
