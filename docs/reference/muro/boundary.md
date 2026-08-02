---
title: boundary — 二つの空間の境界
mode: reference
---

# boundary — 二つの空間の境界

```text
boundary /pathA /pathB [key:value...]
  door … / window … / seg … / line …      # 字下げ一段
```

`boundary` は壁を置く行ではない。**二つの空間のあいだに境界という関係がある、と宣言する行**である。壁芯の線分はどこにも書かれない — 両空間の割付から導出される。

だから境界は、どちらの空間にも属さない。`/L1/a` の持ち物でも `/L1/b` の持ち物でもなく、その二つを結ぶ第一級の関係である。

## 線分は書かれず、導かれる

線分の求め方は、両側が領域を持つかどうかで分かれる。

| 場合 | 線分 |
|---|---|
| 両側が領域を持つ | **共有辺** — 同一直線上で重なり合う区間。重なりが長さを持たなければ境界にならない (角の一点は接触ではない) |
| 片側だけが領域を持つ | **外周の残り** — 領域を持つ側の外周から、同じレベルの他のすべての空間と向かい合う区間を引いたもの |
| どちらも領域を持たない | 線分は無い |
| 垂直の kind (`stair` / `shaft` / `void`) | 線分は無い — 垂直の境界に壁は立たない |

同じ直線上に並んだ線分は一本にまとめられる (向き・固定座標・a 側から見た方位の三つが揃うときだけ)。だから複数の矩形をまたぐ壁の上にも、開口は一つの線分として置ける。

**一つの関係が複数の線分に割れる。**外部のような領域を持たない空間との境界はたいてい室の四方に分かれるので、開口を置くには `edge:` で辺を選ぶ。

異なるレベルの空間へ `wall` の境界を書くとエラーになる (BND03)。階を跨ぐ関係は垂直の kind が引き受ける。

## 五つの kind

`type:` はトポロジーだけを言う。**物の名は入らない** — 手すりもカーテンウォールも鉄筋コンクリートも `spec:` の値である。

| type | 向き | 通行 | 意味 |
|---|---|---|---|
| `wall` | 水平 (既定) | 扉があるときだけ | 物がある |
| `open` | 水平 | 常に可 | 何もない — 一続きの空間の名目上の切れ目 |
| `stair` | 垂直 | 可 | 階段・斜路・エスカレーターに共通するトポロジー |
| `shaft` | 垂直 | 不可 | 連続するが通れない (昇降路・パイプスペース) |
| `void` | 垂直 | 不可 | 床の不在 (吹抜け) |

**縦の通行可能性は `stair` の一語が引き受ける。**階段も斜路もエスカレーターも「上下を通れる」という同じ関係なので、型は増やさない。装置の違いは空間の側の宣言 (`stair:` `ramp:` `escalator:` `lift:`) が形の生成規則として持つ。

床は書かない。連続するレベルの空間は平面が重なれば垂直に隣接し、その既定の解釈は「床がある」である。例外だけを `stair` / `shaft` / `void` で宣言する。

```muro
koyu 1.1
name 五つの kind
unit mm

grid X 0 4000 8000 11000 13500
grid Y 0 6000
level L1 0 h:2700 slab:200
level L2 3000 h:2700 slab:250

space /L1/hall   hall   X1..X2 Y1..Y2 name:ホール
space /L1/lounge lounge X2..X3 Y1..Y2 name:ラウンジ
space /L1/st     stair  X3..X4 Y1..Y2 name:階段室 stair:E
space /L1/ev     shaft  X4..X5 Y1..Y2 name:EV1F lift:1
space /L2/void          X1..X2 Y1..Y2 name:吹抜け void:1
space /L2/office office X2..X3 Y1..Y2 name:事務室
space /L2/st     stair  X3..X4 Y1..Y2 name:階段室2F
space /L2/ev     shaft  X4..X5 Y1..Y2 name:EV2F lift:1
space /out name:外部 outside:1

boundary /L1/hall /L1/lounge type:open
boundary /L1/lounge /L1/st t:150 spec:RC
  door w:900 h:2000 name:階段扉
boundary /L1/hall /out t:180 spec:EW
  door w:1200 h:2100 edge:S name:玄関
boundary /L2/void /L2/office t:150 spec:手すり air:1 h:1100

boundary /L1/hall /L2/void type:void
boundary /L1/st /L2/st type:stair
boundary /L1/ev /L2/ev type:shaft
```

`koyu graph` がこの関係の網を読み上げる。

```text
/L1/hall (ホール)
  〰 open → /L1/lounge
  — 1 door → /out  (spec:EW)
  ↕ void → /L2/void
/L1/lounge (ラウンジ)
  〰 open → /L1/hall
  — 1 door → /L1/st  (spec:RC)
/L1/st (階段室)
  — 1 door → /L1/lounge  (spec:RC)
  ↕ stair → /L2/st
```

## 接する空間の既定は壁

境界を一行も書かなくてよい。**同一レベルで平面が接する領域つき空間の組には、その組に宣言が一つも無ければ `wall` の境界が導出される。**垂直の「既定は床」と対称の、水平の「既定は壁」である。

