---
title: 建物を層に割って import で合成する
mode: howto
---

# 建物を層に割って import で合成する

一棟の `.muro` を層に切り出し、`import` で合成する。分担して書き、例外を差分として重ね、衝突はビルドエラーで捕まえる。

**合成は時間と分担のためにあり、大きさのためではない。**一棟が大きいから分けるのではない。分担して書く、例外を差分として書く、計画の上に実測を重ねる — これが合成の用途である。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 一つのファイルとして [`koyu check`](../reference/cli/check.md) がエラー0で通っている `.muro` があること。
- 分担の単位 (階・敷地・建具・実測など) の見当がついていること。

## 1. base層 (entry) を決める

建物全体の一貫性 — 版・`name`・`unit`・`grid`・`level` — は base層が**一度だけ**宣言する。これらを集めたファイルが entry になる。

```muro-part
# main.muro
koyu 1.1
name 小さな事務所
unit mm

grid X 0 6400 12800
grid Y 0 8400

level L1 0 h:2800 slab:400
level L2 4200 h:2800 slab:400
level R 8400 slab:400
```

## 2. 残りを層に切り出して import する

空間・境界・ゾーン・アセット・敷地形状は、どの層に置いてもよい。切り口は分担の単位で決める。

```muro-part
import ./assets.muro
import ./L1.muro
import ./L2.muro
import ./as-built.muro
```

`import` のパスは、**それを書いたファイルからの相対**である (実行時のカレントディレクトリからではない)。同じファイルを二度 import しても、循環していても、合成は一度きりで冪等である。

## 3. 層は強度を持つ — 後の層ほど強い

**`import` 行の並びが強度の宣言である。**深さ優先で平坦化した列が層の順序であり、entry は添字0で最も弱く、**後の層ほど強い**。

```text
$ npx tsx src/cli.ts layers main.muro
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	assets.muro
  2	L1.muro
  3	L2.muro
  4	as-built.muro
```

**強度は走査の順ではない。**entry の宣言が `import` 行より後ろにあっても、entry は添字0のままである。順序で決めていたら、`import` 行を上下に動かしただけで結果が変わってしまう。

## 4. 強い層で値を差し替える — over

`over` は既にあるものの属性を差し替える。空間・ゾーン・境界・レベル・アセットを対象にとり、**書き方から対象の種別が決まる** — パス1つなら空間 (無ければゾーン)、パス2つなら境界、`level` / `asset` に続けて名を書けばそれぞれ。

```muro-part
# as-built.muro — 実測を計画の上に重ねる層
over /L1/office h:2600 spec:実測
over /L1/office /L1/core t:150
```

**`over` は定義ではない。**対象が既に合成されていなければエラーになる。

```text
✖ as-built.muro:line 6: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

**同じ層が同じ属性に二度意見を持つのはエラーである。**どちらが勝つかが決まらないからである。

```text
✖ as-built.muro:line 6: One layer holds two opinions about h on /L1/office (which one wins is undetermined)
```

対象の取り方と、`over` の届く範囲は [over / drop](../reference/muro/over-drop.md) にある。

## 5. 集合は明示された編集で合成する — `+` / `-` / `=`

**暗黙のマージはしない。**同じ座に複数の層が意見を持ちうるもの — 開口・`seg`・`area`・柱 — は、`over` の直下に字下げして編集を書く。

```muro-part
over /L1/office /out
  = window W-1F w:1800                       # 置換 (書いた属性だけを差し替える)
  + window w:900 h:1800 at:0.8 name:W-1F-b   # 追加
over /L2/office /L2/core
  - door D2                                  # 削除
```

**同一性は「含む対象 + その中で一意な名」である。**`name:` を持たない開口は編集の対象にできない — 指す言葉が無いからである。`+` で足す要素には `name:` が要る。名で指す仕組みは [改名に耐える識別](survive-a-rename.md) にある。

`- door D2` を書いた層を重ねると、その扉は消える。

```text
$ npx tsx src/cli.ts doors main.muro /L2/office /out
2 doors — /L2/office → /L2/core → /L1/core → /out

