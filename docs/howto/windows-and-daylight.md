---
title: 窓を開けて採光を通す
mode: howto
---

# 窓を開けて採光を通す

居室に窓を書き、[`koyu light`](../reference/cli/light.md) の 1/7 判定 — 有効窓面積 ≥ 床面積 ÷ 7 — を通す。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- [`koyu check`](../reference/cli/check.md) がエラー0で通っていること。
- どの室に採光の判定を掛けたいかが決まっていること。**koyu は推し量らない。**

## 1. 判定に掛けると宣言する

`light` が見るのは `daylight:1` を書いた空間**だけ**である。**型は一切見ない。**判定を掛けるかどうかは書き手が宣言することであって、室の名前から推し量るものではない。既定は対象外なので、`daylight` を一つも書かなければ何も判定されない。

```muro-part
space /L1/a bedroom X1..X2 Y1..Y2 name:寝室 daylight:1     # 判定に入る
space /L1/b wet     X2..X3 Y1..Y2 name:洗面脱衣            # 既定は対象外
space /L1/c wet     X3..X4 Y1..Y2 name:浴室 daylight:1     # 型は wet のまま判定する
```

`daylight:0` は既定と同じ意味だが、「意図して対象から外した」と読み手に伝えるために書いてよい。値は 0 か 1 だけである。

```text
✖ scope.muro:line 10: daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes
✖ scope.muro:line 11: daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/b carries daylight:yes
```

**判定の分母をどの粒度に置くかも、`daylight:1` を書く位置で決まる。**住戸を割らずに `unit` の行に書けば住戸まるごとが一室として判定され、LDK・洋室に割って書けば室ごとに判定される。どちらも正しく、基本計画の解像度をどこに置くかの選択である。

**対象が一つも無いとき `light` は終了コード 0 を返す** — 「全室合格」と見分けが付かない。判定されるはずの室が出てこないときは、まず `daylight:1` の書き忘れを疑う。

```text
$ npx tsx src/cli.ts light daylight-noscope.muro
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

## 2. 外に面する境界に `window` を書く

窓が数えられるのは、その境界の相手が**外部 (`exterior`) か半屋外の空間**のときだけである。室と室のあいだの窓は採光に算入されない (0 として扱われる)。

```muro-part
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:掃き出し窓
```

`window` に置ける属性は [window](../reference/muro/window.md) にある。

## 3. `w:` と `h:` の両方を書く

幅 `w:` は文法上の必須で、無ければ読み込みの時点で止まる。

```text
✖ daylight-now.muro:line 17: window requires a width w:(mm) (the asset may supply it)
```

高さ `h:` は文法上は任意だが、**`light` は `h:` を持つ窓しか数えない。**`h:` を落とした窓はエラーにならないまま面積 0 として扱われ、`light` が行末に注記を出す。

```text
✖ /L1/a	居室A	window 0.00 m2 / floor 16.20 m2 = no window (needs 1/7 ≈ 2.31 m2) ⚠ windows without h: are not counted
```

建具アセットを参照するなら `h:` はアセット側にあってよい ([asset](../reference/muro/asset.md))。

## 4. 外周の線分が複数あるときは `edge:` で辺を選ぶ

領域を持たない空間 (`/out` など) との境界は、部屋の外周から他の空間と接する区間を除いた残りであり、たいてい複数の辺に分かれる。どの辺に置くかは `edge:N/E/S/W` で指定する。方角は N が +Y、S が −Y、E が +X、W が −X で、境界の行に**先に書いた空間**の矩形から見る。

```text
✖ daylight-noedge.muro:line 17: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)
```

## 確かめる

`light` を走らせる。全室が満たせば終了コード 0、一室でも足りなければ 1 である。

```muro
koyu 1.1
name 採光の稽古
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
level R 2700 slab:150