```muro
koyu 1.1
unit mm
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:A
space /L1/b room X2..X3 Y1..Y2 name:B
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

境界を書いていないのに「1 boundary」と出るのは、この導出のためである。**そして導出された壁は扉を持たないので通れない。**

```text
Cannot reach /L1/b from /L1/a
```

宣言は例外のためにある — `open` にするため、`air:1` にするため、属性を付けるため、そして開口を吊るためである。宣言がその組に一つでもあれば (辺を限定したものでも) 導出は起きない。導出された境界は正準JSONには出ない。緑であることを「通れる」の根拠にしてはならない。

## 属性

| 属性 | 層 | 意味 |
|---|---|---|
| `type` | 構造 | 上の五語。既定 `wall` |
| `t` | 構造 | 壁厚mm。芯線に対して両側へ半分ずつ振り分ける。書かなければ描画は 100mm、`air:1` の境界では 60mm を使う |
| `air` | 構造 | `1` = 物はあるが外気も光も遮らない (手すり・柵・フェンス)。**通行の話ではない** — 手すり壁は通れない。厚みは 80mm で頭打ちになる |
| `edge` | 構造 | 線分を a 側から見た辺 N/E/S/W に限定する |
| `h` | 解釈 | `air:1` の境界の天端高mm。既定 1100。正の数値でなければ ATT01 |
| `name` | 解釈 | 表示名 |
| `spec` `fire` `sound` | 運搬 | 運ぶだけ。`spec` は物の名で、ツールは解釈しない |

**構造の属性は parse がそのまま型つきの欄へ持ち上げる**ので、合成後のモデルの自由属性には残らない。解釈の属性は値域が検査される。運搬の属性は一切読まれない。

台帳に無いキーは書けない — 書けば ATT03 (error) である。運搬したいだけの値は**ドットを含む名前空間**を付ける。

```text
✖ seg (/L1/a | /out) carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:タイル)
```

`acme.finish:タイル` と書けば通る。core は名前空間つきのキーを絶対に見ない。この境界があるから「見ていない」と「見て問題がない」が区別できる。

`air:1` は半屋外の導出に効く。外部に対して `open` か `air:1` の境界を持つ領域つき空間は**半屋外**と導出され、床面積の別掲・採光の係数・[柱](column.md)の立地・天井と屋根の不生成に一斉に効く。

## a 側の向きが効くのは二つだけ

`boundary /L1/a /out` と `boundary /out /L1/a` は同じ関係の二つの綴りである。**面積も形も線分の位置も、書き順には依らない。**

```muro
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:隅切りの室
space /out name:外部 outside:1

boundary /out /L1/a t:150 spec:RC
  line X1,Y2-3000 X1+3000,Y2
```

この境界を `boundary /L1/a /out` と書き直しても、面積は 31.50 m2 のまま動かない。正準JSONで変わるのは `a` の値だけである。

書き順が意味を持つのは**二つだけ**である。

- **`edge`** — 「a 側の形から見た辺」なので、a と b を入れ替えれば方位が裏返る
- **[扉の開く先](door.md)** — `swing:` を書かなければ「a が領域を持てば a、でなければ b」へ開く

`edge` の非対称は、書き間違えるとその場で言葉になる。

```muro-bad
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 4000 8000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:南の室
space /L1/b room X1..X2 Y2..Y3 name:北の室
boundary /L1/b /L1/a t:120 edge:N
```

```text
✖ No shared edge on edge:N: /L1/b | /L1/a (they actually touch on S)
```

`/L1/a` を先に書けば `edge:N` が正しく、`/L1/b` を先に書くなら `edge:S` である。方位は N=+Y、S=−Y、E=+X、W=−X。

垂直の境界を階から階へ一息に張るなら、一行ずつ書く代わりに [stack](stack.md) がある。

## 診断

| コード | severity | 何を言うか |
|---|---|---|
| REF01 | error | 未定義の空間パスを参照している |
| BND01 | error | 同一空間同士の境界 |
| BND02 | error | 同じ空間対の境界の重複 (辺の限定まで同一)。`wall` と `open` の食い違いもここで捕まる |
| BND03 | error | 異なるレベルの空間への `wall` 境界 |
| BND04 | error | 接していない空間の境界 — 線分が一本も導けない |
| BND05 | warning | 同じ空間対に辺の限定つきと無しが混在する (線分が重なる) |
| BND06 | warning | 線分の長さがゼロ — 外周に残る辺が無い |
| VRT01 | error | 垂直の境界が、領域とレベルを持つ空間同士に書かれていない |
| VRT02 | error | 隣り合わないレベルのあいだの垂直の境界 |
| VRT03 | error | 平面が重ならない垂直の境界 |
| VRT04 | warning | `void` 境界の上側が `type:void` でない |
| VRT05 | warning | 垂直の境界の上の開口 (解釈されない) |
| VRT06 | warning | 垂直の境界の上の `seg` (解釈されない) |
| ATT01 / ATT02 / ATT03 | error | 属性の値が数値でない / 台帳の語彙にない / キーが台帳に無い |

`check` の人向けの出力にコードは出ない。`--json` を付けると出る。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [space](space.md) — 境界が結ぶもの
- [door](door.md) / [window](window.md) — 境界の上に載る開口
- [seg](seg.md) — 境界の上の数えない分節
- [line](line.md) — 隣接からの導出ではなく、描かれた線で境界を実現する
- [koyu check](../cli/check.md) — 構造の整合の門番
