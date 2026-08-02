---
title: 敷地 — site.escape / site.area / site.frontage
mode: reference
---

# 敷地 — site.escape / site.area / site.frontage

| 規則 | level |
|---|---|
| [`site.escape`](#site-escape) | violation |
| [`site.area`](#site-area) | caution |
| [`site.frontage`](#site-frontage) | violation |

敷地は `site:1` を持つゾーンで、その形は同じパスの `polygon` が与える。**敷地形状そのものの健全性** — 重複頂点・自己交差・対応するゾーンの不在 — は [`koyu check`](../cli/check.md) が言う。与件が壊れていれば形が作れないので、あれは読解の一部である。

この章が持つのは、**建物と敷地の関係についての判断**である。

建蔽率と容積率は数なので [`koyu site`](../cli/site.md) が返す。上限と較べるにはどの用途地域かという書かれていない事実が要るので、判定は持たない。

## `site.escape` — 敷地形状からはみ出す {#site-escape}

`violation`

領域を持つ空間が敷地の多角形の外に出ている。

```muro-fail
koyu 1.0
grid X 0 10000 14000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

```text
✖ [site.escape] main.muro:line 8: /L1/a escapes the site shape (near 14000,0)
Validation — 1 violation / 0 cautions
```

多角形は X = 10000 で終わっているのに、`/L1/a` は X2..X3 = 10000..14000 を占めている。

**検査は四隅の内包だけではない。**多角形の頂点が空間の中へ入り込んでいないか、辺が交差していないかも見る。だから凹んだ敷地 — 旗竿地や隅切りのある敷地 — でも正しく捕まる。境界の上に乗っているのは内側扱いで、許容は 1mm である。

照合するのは割付ではなく**導出された領域**なので、敷地なりに切った外形はそのまま通る。

数えない空間が二つある。**敷地ゾーンの配下にある空間 (`/site/…`)** と、**`type:exterior` の空間**である。外構のタイルと道路は敷地の外に出て当然だからである。

メッセージは最初に見つけたはみ出し点の座標を出す。一つの空間につき一件だけ出る。

**直し方** — 割付を敷地内に収めるか、`polygon` の測量値を直す。上の例で多角形のほうが正しければ空間を縮め、空間のほうが正しければ頂点を `0,0 14000,0 14000,10000 0,10000` に直す。

## `site.area` — 敷地面積の宣言と導出が食い違う {#site-area}

`caution`

ゾーンの `area:` (測量値の転記) と、`polygon` の頂点から計算した面積が **0.05㎡ 以上**ずれている。

```muro-caution
koyu 1.0
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
⚠ [site.area] main.muro:line 5: Declared and derived site areas disagree: declared 120 m2 / derived 100.00 m2
Validation — 0 violations / 1 caution
```

10m 角の多角形は 100㎡ だが、`area:` には 120.00 と書いてある。**同じ事実が二箇所に書かれていて、食い違っている。**頂点の打ち間違いか、`area:` の転記ミスか、測量図の更新が片方にしか反映されていないかである。

`area:` を書かない敷地には、この検査は掛からない。二つの数が無ければ食い違いようがない。

**直し方** — どちらが正しいかを決めて片方を直す。`area:` は測量成果の転記なので、ふつう疑うべきは `polygon` の頂点のほうである。両方の数字は [`koyu site`](../cli/site.md) が並べて出す。

```sh
koyu site main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 120.00 m2 / derived 100.00 m2
  Building footprint (horizontal projection, rough): 100.00 m2 → building coverage ratio 83.3%
  Total floor area: 100.00 m2 → floor area ratio 83.3%
```

## `site.frontage` — 接道長が足りない {#site-frontage}

`violation`

`road:` (幅員 mm) を持つ外部空間と、敷地ゾーン配下の空間との間の境界線分の合計が **2000mm** に足りない。

```muro-fail
koyu 1.0
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n type:open
```

```text
✖ [site.frontage] main.muro:line 8: Road frontage is too short: /out/road-n — 1500mm (needs at least 2000mm)
Validation — 1 violation / 0 cautions
```

道路は X1..X2 = 0..1500 の幅しか敷地に接していない。接道長を数えているのは境界線分の長さであって、道路の幅員 (`road:4000`) ではない。

**接道に数えるのは、敷地と道路の間の境界だけである。**建物の外壁が道路に面していても、それは接道ではない — 数えられるのは `site:1` ゾーンの配下にある空間 (外構のタイル) と道路の間に書かれた境界だけである。

**敷地が宣言されていなければ、この規則は走らない。**`site:1` のゾーンが無い模型では接道長として 0 が導かれるが、それは「接道が無い」ではなく「導けていない」である。地下の断面だけを書いた例のように、道路は書くが敷地は書かない模型は現にある。導けていない数に線を引けば、書いていないことが違反になってしまう。

2m という下限は建築の側の規則である。接道長そのものは数として導かれ、[`koyu site`](../cli/site.md) が道路ごとに並べて出す。

**直し方** — 道路に面する境界を書く。上の例なら、敷地が道路に接する幅 (X1..X2) を実際の幅に直す。

```muro
koyu 1.0
grid X 0 4000 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n type:open
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area (derived): 100.00 m2
  Road: /out/road-n (北側道路) width 4000mm / frontage 4000mm
  Building footprint (horizontal projection, rough): 0.00 m2 → building coverage ratio 0.0%
  Total floor area: 0.00 m2 → floor area ratio 0.0%
```

## 関連

- [`koyu site`](../cli/site.md) — 敷地面積・接道長・建築面積・建蔽率・容積率という数そのもの
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
