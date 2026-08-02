---
title: BND — 境界の診断
mode: reference
---

# BND — 境界の診断

境界は物ではなく、**二つの空間のあいだの関係**である。壁芯の線分はその関係と両空間の割付から導出されるので、関係が成り立たない書き方をすると線分が出ない。BND の六つはそこを咎める。

接する二つの空間の境界は**書かなくても壁として導出される**。`boundary` を書くのは、例外 (`type:open` や `air:1`) を宣言するときと、属性・開口・`seg` を載せるときだけである。

| コード | severity | 一文 |
|---|---|---|
| [BND01](#bnd01) | error | 同じ空間同士の境界は書けません |
| [BND02](#bnd02) | error | 境界が重複しています |
| [BND03](#bnd03) | error | 異なるレベルの空間に壁境界は書けません |
| [BND04](#bnd04) | error | 空間が接していないため境界を導けません |
| [BND05](#bnd05) | warning | 同じ空間対に edge 限定つきと無しの境界が併存しています |
| [BND06](#bnd06) | warning | 外周に残る辺が無く、境界線分がゼロです |

`BND07` は[欠番](retired.md)である。コードの手に入れ方は[診断を読む](reading.md)にある。

以下の誤り例はどれも `koyu check --strict` で終了コード1になり、**そのコードちょうど1件**を出す。手元に貼って確かめられる。

## BND01 — 同じ空間同士の境界は書けません {#bnd01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /out /out
```

`A boundary between a space and itself cannot be written: /out`

**原因** — 境界は二つの**異なる**空間を結ぶ関係である。同じパスを二度書いた。コピーして片方だけ直し忘れた、というのがほぼ全部である。

**直し方** — 二つめのパスを本来の相手に直す。

## BND02 — 境界が重複しています {#bnd02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

`Duplicate boundary: /L1/a | /L1/b (first seen at <absolute path>/bad.muro:line 6)`

**原因** — 同じ空間対 (`edge` 限定まで同一) に境界が二本ある。並び順に意味は無いから、どちらが勝つとも決められない。この例のように `wall` と `open` が食い違っていても、黙って後勝ちにはしない。診断の `related` に既出側の位置が入る。

**直し方** — 一本に統合する。辺ごとに違う仕様を与えたいなら、両方に `edge:` を付けて別の辺に限定する — `edge` が異なれば重複ではない。

**注** — 線 (`line`) を持つ境界は、線の綴りまで含めて同一性が決まる。同じ空間対に二本の線を引く (二箇所の隅切りなど) のは重複ではない。

## BND03 — 異なるレベルの空間に壁境界は書けません {#bnd03}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a t:120
```

`A wall boundary cannot be written to a space on a different level (vertical takes type:stair/shaft/void): /L1/a | /L2/a`

**原因** — 階を跨いで壁は立たない。上下階を繋ぐつもりで `boundary` を書いたが、`type:` を省いたため既定の `wall` になった。

**直し方** — 上下階の関係を書くなら `type:stair` (階段) / `type:shaft` (EV等) / `type:void` (吹抜け) のいずれかを付ける。**床は書かない** — 上下階の隣接は平面の重なりから自動的に導かれ、既定は床である。垂直境界そのものの診断は [VRT](vrt.md) にある。

## BND04 — 空間が接していないため境界を導けません {#bnd04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

`The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b`

**原因** — 壁芯線分は両空間の割付から導出される。導出できる形で接していなければ、境界という関係が成立しない。もっとも多いのは**角でしか触れていない**場合である。上の例の `/L1/a` は `X1..X2 Y1..Y2`、`/L1/b` は `X2..X3 Y2..Y3` で、点 (X2, Y2) を共有するだけで長さを持つ辺を共有していない。**長さのある辺を共有していなければ「接している」ことにならない。**座標が単にずれている (`Y2..Y3` と書くべきところを `Y3..Y4` と書いた) 場合も同じ症状になる。

**直し方** — 二室の矩形を紙に描いて、共有する辺があるか確かめる。無ければ割付を直す。本当に離れている二室を繋ぎたいのなら、間の空間 (廊下・ホール) を宣言して二本の境界に分ける。

**`edge:` を付けているときは本文が変わる。**辺の限定を外せば接している場合、メッセージは実際に接している辺を名指す。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b edge:N t:120
```

`No shared edge on edge:N: /L1/a | /L1/b (they actually touch on E)`

このときは割付ではなく**方角一語**が誤りである。`edge:` は先に書いた空間の矩形から見た向きで、**N=+Y・S=−Y・E=+X・W=−X**。X は東が正、Y は北が正である。

## BND05 — 同じ空間対に edge 限定つきと無しの境界が併存しています {#bnd05}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b edge:E t:150
```

`The same pair of spaces carries both an edge-restricted and an unrestricted boundary (the segments overlap): /L1/a | /L1/b`

**原因** — `edge` 無しの境界はその対の**全線分**を指す。`edge:E` の境界はそのうちの E 辺を指す。両方書くと、E 辺には二本の境界が重なって載る。壁厚 (`t`) も仕様も二重になる。[BND02](#bnd02) の重複エラーをすり抜けるが、意図した状態ではまずない。

**直し方** — 全辺に共通の指定なら `edge` 無しの一本に寄せる。辺ごとに変えたいなら、**すべて** `edge:` 付きに書き分ける。

**注** — 診断の `line` は集合を作った宣言のうち一本 (`edge` 無しの側が優先) を指し、残りが `related` に入る。「どこかで併存している」とだけ言われても直す場所が無いからである。

## BND06 — 外周に残る辺が無く、境界線分がゼロです {#bnd06}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:E t:150
boundary /L1/a /out edge:N t:150
boundary /L1/a /out edge:S t:150
boundary /L1/a /out edge:W t:150
boundary /L1/b /out t:150
```

`No edge remains on the perimeter for edge:E, so the boundary segment is of zero length: /L1/a | /out`

**原因** — 領域を持たない空間 (`exterior` など) との境界は、部屋の外周から**他の空間と接する区間を除いた残り**である。上の例の `/L1/a` の E 辺は `/L1/b` が丸ごと占めているので、`/out` に面する残りが無い。書いた境界は何も指していない。

**直し方** — 辺の取り違えである。`edge:` の方角は**先に書いた空間 (a側) の矩形から見た向き**で、**N=+Y (北)・S=−Y (南)・E=+X (東)・W=−X (西)**。この例なら `edge:W` が正しい。方角を消して `edge` 無しにすると、残る三辺すべてを指す境界になる。

**注** — この境界に開口や `seg` を載せていれば、置き先の線分が無いので [OPN04](opn.md#opn04) / [SEG04](seg.md#seg04) が同時に出る。