$ npx tsx src/cli.ts doors main.muro /L2/office /out   # - door D2 を重ねたあと
Cannot reach /out from /L2/office
```

## 6. まるごと消す — drop

```muro-part
drop /L2/office        # 空間 (その関係も一緒に消える)
drop /L1/a /L1/b       # 境界
drop column C1         # 柱の宣言
```

対象が無ければエラーになる。

```text
✖ as-built.muro:line 6: No such target for drop: /L2/nowhere
```

空間を落とすと、その空間が持っていた境界も一緒に落ちる。[`koyu diff`](../reference/cli/diff.md) がそう言う。

```text
$ npx tsx src/cli.ts diff main.muro dropped/main.muro
− space /L2/office (room 53.76 m2)
− boundary /L2/core | /L2/office
− boundary /L2/office | /out edge:W
```

## 7. 定義と上書きを区別する

| | 文 | 対象が既にあるとき | 対象が無いとき |
|---|---|---|---|
| **定義** | `space` `boundary` `zone` `asset` `level` `polygon` | **エラー** (重複) | 定義する |
| **上書き** | `over` | 上書きする | **エラー** |

二つは別の文であって、書き方から区別がつく。存在しないものに意見だけを足すのは、たいてい綴り違いか、層の順序の思い違いである。

## 確かめる

entry を `check` する。import は自動でたどられ、一棟として合成された結果が返る。**これが一棟のビルドの門番になる。**

```text
$ npx tsx src/cli.ts check main.muro
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

どの値をどの層が与えたかは `--attrs` が答える。API では同じものが `model.attrSrc` にあり、キーは `<種別>:<対象>:<属性キー>`、値は層の添字である。

```text
$ npx tsx src/cli.ts layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	assets.muro
  2	L1.muro
  3	L2.muro
  4	as-built.muro

Attribute provenance:
  boundary:/L1/office|/L1/core:t	← 4 as-built.muro
  space:/L1/office:h	← 4 as-built.muro
  space:/L1/office:spec	← 4 as-built.muro
```

**上書きの跡は機械形式には残らない。**`over` で `h:2600` にした模型と、最初から `h:2600` と書いた模型は、同じ正準JSONを与える。正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。

## 層を単体で check しない

層のファイルは `grid` も `level` も持たないので、単独では読めない。

```text
$ npx tsx src/cli.ts check L1.muro
✖ L1.muro:line 1: Undefined grid line name: X1
```

**検査はつねに entry に対して行う。**

## 衝突したとき

同じものを二つの層が宣言すると、合成はエラーになる。エラーは両者の出所を `ファイル:行` で言う。これらは診断ではなく**モデルが組み上がる前に止まる**エラーで、壊れた JSON を JSON パーサが弾くのと同じ層にある。

**空間パスの重複**

```text
✖ L2.muro:line 9: Duplicate space path: /L1/office (first seen in L1.muro at line 1)
```

パスは同一性そのものである。別の空間なら別のパスを与える。

**`grid` / `name` / 版の再宣言** — 層が単独で動くようにと基盤を書き足したとき。同値でもエラーである。

```text
✖ L2.muro:line 1: grid X is declared once (in the base layer when composing)
```

**アセット名の重複** — 建具の型を層ごとに書いたとき。

```text
✖ L2.muro:line 9: Duplicate asset name: W1 (first seen in assets.muro at line 2)
```

アセットは一つの層にまとめる。寸法違いが要るなら別の名前を与えるか、参照側で属性を上書きする (`window W1 h:1200`)。

## 何を合成しないか

- **案の分岐 (バリアント)。**分岐は git が持つ。
- **アセットの入れ子参照。**アセットはアセットを参照しない。
- **層ごとの名前空間接頭辞。**パスの階層がすでに名前空間である。
- **層の部分的な読み込み。**層は丸ごと合成される。

## 切り分けの例

同梱の `examples/house/` は 5 ファイルで次のように割っている。

| ファイル | 持つもの |
|---|---|
| `main.muro` | base層 — 版・名前・単位・グリッド・レベル、`import`、階を跨ぐ関係 |
| `assets.muro` | 建具アセット — 建具表にあたる層 |
| `site.muro` | 敷地と外部空間、塀・門扉 |
| `L1.muro` | 1階の空間と境界 |
| `L2.muro` | 2階の空間と境界 |

**階を跨ぐ関係 — 垂直境界と `stack` — はどの階の層にも属さないので base層に置く。**`boundary` は空間を前方参照してよいので、`L1.muro` / `L2.muro` を import する前に書いても後に書いても同じく通る。

**敷地形状は隔離した層に置く。**`polygon` は測量由来の所与であって設計の生成物ではない。`examples/tower/site-geometry.muro` は宣言が `polygon` 1 行だけの層である。

## 次に

- [基準階を一度だけ書く](typical-floors.md) — 例外階を差分の層として重ねる
- [改名に耐える識別](survive-a-rename.md) — `name:` が集合編集の指す先になる
- [敷地と外構を書く](describe-a-site.md) — polygon の隔離層の置き方
