---
title: OPN — 開口の診断
mode: reference
---

# OPN — 開口の診断

開口 (`door` `window` ほか) は境界の**線分の上**に載る。線分は空間の割付から導出されるので、線分が無ければ置けず、線分が複数あれば置き先が決まらない。OPN の八つはその配置と、置いた後の整合を咎める。

位置の書き方は二通りある。

- **比率** — `at:0.5` は線分長に対する割合。線分に収まるよう**自動でクランプされる**。
- **通り参照** — `at:X2+450` は絶対位置。「そこに置け」という明示なので**クランプせず**、収まらなければエラーになる。

省略すれば `at:0.5` (中央) である。`at` は開口の**中心**を指す。

| コード | severity | 一文 |
|---|---|---|
| [OPN01](#opn01) | error | `hinge` の軸違い |
| [OPN02](#opn02) | error | 開口同士が重なっています |
| [OPN03](#opn03) | warning | open 境界の開口は通行に影響しません |
| [OPN04](#opn04) | error | 開口を置ける境界線分がありません |
| [OPN05](#opn05) | error | 境界線分が複数あって曖昧です |
| [OPN06](#opn06) | error | 開口の幅が境界線分の長さを超えています |
| [OPN07](#opn07) | error | 開口の明示位置の軸違い |
| [OPN08](#opn08) | error | 開口の明示位置が線分からはみ出します |

`seg` の配置は同じ規則に従い、[SEG04〜SEG08](seg.md) が OPN04〜OPN08 と一対一に対応する。垂直境界 (`stair` `shaft` `void`) に載せた開口は解釈されず、[VRT05](vrt.md#vrt05) が言う。コードの手に入れ方は[診断を読む](reading.md)にある。

**置けなかった開口は、その先の検査を受けない。**OPN04〜OPN08 のどれかで落ちた開口は、`hinge` の軸 (OPN01) も見られず、重なり (OPN02) の母集団からも外れる。位置が無いものの向きと距離は問えないからである。

以下の誤り例はどれも `koyu check --strict` で終了コード1になり、**そのコードちょうど1件**を出す。

## OPN01 — hinge の軸違い {#opn01}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 hinge:E
```

`hinge:E: a vertical segment takes N/S`

**原因** — `hinge` は吊元がどちら**端**かを言う。線分の向きに沿った方角でなければ意味が無い。上の例の二室は東西に並ぶので、共有する辺は**南北に走る垂直線分**であり、その両端は N と S である。

**直し方** — 線分が垂直 (南北に走る) なら `hinge:N` か `hinge:S`、水平 (東西に走る) なら `hinge:W` か `hinge:E`。省略すれば線分の始端側になる。

## OPN02 — 開口同士が重なっています {#opn02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:2000 at:0.4
  door w:2000 at:0.6
```

`Openings overlap (door and door — center to center 800mm < the required 2000mm)`

**原因** — 同じ線分上の二つの開口が食い込んでいる。必要な中心間距離は `(w₁ + w₂) / 2` で、メッセージが実測値と必要値の両方を出す。

**直し方** — メッセージの数値を見て `at` を離すか、幅を詰める。比率 `at` は線分長に対する割合なので、線分が短いほど同じ比率差でも実距離は小さくなる。確実に置きたいときは通り参照 (`at:X2+900`) で絶対位置を書く。

**注** — 検査されるのは**同じ線分に載った開口同士**である。別の辺 (`edge:` で分けた先) に置いた開口は、たとえ座標が近くても比べられない。

## OPN03 — open境界の開口は通行に影響しません {#opn03}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  door w:800
```

`A door on an open boundary has no effect on passage (it is always passable)`

**原因** — `open` は「そこに物が無い」という宣言である。もともと常に通れるので、扉を足しても通行可能性は変わらない。`koyu doors` の扉数にも算入されない。

**直し方** — 扉を数えたい (=建具が実在する) なら、境界を `wall` (既定 — `type:` を書かない) にして扉を載せる。開口部として開いているだけなら `door` の行を消す。

**注** — 警告が出た後も、その開口は配置と重なりの検査を受ける。`open` 境界に置いた扉の幅が線分より長ければ、OPN03 と [OPN06](#opn06) が並んで出る。

## OPN04 — 開口を置ける境界線分がありません {#opn04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 edge:N
```

`No boundary segment can hold the door (/L1/a | /L1/b)`

**原因** — 開口の `edge:` で絞った先に線分が無い。上の例の二室は東西に並ぶので共有辺は E (a側から見て) にあり、N には何も無い。境界そのものに線分が無い場合 (**[BND04](bnd.md#bnd04) / [BND06](bnd.md#bnd06) と同時に出る**) も同じコードになる。

**直し方** — `edge:` の方角を直す。方角は**先に書いた空間の矩形から見た向き**で、**N=+Y・S=−Y・E=+X・W=−X**。X は東が正、Y は北が正である。線分が一本しかない境界では `edge:` は不要である。

## OPN05 — 境界線分が複数あって曖昧です {#opn05}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  door w:800
boundary /L1/b /out t:150
```

`There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)`

**原因** — 外部 (`/out` など、領域を持たない空間) との境界は、部屋の外周のうち他室に接していない**残り全部**であり、ふつう複数の辺に分かれる。「その境界のどこに扉を置くのか」が決まらない。**外壁に開口を置くときは必ず `edge:` が要る**、と覚えてよい。

**直し方** — `edge:` で辺を選ぶ。方角は**先に書いた空間 (この例なら `/L1/a`) の矩形から見て、N=+Y・S=−Y・E=+X・W=−X**。玄関を南に置くなら `door w:900 edge:S`。

**注** — 内部の二室でも、L字の空間などで共有辺が二本に分かれていれば同じことが起きる。曖昧なら**推測せずに拒む**のがこの検査の構えである。

## OPN06 — 開口の幅が境界線分の長さを超えています {#opn06}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:5000
```

`The door width 5000 exceeds the boundary segment length 4000`

**原因** — 幅が壁より長い。メッセージが線分の実長を出すので、割付との突き合わせはそこでできる。アセット参照 (`door SD1`) を使っている場合、幅はアセット側から来ていることがある。

**直し方** — `w` を縮めるか、割付を広げる。アセットの幅を個別に上書きするなら、インスタンス側に `w:` を書く — インスタンスがアセットに勝つ。

## OPN07 — 開口の明示位置の軸違い {#opn07}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  door w:800 at:Y1+2000
```

`The door position Y1+2000 is on the wrong axis: a horizontal segment takes an X grid line`

**原因** — 通り参照で位置を書くとき、線分に沿った軸の通りでなければ位置にならない。上の例の二室は南北に並ぶので共有辺は**東西に走る水平線分**であり、その上の位置は X 系の通りで測る。

**直し方** — 水平線分 (東西に走る) には `at:X…`、垂直線分 (南北に走る) には `at:Y…`。どちらか分からないときは、二室が東西に並ぶなら垂直線分 (Y系)、南北に並ぶなら水平線分 (X系) と考える。

**メッセージは期待する軸を言う。**書かれた軸ではない — この枝は軸が食い違ったときにだけ通るので、書かれた軸は必ず期待の逆である。

**注 — 斜めの線分には通り参照が使えない。**`line` で引いた斜めの境界の上では、通り参照は位置を一意に定めない。同じ OPN07 が `The door position X2+450 cannot be used on a diagonal segment (write it as a ratio, at:0..1)` という本文で出る。比率で書く。

## OPN08 — 開口の明示位置が線分からはみ出します {#opn08}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
```

`At Y1+200 the door (width 900) runs off the boundary segment (segment 0-4000mm, center allowed 450-3550mm)`

**原因** — `at` が通り参照のときは**クランプしない**。比率 (`at:0.5` など) は線分に収まるよう自動で押し戻されるが、通り参照は「そこに置け」という明示なので、収まらなければ黙って動かさずエラーにする。`at` は開口の**中心**を指すので、端から `w/2` 以上内側でなければならない。

**直し方** — メッセージの「中心の許容」の範囲に `at` を収める。上の例なら `at:Y1+450` 以上。端に寄せたいだけなら比率で `at:0` と書けば、クランプされて端いっぱいに収まる。
