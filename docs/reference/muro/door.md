---
title: door — 通行する開口
mode: reference
---

# door — 通行する開口

```
boundary /pathA /pathB …
  door [アセット名] w:900 [h:2100] [at:…] [edge:…] [hinge:…] [swing:…] [style:…] [name:…]
```

`door` は [境界](boundary.md)の直下に**字下げ一段**で書く。字下げは一段だけで、入れ子は無い。境界の下に置けるのは `door` / `window` / `seg` / [`line`](line.md) の四つだけである。

扉は**通行**を担う。`wall` の境界は扉が一枚も無ければ通れない — [窓](window.md)を何枚並べても通れるようにはならない。`koyu doors` が数えるのはこの扉であり、避難や動線の問いはすべてここを通る。

## 幅と高さ

| 属性 | 要否 | 意味 |
|---|---|---|
| `w` | **必須** | 線分に沿った幅mm。参照した[アセット](asset.md)が与えてもよい |
| `h` | 任意 | 高さmm |

`w` が無ければ形が作れないので、parse がその場で止める。

```text
✖ door requires a width w:(mm) (the asset may supply it)
```

`h` は書かなくてよい。**扉は床から立ち上がり、`h` があればそこまで、無ければまぐさ高 2000mm まで達する。**

| 書いたもの | 開口の z 範囲 (FL からの高さ) |
|---|---|
| `door w:900 h:2100` | 0 … 2100 |
| `door w:900` | 0 … 2000 |

まぐさ高 2000mm は導出の定数であって、属性では動かせない。

壁は「開口で割られた区間の列」として現れる。扉の位置には床から上端までの穴が空き、その上に垂れ壁が残る。**壁の黒帯を紙の色で塗り潰して穴に見せる操作は、この規則があるかぎり存在しない。**

## at — 線分上のどこに

`at` には二つの綴りがある。

| 書き方 | 意味 |
|---|---|
| `at:0.4` | 線分の長さに対する**比率** 0..1。既定は 0.5。中心が線分に収まるよう**クランプされる** (診断は出ない) |
| `at:X2+450` | 通り参照による**絶対位置**。クランプしない — はみ出せばエラー |

中心の座標は線分の始点から終点へのパラメータで取る。**線分は導出されたものも[描かれた線](line.md)のものも常に座標の昇順に向く**ので、同じ `at:` は境界の `a`/`b` の書き順にも線の端点の書き順にも依らず同じ場所を指す。

絶対位置は軸を選ぶ。水平の線分は X 系、垂直の線分は Y 系の通り参照でなければならない。斜めの線分の上には絶対位置を置けない — 比率だけである。

```text
✖ The door position Y1+1000 is on the wrong axis: a horizontal segment takes an X grid line
✖ At X1+100 the door (width 900) runs off the boundary segment (segment 0-3600mm, center allowed 450-3150mm)
```

同じ線分に複数の開口を置くとき、中心間の距離は `(w₁+w₂)/2` 以上でなければならない。

```text
✖ Openings overlap (door and door — center to center 720mm < the required 1800mm)
```

## edge — どの辺か

一つの境界が複数の線分に割れているとき、辺を選ばなければ扉は置けない。外部への境界はたいてい室の四方に分かれるので、`edge:` はほぼ必須になる。

```text
✖ There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)
```

方位は N=+Y、S=−Y、E=+X、W=−X で、**a 側 — 先に書いた空間 — の形から見た辺**である。境界の側に `edge:` があればそれが先に効き、開口の `edge:` はさらにその中を絞る。

線分が一つも無ければ置けない (OPN04)。開口の幅が線分の長さを超えても置けない (OPN06 — 等しいときは置ける)。

## hinge — 吊元

| 線分 | 取れる値 | 既定 |
|---|---|---|
| 水平 | `W` / `E` | 始端側 (西) |
| 垂直 | `N` / `S` | 始端側 (南) |
| 斜め | — | 始端側に固定 |

軸違いはエラーになる。

```text
✖ hinge:N: a horizontal segment takes W/E
```

`hinge` の N/E/S/W は軸の言葉なので、斜めの線分には当たらない。そこでは吊元が常に始端側に置かれる。

## swing — 開く側

`swing:a` / `swing:b` で、境界の a 側と b 側のどちらへ開くかを書く。**書かなければ「a が領域を持てば a、でなければ b」である。**これが[境界の書き順](boundary.md)を読む二つのうちの一つである。

開く**向き**は書かない。開く先の**導出された形**のうち、開口に最も近い凸片の中心へ向かう成分から決まる。軌跡は吊元を中心とする半径 = 幅の 1/4 円である。

## style — 建具の型

| 値 | 平面の表現 |
|---|---|
| `hinged` | 開き戸 (既定) — 吊元と 1/4 円の軌跡 |
| `sliding` | 引き戸 — 軌跡を持たず、吊元の側へ引き込まれる |
| `auto` | 自動扉 — 同じく軌跡を持たない |

この三語の外は ATT02 (error) である。

## 書いてみる

```muro
koyu 1.0
name 扉の書き方
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150

asset SD1 door w:800 h:2000 style:sliding name:片引き戸

space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部

boundary /L1/a /L1/b t:120 spec:LGS
  door SD1 hinge:N swing:b

boundary /L1/a /out t:150 spec:EW
  door w:900 h:2100 edge:S at:X1+1200 name:勝手口 hinge:W
boundary /L1/b /out t:150 spec:EW
  door w:1200 h:2100 edge:S at:0.4 style:auto name:玄関
```

三枚の扉が導出される中心座標は、上から順に (3600, 2250)・(1200, 0)・(5040, 0) である。二枚目は通り参照どおりの絶対位置、三枚目は長さ 3600 の線分の始点 x=3600 から 0.4 の位置である。

## 属性の層

| 属性 | 層 |
|---|---|
| `w` `h` `at` `edge` `hinge` `swing` | 構造 — parse が型つきの欄へ持ち上げる |
| `style` `name` | 解釈 — 値域が検査される |
| `sill` `spec` `fire` | 運搬 — 運ぶだけ |

台帳に無いキーはドットを含む名前空間 (`acme.hardware:レバー`) を持たなければ書けない (ATT03)。

`name` は**その境界の中で一意な名**であり、開口の同一性の鍵である。同じ境界に同じ名を二枚書くと UID04 になる。ただし[アセット](asset.md)から継いだ名は型の名なので、同一性の主張として数えない — 同じ建具を一枚の壁に二枚並べても衝突しない。

## 診断

| コード | severity | 何を言うか |
|---|---|---|
| OPN01 | error | `hinge` の軸違い |
| OPN02 | error | 同じ線分上の開口同士の重なり |
| OPN03 | warning | `open` 境界の上の扉 — 通行に影響しない (常に通れる) |
| OPN04 | error | 開口を置ける境界線分が無い |
| OPN05 | error | 境界線分が複数で、どれか決まらない |
| OPN06 | error | 開口の幅が線分の長さを超える |
| OPN07 | error | 絶対位置の軸違い、または斜めの線分への絶対位置 |
| OPN08 | error | 絶対位置のはみ出し |
| VRT05 | warning | 垂直の境界の上の開口 — 解釈されない |
| UID04 | error | 同じ境界の中で `name` が重複 |

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [boundary](boundary.md) — 扉が載る関係
- [window](window.md) — 通行しない開口
- [asset](asset.md) — 建具の既定値を一箇所に置く
- [seg](seg.md) — 穴を空けない、境界上の分節
- [koyu check](../cli/check.md)