space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B daylight:1
space /out name:外部 outside:1

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
✔ /L1/a	居室A	window 5.72 m2 / floor 16.20 m2 = 1/2.8 (needs 1/7 ≈ 2.31 m2)
✔ /L1/b	居室B	window 2.86 m2 / floor 16.20 m2 = 1/5.7 (needs 1/7 ≈ 2.31 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

行の読み方は左から、判定・空間パス・名前・**係数をかけた後の**有効窓面積・床面積・その比・必要面積である。窓を一枚も持たない室は `no window` と出る。

窓を落としたままの同じ二室はこうなる。

```text
✖ /L1/a	居室A	window 0.00 m2 / floor 16.20 m2 = no window (needs 1/7 ≈ 2.31 m2)
✖ /L1/b	居室B	window 0.00 m2 / floor 16.20 m2 = no window (needs 1/7 ≈ 2.31 m2)
✖ Short of 1/7: 2 of 2 rooms (this is a validation judgement)
```

同じことは [`koyu validate`](../reference/cli/validate.md) が `daylight.ratio` (violation) として言う。CI で止めるならこちらを使う。

```text
✖ [daylight.ratio] daylight-none.muro:line 10: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [daylight.ratio] daylight-none.muro:line 11: Insufficient daylight: /L1/b — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
```

## 半屋外越しに採るとき

バルコニー・テラス・庭を介した窓には係数がかかる。**その半屋外の上に空間が重なっていれば 0.7、上が開いていれば 1.0** である。屋根の有無も宣言ではなく導出されるので、上階にバルコニーを足した時点で下階の係数が落ちる。

上が開いたテラス越しの掃き出し窓 (2600×2200 = 5.72㎡) は、そのまま 5.72㎡ と数えられる。

```muro
koyu 1.1
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400 slab:150
level R 2700 slab:150

space /L1/liv living  X1..X2 Y1..Y2      name:居間 daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /out name:外部 outside:1

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	window 5.72 m2 / floor 16.00 m2 = 1/2.8 (needs 1/7 ≈ 2.29 m2)
```

同じ位置に上階のバルコニーを足すと、テラスは庇下になり 0.7 がかかる。**窓も床も一切変えていない。**

```muro
koyu 1.1
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /L1/liv living  X1..X2 Y1..Y2      name:居間 daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /L2/bal balcony X1..X2 Y1-1500..Y1 name:上階バルコニー
space /out name:外部 outside:1

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
boundary /L2/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	window 4.00 m2 / floor 16.00 m2 = 1/4.0 (needs 1/7 ≈ 2.29 m2)
```

**空間が半屋外と判定されるのは、外部に対して `open` か `air:1` の境界を持つ領域つき空間のときだけである。**手すりの `air:1` を書き忘れたバルコニーは半屋外にならず、そこを介した窓は 0 になる。

```text
✖ /L1/liv	居間	window 0.00 m2 / floor 16.00 m2 = no window (needs 1/7 ≈ 2.29 m2)
✖ Short of 1/7: 1 of 1 room (this is a validation judgement)
```

## 足りないとき

`✖` の行は必要面積をそのまま出す。有効窓面積がそこに届くまで、次のいずれかを取る。

- **窓を大きくする、または枚数を増やす。**有効窓面積は同じ空間に接する全境界上の窓の合計である。
- **半屋外越しなら、直接外部に面する境界へ窓を移す。**係数が 1.0 になる。
- **そもそも判定を要さない室なら `daylight:1` を外す。**意図を残すなら `daylight:0` と明記する。
- **床を小さくする。**1/7 は面積比なので、奥行の深い室は幅いっぱいの窓でも届かないことがある。寸法の当たりは [書く前に寸法を決める](choose-dimensions.md) にある。

`light` は補正係数を掛けない粗い早期警報であって、法適合の判定ではない。何を保証し何を保証しないかは [採光の判定](../reference/validate/daylight.md) にある。

## 次に

- [住戸を室に割る](subdivide-a-unit.md) — 割ると採光の宣言も動く
- [敷地と外構を書く](describe-a-site.md) — 庭が「上が開いている」ことが係数に効く
- [到達できない空間を見つける](find-unreachable.md) — 窓しか無いバルコニーには出られない
