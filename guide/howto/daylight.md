[English](../en/howto/daylight.md) · **日本語**

# 窓を開けて採光判定を通す

居室に窓を書き、`light` の 1/7 判定 (有効窓面積 ≥ 床面積/7) を通す。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- `check` がエラー0で通っていること。
- どの室に採光の判定を掛けたいかが決まっていること (koyu は推し量らない — 書き手が宣言する)。

## 手順

### 1. その空間に判定を掛けると宣言する

`light` が見るのは `daylight:1` を書いた空間**だけ**である。型は一切見ない — 判定を掛けるかどうかは書き手が宣言することであって、室の名前から推し量るものではない ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md))。既定は対象外なので、`daylight` を一つも書かなければ何も判定されない。

```muro-part
space /L1/a bedroom X1..X2 Y1..Y2 name:寝室 daylight:1     # 判定に入る
space /L1/b wet     X2..X3 Y1..Y2 name:洗面脱衣       # 既定は対象外 — 入らない
space /L1/c wet     X3..X4 Y1..Y2 name:浴室 daylight:1     # 型は wet のまま判定する
```

`daylight:0` は既定と同じ意味だが、「意図して対象から外した」と読み手に伝えるために書いてよい。値は 0 か 1 だけで、`daylight:yes` のような綴りはエラーになる (DAY01)。

判定の分母をどの粒度に置くかも、`daylight:1` を書く位置で決まる。住戸を割らずに `unit` の行に書けば住戸まるごとが一室として判定され、ldk・bedroom に割って書けば室ごとに判定される。どちらも正しく、基本計画の解像度をどこに置くかの選択である。

**対象が一つも無いとき `light` は終了コード 0 を返す** — 「全室合格」と見分けが付かない。判定されるはずの室が出てこないときは、まず `daylight:1` の書き忘れを疑う。

### 2. 外に面する境界に `window` を書く

窓が数えられるのは、その境界の相手が外部 (`type:exterior`) か半屋外の空間のときだけである。室と室のあいだの窓は採光に算入されない (0 として扱われる)。

```muro-part
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:掃き出し窓
```

### 3. `w:` と `h:` の両方を書く

幅 `w:` は文法上の必須で、無ければ読み込みの時点で止まる。

```text
✖ daylight.muro:16行目: window には幅 w:(mm) が要ります (アセット側でも可)
```

高さ `h:` は文法上は任意だが、`light` は `h:` を持つ窓しか数えない。`h:` を落とした窓は、エラーにならないまま面積 0 として扱われる。

`h:` の無い窓があると `light` が行末に注記を出す。

```text
✖ /L1/a	居室A	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡) ⚠ h未指定の窓は数えていません
```

建具アセットを参照するなら `h:` はアセット側にあってよい ([spec/language.md §6](../../spec/language.md))。

### 4. 外周の線分が複数あるときは `edge:` で辺を選ぶ

領域を持たない空間 (`/out` など) との境界は、部屋の外周から他の空間と接する区間を除いた残りであり、たいてい複数の辺に分かれる。どの辺に置くかは `edge:N/E/S/W` で指定する。方角は N が +Y (北)、S が −Y (南)、E が +X (東)、W が −X (西) で、a側 (境界の行に先に書いた空間) の矩形から見る。

`edge:` を書かずに複数線分の境界へ開口を置くと、`check` はこう言う。

```text
✖ daylight.muro:16行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)
```

## 確かめる

`light` を走らせる。全室が満たせば終了コード 0、一室でも足りなければ 1 である。

次のファイルは二室とも判定を通る。

```muro
koyu 0.4
name 採光の稽古
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400

space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B daylight:1
space /out exterior name:外部

boundary /L1/a /L1/b t:120
  door w:780 h:2000
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:掃き出し窓
boundary /L1/b /out t:150 spec:EW
  door w:900 h:2100 edge:S at:X2+900 name:玄関
  window w:2600 h:1100 edge:E name:腰窓
```

```text
$ npx tsx src/cli.ts light daylight.muro
✔ /L1/a	居室A	窓 5.72㎡ / 床 16.20㎡ = 1/2.8 (必要 1/7 ≈ 2.31㎡)
✔ /L1/b	居室B	窓 2.86㎡ / 床 16.20㎡ = 1/5.7 (必要 1/7 ≈ 2.31㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

行の読み方は左から、判定 (✔/✖)・空間パス・名前・**係数をかけた後の**有効窓面積・床面積・その比・必要面積である。窓を一枚も持たない室は「窓なし」と出る。

窓を落としたままの同じ二室はこうなる。

```text
✖ /L1/a	居室A	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ /L1/b	居室B	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ 2室中 2室が不足しています
```

## 半屋外越しに採るとき

バルコニー・テラス・庭を介した窓には係数がかかる。その半屋外の**上に空間が重なっていれば 0.7**、上が開いていれば 1.0 である。屋根の有無も宣言ではなく導出されるので、上階にバルコニーを足した時点で下階の係数が落ちる。

上が開いたテラス越しの掃き出し窓 (2600×2200 = 5.72㎡) は、そのまま 5.72㎡ と数えられる。

```muro
koyu 0.4
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400

space /L1/liv living  X1..X2 Y1..Y2      name:居間 daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /out exterior name:外部

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	窓 5.72㎡ / 床 16.00㎡ = 1/2.8 (必要 1/7 ≈ 2.29㎡)
```

同じ位置に上階のバルコニーを足すと、テラスは庇下になり 0.7 がかかる。窓も床も一切変えていない。

```muro
koyu 0.4
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /L1/liv living  X1..X2 Y1..Y2      name:居間 daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /L2/bal balcony X1..X2 Y1-1500..Y1 name:上階バルコニー
space /out exterior name:外部

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
boundary /L2/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	窓 4.00㎡ / 床 16.00㎡ = 1/4.0 (必要 1/7 ≈ 2.29㎡)
```

なお空間が半屋外と判定されるのは、外部に対して `open` または `air:1` の境界を持つ領域つき空間である。手すり (`air:1`) を書き忘れたバルコニーは半屋外にならず、そこを介した窓は 0 になる。

## 足りないとき

`✖` の行は必要面積 (`必要 1/7 ≈ …㎡`) をそのまま出す。有効窓面積がそこに届くまで、次のいずれかを取る。

- 窓を大きくする、または枚数を増やす。有効窓面積は同じ空間に接する全境界上の窓の合計である。
- 半屋外越しなら、直接外部に面する境界へ窓を移す (係数が 1.0 になる)。
- そもそも判定を要さない室なら、`daylight:1` を外す (意図を残すなら `daylight:0` と明記する)。

`light` は補正係数を掛けない粗い早期警報であり、法適合の判定ではない ([spec/semantics.md §6](../../spec/semantics.md))。

## 関連

- [how-to 一覧](README.md)
- [六つの考え](../concepts.md) — 型が開かれた語彙であること、半屋外が導出であること
- [チートシート](../cheatsheet.md) — `window` に置ける属性の一覧
- [spec/semantics.md](../../spec/semantics.md) §4 導出される性質・§6 light — 規範の定義
- [spec/vocabulary.md](../../spec/vocabulary.md) — `window` / `space` の属性の契約
- [ADR-0007](../../docs/decisions/0007-semi-outdoor-air.md) — 半屋外を `air:1` から導出すると決めた理由
- 実例 — `examples/house/` (庭越し・係数1.0) と `examples/tower/` (バルコニー越し・係数0.7)、[実例集](../gallery.md)
