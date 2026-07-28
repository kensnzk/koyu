---
title: SIT — 敷地形状
mode: reference
---

# SIT — 敷地形状

SIT は三つ生きている。SIT03 と SIT05 は**欠番**である。

| コード | severity | 何を言うか |
|---|---|---|
| SIT01 | error | 敷地形状に重複する頂点がある |
| SIT02 | error | 敷地形状が自己交差している |
| SIT03 | — | **欠番** |
| SIT04 | warning | `polygon` に対応するゾーンが無い |
| SIT05 | — | **欠番** |

**敷地は koyu で唯一、形が書かれるものである。**建物の形はすべて割付と関係から導出されるが、敷地形状は測量に由来する**所与**なので、`polygon` が頂点を直接持つ。

`polygon` は書式が一つしかない。

```text
polygon /ゾーンのパス x,y x,y x,y ...
```

座標は mm、頂点は三つ以上。**多角形は閉じているものとして扱われる**ので、始点を末尾にもう一度書かない。頂点が読めない綴りや三点未満は構文の誤りで、パーサがその場で止める。

生きている三つのコードが見るのは**与件そのものの健全性**だけである — 形として成立しているか、対応するゾーンがあるか。建物と敷地の**関係**についての判断は `koyu check` にはない (下の「欠番」を見る)。

## SIT01 — 敷地形状に重複する頂点があります

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
The site shape has a duplicate vertex (0,0)
```

**原因** — 連続する二頂点が同じ点にある。判定は隣り合う頂点間の距離が **1mm 以下**かどうかで、`0,0` と `0,0.5` も重複と数える。

測量データを貼り付けたときに最終点が始点と重複した、というのがほとんどである。長さゼロの辺があると面積も内外の判定も信用できない。

**直し方** — 重複した頂点を消す。閉じるための重複は要らない。

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

## SIT02 — 敷地形状が自己交差しています

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 0,10000 10000,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
The site shape is self-intersecting (near 5000,5000)
```

**原因** — 辺が互いに交差している。蝶ネクタイ形である。原因はほぼ常に、頂点の**並び順**が間違っていること。上の例は右下 → 左上 → 右上と飛んでいる。

**以降の検査は打ち切られる。**面積も内外の判定も定義できないので、この多角形についてはゾーンの対応も、敷地との関係の判定も、そこで止まる。メッセージは交点の座標を出すので、その付近の二辺を見る。

**直し方** — 頂点を外周に沿った順に並べ直す。時計回り・反時計回りのどちらでもよい — 向きは面積の符号だけの話で、koyu は絶対値を取る。

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

## SIT04 — polygon に対応するゾーンがありません

`warning`

```muro-warn
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
polygon /site 0,0 10000,0 10000,10000 0,10000
space /L1/a room X1..X2 Y1..Y2
```

```text
No zone corresponds to polygon /site
```

**原因** — `polygon` はゾーンのパスに**対応させて**書く。同じパスのゾーンが無いので、この形はどこからも使われない。面積も接道もはみ出しの判定も動かず、`koyu plan` の最下階に敷地境界線も出ない。ゾーンを書き忘れたか、パスの綴りが違う。

**直し方** — 同じパスのゾーンを宣言する。

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

**`site:1` を忘れない。**ゾーンがあっても `site:1` が無ければ、`koyu site` の対象にならず、敷地に関する判定も一つも動かない。ゾーンだけ書いて `site:1` を落とすと、SIT04 は消えるのに答えは出ないまま — という一番わかりにくい状態になる。

## 欠番 — SIT03 と SIT05

この二つの番号は**再利用されない**。同じ綴りが別の意味を持つと、過去の出力が読めなくなるからである。

かつて SIT03 は「建物が敷地形状からはみ出す」、SIT05 は「敷地面積の宣言と導出が食い違う」だった。どちらも**建物と敷地の関係についての判断**であって、書かれたものがデータとして成立しているかという話ではない。だから `check` を離れ、`koyu validate` の判定になった。

| かつて | 今 | 段階 |
|---|---|---|
| SIT03 | `site.escape` | violation |
| SIT05 | `site.area` | caution |

`check` は緑のまま、`validate` だけが声を上げる。

```muro
grid X 0 10000 12000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1 area:120
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

```sh
koyu check bad.muro --strict
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```sh
koyu validate bad.muro
```

```text
⚠ [site.area] <absolute path>/bad.muro:line 4: Declared and derived site areas disagree: declared 120 m2 / derived 100.00 m2
✖ [site.escape] <absolute path>/bad.muro:line 7: /L1/a escapes the site shape (near 12000,0)
Validation — 1 violation / 1 caution
```

面積の照合の許容は **±0.05㎡**。はみ出しの判定は割付ではなく**導出された領域**を見るので、敷地なりに切った外形はそのまま通る。判定は敷地ゾーンの配下 (`/site/…`) にある空間を対象から外す — 庭や通路は敷地の一部だからである。

`koyu validate` は接道長の下限 (`site.frontage` — 2000mm) も持つ。敷地が宣言されていない模型では接道を問わない。導けていない数に線を引くと、書いていないことが違反になってしまうからである。

## 関連

- [ZON — ゾーン](./zon.md) — `polygon` の相手になるゾーンそのものの検査
- [ATT — 属性](./att.md) — `site:yes` と書いて敷地の判定が丸ごと消える話 (ATT02)
- [koyu validate](../cli/validate.md) — `site.escape` / `site.area` / `site.frontage`
- [koyu check](../cli/check.md)
