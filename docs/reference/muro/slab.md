---
title: slab — 床組み
mode: reference
---

# slab — 床組み

```text
level <名> <z> [h:天井高] [slab:床組み厚] [underground:1]
```

`slab:` は[レベル](level.md)の属性であり、その階の**床組みの厚さ mm** — 下階の天井面から自階の FL までに納まるスラブ・懐・仕上げの合計 — を与える。

**床を置く行は無い。**`slab:` を書いた時点で床は既に宣言されていて、面はそこから導出される。壁が境界から現れ、[柱](column.md)が通り芯の交点から現れるのと同じ構えである。床を置く操作も、天井を張る操作も、屋根を架ける操作も存在しない。

## 床が生成される条件

そのレベルの空間のうち、次をすべて満たすものに床が架かる。

- 領域を持つ
- `type:void` ではない — **床の不在こそが吹抜けの定義である**
- `type:exterior` ではない — 外部は地面である
- そのレベルに `slab:` がある

床の z 範囲は **FL − slab から FL まで**である。輪郭は導出された凸片なので、[描かれた線](line.md)で切られていれば床も斜めになる。

```muro
koyu 1.0
name 床組みの例
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200
level L2 3200 h:2700 slab:250
level R 6400 slab:250

space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

この二室から生成される面はこうなる。

| 面 | 空間 | z 範囲 |
|---|---|---|
| 床 | /L1/a | −200 … 0 |
| 天井 | /L1/a | 2670 … 2700 |
| 床 | /L2/a | 2950 … 3200 |
| 天井 | /L2/a | 5870 … 5900 |
| 屋根 | /L2/a | 6150 … 6400 |

`/L1/a` に屋根が無いのは、上に `/L2/a` が重なっているからである。屋根は「上に空間が重なっていない範囲」にだけ架かる。

## slab を書かなければ、床は一枚も出ない

**既定値を捏造しない。**必要な値が書かれていなければ、勝手に既定を置くのではなくその要素を作らない。だから `slab:` の無いレベルには床が一枚も生成されず、そのことが言葉になる。

```muro-warn
koyu 1.0
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200
level L2 3200 h:2700
level R 6400 slab:250
space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

```text
⚠ Level L2 has no slab:, so not one floor is generated on this storey
```

形は定まるので警告である (SUF03)。上の例で消えるのは `/L2/a` の床の一枚だけで、天井も屋根もそのまま生成される。

## 階高の不変量は、上の階の slab を読む

各空間について **天井高 + 上階の slab ≤ 階高** が検査される。階高は次のレベルの z までの差である。超えれば上階への食い込みであり、エラーになる。

```muro-bad
koyu 1.0
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:3100 slab:200
level L2 3200 h:2700 slab:250
level R 6400 slab:250
space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

```text
✖ /L1/a collides into the floor above: ceiling height 3100 + L2's slab 250 = 3350 > storey height 3200
```

**自階の `slab:` は自階の天井高には効かない。**効くのは上階の `slab:` である — 下階の天井の上に載る床組みだからである。`koyu levels` がこの積み上がりをテキストの矩計として見せる。

```text
R	z:6400	slab:250
L2	z:3200	h:2700	slab:250
  ↑ storey height 3200 = ceiling 2700 + slab 250 + 250 left over
L1	z:0	h:2700	slab:200
  ↑ storey height 3200 = ceiling 2700 + slab 250 + 250 left over
```

「余り」は天井裏の懐である。負にはならない — 負になる前に食い込みのエラーが立つ。

## 屋根の厚さも slab が与える

屋根の頂点と厚さは、上のレベルがあるかどうかで式が切り替わる。

| | 頂点 | 厚さ |
|---|---|---|
| 上のレベルがある | そのレベルの z | そのレベルの `slab`、無ければ 200mm |
| 上のレベルが無い | FL + 天井高 + 200mm | 200mm |

**上のレベルがあるときは天井高を読まない。**だから天井高が決まらなくても屋根は生成される。上の例の `/L2/a` の屋根が 6150 … 6400 に架かるのは、レベル `R` が z:6400 slab:250 を持っているからである。

空間を持たないレベル (屋上の `R` など) を宣言する意味はここにある — 最上階の高さ検査の上限になり、屋根版の厚さを与える。

## 空間ごとの床仕上げは別の語彙

`slab:` は構造の厚みであって、仕上げの名ではない。床の仕上げは[空間](space.md)の `floor:` (運搬層) が運び、室内の一部だけ変えるなら字下げの `area` が区間上書きする。

## 診断

| コード | severity | 何を言うか |
|---|---|---|
| SUF03 | warning | レベルに `slab:` が無く、その階の床が一枚も生成されない |
| HGT01 | error | 高さ不変量の違反 — 天井高 + 上階の `slab` が階高を超える |
| HGT02 | error | 部分吹抜けの被覆不足 — 被覆 99% 未満では階をまたぐ天井高を宣言できない |

`level` の行に書けるのは `h` / `slab` / `pitch` / `underground` の四つだけで、それ以外のキーは parse がその場で止める。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [level](level.md) — `slab:` を書く行
- [space](space.md) — 床が架かる相手
- [line](line.md) — 床の輪郭を切る
- [koyu levels](../cli/levels.md) — 矩計として積み上がりを見せる
- [koyu check](../cli/check.md)
