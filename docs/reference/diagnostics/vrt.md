---
title: VRT — 垂直境界の診断
mode: reference
---

# VRT — 垂直境界の診断

上下階の隣接は**宣言しない**。平面の重なりから導かれ、既定は床である。書くのは例外だけで、三つある。

| `type:` | 意味 | 通行 |
|---|---|---|
| `stair` | 階段 — 上下階が段で繋がる | 扉なしで通れる |
| `shaft` | 昇降機・設備シャフト — 空間として連続する | 人は通れない |
| `void` | 吹抜け — そこに床が無い | 人は通れない |

この三つを持つ境界を**垂直境界**と呼ぶ。垂直境界は平面の線分を持たないので、**水平境界の検査 (線分・開口・`seg`) を一切受けない。**代わりに VRT の六つが、上下の関係として成り立っているかを見る。

| コード | severity | 一文 |
|---|---|---|
| [VRT01](#vrt01) | error | 垂直境界は領域とレベルを持つ空間同士に書きます |
| [VRT02](#vrt02) | error | 垂直境界は隣り合うレベルの間に書きます |
| [VRT03](#vrt03) | error | 垂直境界の空間が平面上で重なっていません |
| [VRT04](#vrt04) | warning | void 境界の上側が `type:void` ではありません |
| [VRT05](#vrt05) | warning | 垂直境界の開口は解釈されません |
| [VRT06](#vrt06) | warning | 垂直境界の `seg` は解釈されません |

階を跨いで `type:` を書き忘れた境界は垂直境界にならず、[BND03](bnd.md#bnd03) が言う。コードの手に入れ方は[診断を読む](reading.md)にある。

以下の誤り例はどれも `koyu check --strict` で終了コード1になり、**そのコードちょうど1件**を出す。

## VRT01 — 垂直境界は領域とレベルを持つ空間同士に書きます {#vrt01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out type:stair
```

`A stair boundary is written between spaces that have both a region and a level`

**原因** — 垂直の関係は「平面のここが上下で繋がる」という話なので、両側が領域とレベルを持っていなければ位置が定まらない。相手が `exterior` (領域なし) だったり、レベルが特定できていない空間だったりする。

**直し方** — 両側を、領域とレベルを持つ実在の空間にする。屋外階段を書きたいのなら、各階に階段室の空間 (半屋外なら `exterior` に `open` / `air:1` で面する空間) を立て、その間に `type:stair` を張る。

**注 — この診断が出た境界は、以降の検査を受けない。**前提が崩れているので、レベルの隣接 (VRT02) も平面の重なり (VRT03) も問えない。

## VRT02 — 垂直境界は隣り合うレベルの間に書きます {#vrt02}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L3/a room X1..X2 Y1..Y2
boundary /L1/a /L3/a type:stair
```

`A stair boundary is written between adjacent levels: /L1/a | /L3/a`

**原因** — 一本の垂直境界が跨げるのは、z 順で**隣り合う**レベルの一段だけである。上の例は L1 と L3 で、間の L2 を飛ばしている。隣接は名前の順ではなく **z の順**で決まる。

**直し方** — 段ごとに一本ずつ書く (`/L1/a | /L2/a` と `/L2/a | /L3/a`)。全階を貫くシャフトや階段室は `stack` の一行で一括宣言できる。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/ev shaft X1..X2 Y1..Y2
space /L2/ev shaft X1..X2 Y1..Y2
space /L3/ev shaft X1..X2 Y1..Y2
stack ev L1..L3 type:shaft
```

`stack` は各段の垂直境界に展開されるので、階数が増えても行は一本のままである。

## VRT03 — 垂直境界の空間が平面上で重なっていません {#vrt03}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
```

`The spaces of a stair boundary do not overlap in plan: /L1/a | /L2/b`

**原因** — 上下に繋ぐには、平面上で重なっていなければならない。階段室・シャフトの上下階の割付が食い違っている。

**直し方** — 両階の矩形を揃える。階段の位置を階ごとにずらす設計なら、重なる範囲に踊り場の空間を挟む。

## VRT04 — void境界の上側が type:void ではありません {#vrt04}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
```

`The space above a void boundary is expected to be type:void: /L2/a`

**原因** — `type:void` の境界は「ここに床が無い」と言っている。その上に載っている空間が普通の室のままだと、床が無いのに床面積として数えられてしまう。

**直し方** — 上側の空間の型を `void` にする。

```muro-part
space /L2/a void X1..X2 Y1..Y2 name:リビング上部
```

`void` の空間は床面積に算入されず、`koyu stats` に `void (not counted as floor area)` と出る。

**注 — 上下の判定は z の順で行う。**`boundary` にどちらを先に書いても、上にあるほうが検査される。

## VRT05 — 垂直境界の開口は解釈されません {#vrt05}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  door w:800
```

`A door on a vertical boundary is not interpreted`

**原因** — 開口は壁芯線分の上に載るもので、垂直境界に線分は無い。書いても採光にも通行にも図面にも効かない。`stair` は扉なしで通行可であり、扉を足しても `koyu doors` の枚数は増えない。

**直し方** — 開口の行を消す。階段の入口に建具があるのなら、それは階段室と隣室の**水平**境界に載る扉である。

**注 — 咎められるのは開口の行そのものである。**診断の `line` は `boundary` の行ではなく `door` の行を指し、開口が三つあれば診断も三件出る。

## VRT06 — 垂直境界の seg は解釈されません {#vrt06}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  seg w:800 spec:X
```

`A seg on a vertical boundary is not interpreted`

**原因** — `seg` は境界線分の一区間を指すもので、垂直境界に線分は無い。壁材の切り替えも、`koyu plan` の描画も起きない。

**直し方** — `seg` の行を消す。シャフトの壁の仕様を書きたいのなら、それはシャフトの空間と隣室の**水平**境界に載る `seg` である。

**注** — [VRT05](#vrt05) と同じく、診断は `seg` の行そのものを指し、宣言が複数あれば複数出る。
