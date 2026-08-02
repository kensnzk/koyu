---
title: seg — 境界上の数えない分節
mode: reference
---

# seg — 境界上の数えない分節

```text
boundary /pathA /pathB …
  seg w:3000 [at:…] [edge:…] [属性…]
```

`seg` は [境界](boundary.md)の直下に**字下げ一段**で書く区間である。壁の途中から仕様が変わるとき — 一枚の壁の一部だけがカーテンウォールになるとき、耐火の等級がそこだけ違うとき — に、その区間を名指すために使う。

**seg は数えない。**通行にも接続にも面積にも影響せず、`koyu doors` のグラフに辺を張らず、壁に穴も空けない。運ぶのは**位置と、その区間で上書きされる属性**だけである。

これが `seg` と[開口](door.md)を分ける唯一の線である。開口は壁を割る — 区間の列としての壁に、そこだけ穴が空く。`seg` は壁を割らない。

## 位置の書き方は開口と同じ

| 属性 | 要否 | 意味 |
|---|---|---|
| `w` | **必須** | 線分に沿った区間の長さmm |
| `at` | 任意 | 比率 0..1 (既定 0.5、クランプされる) または通り参照による絶対位置 (クランプしない) |
| `edge` | 任意 | 境界線分が複数あるときの辺の選択 |

`w` が無ければ parse がその場で止める。

```text
✖ seg requires a width w:(mm)
```

置けるかどうかの判定も開口と同じ順で走る — 線分を取り、`edge` で絞り、一つも無ければ置けず、二つ以上あれば辺を選ばなければ置けず、幅が線分の長さを超えれば置けない。

```text
✖ There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)
✖ The seg width 9000 exceeds the boundary segment length 3600
✖ The seg position Y1+1000 is on the wrong axis: a horizontal segment takes an X grid line
```

## 属性は区間の上書きである

境界の `spec` を、その区間だけ差し替える。

```muro
koyu 1.0
name 分節の書き方
unit mm

grid X 0 8000
grid Y 0 5000
level L1 0 h:2700 slab:200

space /L1/office office X1..X2 Y1..Y2 name:事務室
  area X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /out name:外部 outside:1

boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール fire:60
  window w:2400 h:2000 at:X1+4000 name:嵌め殺し
boundary /L1/office /out t:180 spec:RC edge:N
boundary /L1/office /out t:180 spec:RC edge:E
boundary /L1/office /out t:180 spec:RC edge:W
  door w:900 h:2100 name:出入口
```

南面の壁は `spec:RC` だが、X1+4000 を中心とする 3000mm の区間だけは `spec:カーテンウォール` である。その同じ区間に窓を一枚吊ってある — `seg` と開口は互いに干渉しないので、重なって構わない。

面積は 8000 × 5000 のままである。

```text
  /L1/office	事務室	office	40.00 m2
```

`seg` も、その上の `area` も、一平米も動かしていない。

## area との対

数えない分節は二つある。**どちらも隔離則に従う** — 位置と上書き属性だけを運び、構成には影響しない。

| | どこに書く | 何を割る |
|---|---|---|
| `seg` | [境界](boundary.md)の直下 | 境界線分の上の区間 |
| `area` | [空間](space.md)の直下 | 室の中の領域 |

`area` は床材の切替のような室内の分節で、親の領域からはみ出せば警告 (SEG02)、領域を持たない空間に書けばエラー (SEG01) になる。

## 属性の層

| 属性 | 層 |
|---|---|
| `w` `at` `edge` | 構造 — parse が型つきの欄へ持ち上げる |
| `name` | 解釈 |
| `spec` `fire` `sound` | 運搬 — 運ぶだけ |

台帳に無いキーは書けない。

```text
✖ seg (/L1/a | /out) carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:タイル)
```

ドットを含む名前空間 (`acme.finish:タイル`) を付ければ通る。core は名前空間つきのキーを読まない。

`name` は**その境界の中で一意な名**である。同じ境界に同じ名の `seg` を二つ書けば UID04 になる。

## 診断

| コード | severity | 何を言うか |
|---|---|---|
| SEG03 | warning | `open` 境界の上の `seg` — 壁が無いので解釈されない |
| SEG04 | error | `seg` を置ける境界線分が無い |
| SEG05 | error | 境界線分が複数で、どれか決まらない |
| SEG06 | error | `seg` の幅が線分の長さを超える |
| SEG07 | error | 絶対位置の軸違い |
| SEG08 | error | 絶対位置のはみ出し |
| VRT06 | warning | 垂直の境界の上の `seg` — 解釈されない |
| UID04 | error | 同じ境界の中で `name` が重複 |

SEG01 と SEG02 は `area` の診断であって `seg` のものではない。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [boundary](boundary.md) — `seg` が載る関係
- [door](door.md) / [window](window.md) — 壁を割る開口
- [space](space.md) — `area` を書く先
- [koyu check](../cli/check.md)
