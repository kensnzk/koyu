---
title: 書きたいものから引く
mode: reference
---

# 書きたいものから引く

**書きたいものが決まっているときの索引である。**左から「やりたいこと」を探し、右の例のファイルを開いて、その形を写す。同梱の例はすべて `koyu check` が通る実物なので、写した形は動く。

記法そのものの規定は[記法リファレンス](../reference/muro/index.md)にある。この頁が持つのは**どこに実物があるか**だけである。

## 平面を割る

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 室を並べる | `space <パス> <型> X1..X2 Y1..Y2` | `examples/two-rooms.muro` |
| L字・凸型の室 | 領域を `+` で繋ぐ | `examples/house.muro` の `/home/ldk` |
| 室のあいだの壁 | `boundary` を一行。書かなくても既定で壁が立つ (ただし通れない) | `examples/two-rooms.muro` |
| 扉・窓を吊る | 境界に字下げで `door` / `window` | `examples/two-rooms.muro` |
| 開口の位置を指定 | `at:0.75` (比率) / `at:X2+600` (通り芯基準) | `examples/office.muro` / `examples/house/L1.muro` |
| 外部への開口で辺を選ぶ | `edge:N` / `edge:E` / `edge:S` / `edge:W` | `examples/two-rooms.muro` |
| 位置ではなく寸法と並びで割る | [`band`](../reference/muro/band.md) + 字下げの `space` | `examples/tower/typical.muro` / `examples/complex/hotel.muro` |
| 斜めに切る | 境界に字下げで [`line`](../reference/muro/line.md) | `examples/complex/L1.muro` |
| 室を割らずに床材だけ変える | 空間に字下げで [`area`](../reference/muro/area.md) | `examples/office.muro` の `/L1/hall` |
| 一本の壁の一部だけ材料を変える | 境界に字下げで [`seg`](../reference/muro/seg.md) | `examples/office.muro` |
| 建具の型を一箇所にまとめる | [`asset`](../reference/muro/asset.md) を宣言し、開口が名前で参照 | `examples/house/assets.muro` |

## 階を積む

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 階を宣言する | `level L1 0 h:2400 slab:150` | `examples/two-rooms.muro` |
| 等差の階を一行で | `level L3..L9 6700 pitch:2900 h:2400 slab:500` | `examples/mansion.muro` |
| 最上階の上限を与える | 空間を持たない `level R` | `examples/office.muro` |
| 基準階を一度だけ書く | パスの先頭を `/L2..L9/` にする | `examples/mansion.muro` |
| 例外階を差分で書く | 基準階の層とは別のファイルに、違うところだけ書く | `examples/tower/L3.muro` |
| 階がパスから読めないとき | 空間に `level:L1` | `examples/house.muro` |
| 一室だけ天井を高くする | 空間に `h:6700` | `examples/office.muro` の `/L1/hall` |
| 地下を書く | `level B1 -3700 … underground:1` | `examples/basement/main.muro` |
| 客の階数に現れない機械階 | 独立した `level M1` を挟む | `examples/twin/main.muro` |

## 縦に繋ぐ

**床は書かない。**上下に重なる空間には既定で床がある。書くのは例外だけである。

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 階段で繋ぐ | `boundary /L1/stair /L2/stair type:stair` | `examples/office.muro` |
| 通れないシャフト | `type:shaft` | `examples/office.muro` |
| 床を抜く (吹抜け) | `type:void` の境界と、`void:1` を宣言した空間 | `examples/office.muro` |
| 何層にもわたる縦動線を一括で | [`stack`](../reference/muro/stack.md) `ev L1..L10 type:shaft` | `examples/mansion.muro` |
| 階段の段数・踏面を出す | 空間に `stair:N form:return` と書き、[`runs`](../reference/cli/runs.md) に訊く | `examples/basement/main.muro` |
| 斜路 | 空間に `ramp:E form:return slope:6` | `examples/basement/main.muro` |
| エスカレーター | 空間に `escalator:N`、繋ぎは `type:stair` | `examples/complex/L1.muro` |
| 昇降機 | 空間に `lift:1`、繋ぎは `type:shaft` | `examples/basement/main.muro` |
| 何層も貫くアトリウム | `stack atrium L1..L5 type:void` | `examples/complex/main.muro` |
| EVの通過階を表す | シャフトは通し、乗場ホールの空間を置かない | `examples/twin/core.muro` |

