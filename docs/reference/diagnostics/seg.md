---
title: SEG — 数えない分節の診断
mode: reference
---

# SEG — 数えない分節の診断

**数えない分節**は、面積にも室数にも動線グラフにも影響しないまま、内側の違いを書き留めるための道具である。二種類ある。

- **`area`** — 空間の内側の一区画。床材が途中から変わる範囲など。親の `space` の下に字下げして書く。
- **`seg`** — 境界の上の一区間。壁材が途中から変わる範囲など。親の `boundary` の下に字下げして書く。

SEG の族はこの二つをまとめて持つ。SEG01・SEG02 が `area`、SEG03〜SEG08 が `seg` である。

| コード | severity | 対象 | 一文 |
|---|---|---|---|
| [SEG01](#seg01) | error | `area` | 領域を持たない空間に `area` は書けません |
| [SEG02](#seg02) | warning | `area` | `area` が領域からはみ出しています |
| [SEG03](#seg03) | warning | `seg` | open 境界の `seg` は解釈されません |
| [SEG04](#seg04) | error | `seg` | `seg` を置ける境界線分がありません |
| [SEG05](#seg05) | error | `seg` | `seg` の境界線分が複数あって曖昧です |
| [SEG06](#seg06) | error | `seg` | `seg` の幅が境界線分の長さを超えています |
| [SEG07](#seg07) | error | `seg` | `seg` の明示位置の軸違い |
| [SEG08](#seg08) | error | `seg` | `seg` の明示位置が線分からはみ出します |

`seg` の配置は開口とまったく同じ規則に従い、SEG04〜SEG08 は [OPN04〜OPN08](opn.md) と一対一に対応する。垂直境界に載せた `seg` は解釈されず、[VRT06](vrt.md#vrt06) が言う。コードの手に入れ方は[診断を読む](reading.md)にある。

以下の誤り例はどれも `koyu check --strict` で終了コード1になり、**そのコードちょうど1件**を出す。

## SEG01 — 領域を持たない空間に area は書けません {#seg01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
  area X1..X2 Y1..Y2 floor:タイル
```

`An area cannot be written on /out, which has no region`

**原因** — `area` は室の内側の分節であり、親の領域の一部を指す。親が領域を持たなければ指す先が無い。字下げの掛かる先を間違えて、意図した `space` の一つ下に落ちている場合が多い — 上の例の `area` は `/L1/a` ではなく `/out` に付いている。

**直し方** — `area` を、領域を持つ `space` の直下に移す。

## SEG02 — area が領域からはみ出しています {#seg02}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:タイル
```

`The area spills outside the region of /L1/a`

**原因** — `area` の矩形が親の領域に収まっていない。`area` は面積にも室数にもグラフにも影響しないため、エラーではなく警告である。

**直し方** — `area` の通り参照を親の範囲内に収める。

**注 — 収まるかどうかは導出された領域で見る。**割付の矩形ではなく、線 (`line`) で切った後の形が母集団である。切り落とした側に置いた床材は通らない。

**注 — `+` で複数矩形を持つ親では、`area` はいずれか一枚の矩形に収まっていなければならない。**二枚にまたがる分節は、二本の `area` に分ける。

## SEG03 — open境界の seg は解釈されません {#seg03}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:800 spec:X
```

`A seg on an open boundary (there is no wall) is not interpreted`

**原因** — `seg` は壁の一部の仕様を切り替えるものである。`open` には壁が無いので、切り替える対象が無い。

**直し方** — 壁があるなら `type:open` を外す (既定が `wall`)。無いなら `seg` の行を消す。

**注** — 開口の [OPN03](opn.md#opn03) と違い、この警告が出た `seg` は**そこで打ち切られる**。以降の配置の検査 (SEG04〜SEG08) を受けない。

## SEG04 — seg を置ける境界線分がありません {#seg04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:800 edge:N spec:X
```

`No boundary segment can hold the seg (/L1/a | /L1/b)`

**原因** — `seg` の `edge:` で絞った先に線分が無い。上の例の二室は東西に並ぶので共有辺は E (a側から見て) にあり、N には何も無い。境界そのものに線分が無い場合 ([BND04](bnd.md#bnd04) / [BND06](bnd.md#bnd06) と同時に出る) も同じコードになる。

**直し方** — `edge:` の方角を直す。方角は**先に書いた空間の矩形から見た向き**で、**N=+Y・S=−Y・E=+X・W=−X**。線分が一本しかない境界では `edge:` は不要である。

## SEG05 — seg の境界線分が複数あって曖昧です {#seg05}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  seg w:800 spec:X
boundary /L1/b /out t:150
```

`There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)`

**原因** — 外部 (領域を持たない空間) との境界は、部屋の外周のうち他室に接していない**残り全部**であり、ふつう複数の辺に分かれる。どの辺の話かが決まらない。**外壁の `seg` には必ず `edge:` が要る。**

**直し方** — `edge:` で辺を選ぶ。方角は先に書いた空間 (この例なら `/L1/a`) の矩形から見て、**N=+Y・S=−Y・E=+X・W=−X**。

## SEG06 — seg の幅が境界線分の長さを超えています {#seg06}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:5000 spec:X
```

`The seg width 5000 exceeds the boundary segment length 4000`

**原因** — `seg` の幅が壁より長い。メッセージが線分の実長を出すので、割付との突き合わせはそこでできる。

**直し方** — `w` を縮める。**壁の全長にわたる仕様なら、`seg` ではなく境界そのものの属性にする。**`seg` は「途中から変わる」ことを書く道具であって、全体を言うためのものではない。

## SEG07 — seg の明示位置の軸違い {#seg07}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  seg w:800 at:Y1+2000 spec:X
```

`The seg position Y1+2000 is on the wrong axis: a horizontal segment takes an X grid line`

**原因** — 通り参照で位置を書くとき、線分に沿った軸の通りでなければ位置にならない。上の例の二室は南北に並ぶので共有辺は**東西に走る水平線分**であり、その上の位置は X 系の通りで測る。

**直し方** — 水平線分 (東西に走る) には `at:X…`、垂直線分 (南北に走る) には `at:Y…`。メッセージが言うのは**期待する軸**であって、書かれた軸ではない。

**注 — 斜めの線分には通り参照が使えない。**`line` で引いた斜めの境界の上では、同じ SEG07 が `The seg position X2+450 cannot be used on a diagonal segment (write it as a ratio, at:0..1)` という本文で出る。比率で書く。

## SEG08 — seg の明示位置が線分からはみ出します {#seg08}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:900 at:Y1+200 spec:X
```

`At Y1+200 the seg (width 900) runs off the boundary segment (segment 0-4000mm, center allowed 450-3550mm)`

**原因** — `at` が通り参照のときは**クランプしない**。比率 (`at:0.5` など) は線分に収まるよう自動で押し戻されるが、通り参照は「そこに置け」という明示なので、収まらなければ黙って動かさずエラーにする。`at` は `seg` の**中心**を指すので、端から `w/2` 以上内側でなければならない。

**直し方** — メッセージの「中心の許容」の範囲に `at` を収める。上の例なら `at:Y1+450` 以上。端に寄せたいだけなら比率で `at:0` と書けば、クランプされて端いっぱいに収まる。