## 外・敷地・外構

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 外部を作る | `space /out name:外部` (領域は要らない) | `examples/two-rooms.muro` |
| 外部を方角ごとに割る | `/out/n` `/out/e` … と複数の `exterior` | `examples/house.muro` |
| 道路 | `space /road-s exterior road:22000` | `examples/complex/site.muro` |
| 敷地 | `zone /site … site:1` (測量値は `area:`) | `examples/house.muro` |
| 敷地形状 | [`polygon`](../reference/muro/polygon.md) `/site x,y x,y …` | `examples/tower/site-geometry.muro` |
| 庭・通路を実在の空間にする | L1 上の `exterior` / `yard` / `garden` が建物の周りをタイルする | `examples/house/site.muro` |
| 塀・フェンス | 境界に `spec:ブロック塀 air:1` | `examples/house.muro` |
| バルコニーを半屋外にする | 外部に対して `air:1` の境界を一本持たせる | `examples/mansion.muro` |
| 接道長を出す | 敷地配下の空間と `road:` を持つ外部を境界で接する | `examples/tower/site.muro` |

## 大きさを畳む

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 同じ階が何層も続く | パスの先頭を `/L7..L13/` に | `examples/complex/office.muro` |
| 同じ割付を地下2層に | `/B2..B1/` | `examples/basement/main.muro` |
| コアを地下から最上階まで | `/B2..L19/` の空間9行 | `examples/complex/core.muro` |
| 客室・テナント区画を並べる | `band` に幅を並べる | `examples/complex/hotel.muro` |
| 幅の合計を検算させる | `w:rest` を使わない**閉じた帯**にする | `examples/tower/typical.muro` |
| 柱を立てる | [`column`](../reference/muro/column.md) `900 B2..L6` (位置は書かない) | `examples/complex/main.muro` |

## ファイルを分ける

| やりたいこと | 書き方 | 実物 |
|---|---|---|
| 層に分けて分担する | base 層で `import ./L1.muro` | `examples/house/main.muro` |
| どこまでを base 層が持つか | `koyu` / `name` / `unit` / `grid` / `level`、そして階を跨ぐ境界 | `examples/tower/main.muro` |
| 所与のジオメトリを隔離する | 敷地形状だけの層を作る | `examples/tower/site-geometry.muro` |
| 層の強さを見る | [`koyu layers`](../reference/cli/layers.md) | — |
| 上の層で値を上書きする | [`over` / `drop`](../reference/muro/over-drop.md) | 同梱の例では使っていない |
| 単一ファイルと合成版が同じか確かめる | [`koyu diff`](../reference/cli/diff.md) | `examples/house.muro` と `examples/house/main.muro` |

## 数える・問う

| 訊きたいこと | コマンド | 実物 |
|---|---|---|
| 構成が壊れていないか | [`check`](../reference/cli/check.md) | すべての例 |
| 建築的におかしくないか | [`validate`](../reference/cli/validate.md) | すべての例 |
| 面積・用途別の比率 | [`stats`](../reference/cli/stats.md) | [office](office.md) / [twin](twin.md) |
| 外へ出るのに扉は何枚か | [`doors`](../reference/cli/doors.md) | [two-rooms](two-rooms.md) / [mansion](mansion.md) |
| 隣接の全体 | [`graph`](../reference/cli/graph.md) | [two-rooms](two-rooms.md) |
| 矩計 (高さの積み上がり) | [`levels`](../reference/cli/levels.md) | [office](office.md) / [basement](basement.md) |
| 段数・踏面・勾配 | [`runs`](../reference/cli/runs.md) | [basement](basement.md) / [complex](complex.md) |
| 採光 | [`light`](../reference/cli/light.md) | [mansion](mansion.md) / [tower](tower.md) |
| 敷地・建蔽率・容積率・接道 | [`site`](../reference/cli/site.md) | [house](house.md) / [twin](twin.md) |
| 平面図 | [`plan`](../reference/cli/plan.md) | すべての例 |
| 立体 | [`axo`](../reference/cli/axo.md) | [complex](complex.md) / [twin](twin.md) |
| 機械形式 | [`json`](../reference/cli/json.md) | `examples/two-rooms.canonical.json` |

## 難度で選ぶなら

[同梱の建物](index.md)の表に規模が並んでいる。おおむね two-rooms → office → house → basement → mansion → tower → complex → twin の順に積み上がる。
