---
title: 属性の三層
mode: reference
---

# 属性の三層

**属性は `key:value` で書かれる。だが `key` は自由ではない。**

書ける鍵は台帳が定める。台帳に無く、名前空間も持たない鍵は `ATT03` のエラーになる。

```text
/L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if
the value is only carried — e.g. acme.nmae:居室)
```

**この一行がある理由は、「見ていない」と「見て問題がない」を区別するためである。**鍵が無防備なら `heigh:2400` は高さの不変量を、`sit:1` は敷地の判定を、`stiar:N` は縦動線を、それぞれ丸ごと無音にしたまま `check` を緑で通す。書いたのに効かないのに緑である状態を、koyu は持たない。

行の綴り方 (`:` の位置・値の型・重複) は [一行の読まれ方](lines.md) にある。この頁は、どの鍵をどこに書いてよく、書いた値がどう扱われるかを書く。

## 三つの層

| 層 | 例 | 扱い |
|---|---|---|
| **構造層** | パス・区画・レベル・関係の相手・`type` `t` `air` `edge` `w` `at` `hinge` `swing` `d` `x` `y` | **必ず見る。**壊れていれば読まない — その場の構文エラーで止まる |
| **解釈層** | `outside` `void` `h` `use` `road` `daylight` `site` `area` `style` `ceiling` `uid` `name` `stair` `riser` … | **見る。**台帳が値域を定め、外れれば診断が出る |
| — | 空間の**型** (第2位置引数) | **見ない。**任意の自由なラベルで、集計と刷り字にしか現れない |
| **運搬層** | `spec` `fire` `sound` `floor` `sill` と、名前空間つきの任意の鍵 | **見ない。**運ぶだけ |

**構造層の鍵は属性として残らない。**`type:` `t:` `air:` `edge:` `w:` `at:` `hinge:` `swing:` `d:` `x:` `y:` は読み込みの時点で要素の項目へ持ち上げられ、値の検査もその場で行われる。したがってこれらが `ATT01` / `ATT02` として現れることはない — 数値でない `t:` はもっと早く `The attribute t is written as a number` で止まる。

**運搬層は値を見られない。**`spec:RC` も `fire:60` も `sill:800` も、koyu は運ぶだけで意味を与えない。壁が何でできているかは物の名 (`spec`) の値であり、境界の型を増やす理由にはならない。

## 台帳は「書いてよい鍵の一覧」である

**台帳に載っていることは、core がその鍵を読むことを意味しない。**`spec` `fire` `sound` `floor` `sill` は台帳に載っている運搬層の語である — 意味の定まった語に別の綴りを使わせないために載せてあり、値は解釈されない。

逆に、台帳に無い鍵でも**名前空間を持てば書ける**。

```muro-part
space /L1/a room X1..X2 Y1..Y2 acme.sensor:23 bems.temp:22.5 survey.measured:2026-03-11
```

名前空間の綴りは**小文字英字で始まり、ドットで区切られた区間を一つ以上持つ**ものである (`[a-z][a-z0-9_-]*` に `.[a-z0-9_-]+` が一つ以上続く)。

| 書いたもの | 結果 |
|---|---|
| `acme.sensor:23` | 運搬層。core は中身に一切の意味を与えない |
| `bems.temp:22.5` | 同上 |
| `Acme.sensor:23` | `ATT03` — 大文字で始まる鍵は名前空間として読まれない |
| `acme.Sensor:23` | `ATT03` — 区間に大文字は使えない |
| `sensor:23` | `ATT03` — ドットが無い |
| `nmae:居室` | `ATT03` — `name` の綴り違い。**これを捕まえるための規則である** |

名前空間の中身に core は分割の規則すら持たない。**ドットが一つでもあれば運搬層である**、というだけの規則になっている。

**名前空間を付ければ何でも書けることと、それが意味を持つことは別である。**`acme.uid:` は書けるが、それは運搬層であり、同一性を持たせたことにはならない。

## 値が検査される三つの形

解釈層の値は、台帳が定めた型に合わなければ診断になる。**書いたのに解釈されなかった値を、黙って既定へ落とさない。**

| コード | 何を言うか | 例 |
|---|---|---|
| `ATT01` | 正の数値でなければならない鍵に、数値でない値・0・負の値 | `h on /L1/a is written as a positive number: h:0` |
| `ATT02` | 決まった語彙の外の値 | `ceiling on /L1/a is one of 0 / 1: ceiling:2` |
| `ATT03` | 台帳に無く、名前空間も無い鍵 | 上表 |

いくつかの鍵は専用の診断が守っている — `daylight` は `DAY01`、縦動線の向きは `RUN02`、`form` は `RUN05` である。

```text
daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/b carries daylight:yes
site on zone /L1 is one of 0 / 1: site:yes
style on door (/L1/a | /L1/b) is one of hinged / sliding / auto: style:swing
turn on /L1/b is one of R / L: turn:X
```

## 要素ごとの台帳

**台帳は要素ごとに閉じている。**同じ `uid` でも `space` と `zone` には書けて、`boundary` には書けない (`ATT03`)。

### space

| 鍵 | 層 | 値 | 意味 |
|---|---|---|---|
| `level` | 構造 | レベル名 | 所属レベルの明示。既定はパスの先頭セグメント |
| `w` | 構造 | 正の整数 mm / `rest` | 帯の要素の寸法。**帯の外の `space` には書けない** |
| `outside` | 解釈 | `0` / `1` | 建物の外部。**領域を持たなくてよい。**延べ面積に算入しない |
| `void` | 解釈 | `0` / `1` | 吹抜け。床が無いので延べ面積に算入せず、通行もできない |
| `h` | 解釈 | 正の数値 mm | 天井高。既定はレベルの `h` |
| `use` | 解釈 | 自由 | 集計の軸。ゾーンから継承される |
| `road` | 解釈 | 正の数値 mm | `outside:1` の幅員 — 道路の印。接道の導出が読む |
| `daylight` | 解釈 | `0` / `1` | 採光の問いの対象かどうかの宣言 |
| `ceiling` | 解釈 | `0` / `1` | `0` で天井を張らない |
| `uid` | 解釈 | 不透明トークン | 改名を跨ぐ永続同一性。数字だけ・空白は不可 |
| `name` | 解釈 | 自由 | 表示名 |
| `stair` `ramp` `escalator` | 解釈 | `N` / `E` / `S` / `W` | 縦動線の宣言。値は上る向き |
| `lift` | 解釈 | `1` | 昇降機の宣言。向きを持たない |
| `form` | 解釈 | `straight` / `return` | 折返しの有無 |
| `turn` | 解釈 | `R` / `L` | 折返しの向き |
| `entry` | 解釈 | 正の数値 mm | 乗り込みの床の奥行 |
| `landing` | 解釈 | 正の数値 mm | 中間踊り場の奥行 |
| `riser` | 解釈 | 正の数値 mm | 蹴上げの上限 |
| `tread` | 解釈 | 正の数値 mm | 目標踏面 |
| `lane` | 解釈 | 正の数値 mm | 一台・一車線の幅 |
| `slope` | 解釈 | 正の数値 | 許容勾配の分母 (`slope:6` = 1/6 まで) |
| `floor` | 運搬 | 自由 | 床仕上げ |
| `spec` | 運搬 | 自由 | 物の名 |

### zone

| 鍵 | 層 | 値 | 意味 |
|---|---|---|---|
| `name` | 解釈 | 自由 | 表示名 |
| `use` | 解釈 | 自由 | 配下の空間へ継承される集計の軸 |
| `site` | 解釈 | `0` / `1` | 敷地の集約の印 |
| `area` | 解釈 | 正の数値 ㎡ | 敷地の宣言面積 (測量値)。導出面積と照合される |
| `uid` | 解釈 | 不透明トークン | space と同じ規則 |

### boundary

| 鍵 | 層 | 値 | 意味 |
|---|---|---|---|
| `type` | 構造 | `wall` / `open` / `stair` / `shaft` / `void` | 関係のトポロジー |
| `t` | 構造 | 正の数値 mm | 壁厚 (芯振り分け) |
| `air` | 構造 | `0` / `1` | `1` = 物はあるが外気と光を遮らない (手すり・柵) |
| `edge` | 構造 | `N` / `E` / `S` / `W` | 線分を a 側から見た辺に限定する |
| `h` | 解釈 | 正の数値 mm | `air:1` の境界の天端高 |
| `name` | 解釈 | 自由 | 表示名 |
| `spec` | 運搬 | 自由 | 物の名 (RC・LGS・カーテンウォール・手すり…) |
| `fire` | 運搬 | 自由 | 耐火 |
| `sound` | 運搬 | 自由 | 遮音 |

### door / window / asset

**建具アセットは開口と同じ台帳で読まれる。**「アセットに書けて開口に書けない属性」を作らないためである。

| 鍵 | 層 | 値 | 意味 |
|---|---|---|---|
| `w` | 構造 | 正の数値 mm | 幅。**必須** (アセットが与えてもよい) |
| `h` | 構造 | 正の数値 mm | 高さ |
| `at` | 構造 | `0..1` の比率 / 通り参照 | 位置 |
| `edge` | 構造 | `N` / `E` / `S` / `W` | 複数線分からの辺選択 |
| `hinge` | 構造 | `N` / `E` / `S` / `W` | 吊元 |
| `swing` | 構造 | `a` / `b` | 開く先 |
| `style` | 解釈 | `hinged` / `sliding` / `auto` | 建具の型 |
| `name` | 解釈 | 自由 | **境界の中で一意な名** — 開口の同一性の鍵 |
| `sill` | 運搬 | 自由 | 窓台高 |
| `spec` `fire` | 運搬 | 自由 | |

### area / seg / column

| 要素 | 構造 | 解釈 | 運搬 |
|---|---|---|---|
| `area` | (領域は位置引数) | `name` | `floor` `spec` |
| `seg` | `w` `at` `edge` | `name` | `spec` `fire` `sound` |
| `column` | `d` `x` `y` | `name` | `spec` |

### level は属性の器を持たない

**`level` が受けるのは `h` `slab` `pitch` `underground` の四語だけで、他は名前空間を付けても書けない。**

```text
level carries undergound:, which is not in the ledger (level reads h / slab / pitch / underground)
level carries acme.x:, which is not in the ledger (level reads h / slab / pitch / underground)
```

`level` の値はすべて項目として持たれ、属性の辞書がそもそも無い。残った鍵は機械形式にも痕跡を残さず消えるので、ここで拒まなければ `undergound:1` が黙って地上階になる。

## 継承と上書き

**属性が要素の間を渡る経路は三本しかない。**

### `use` は zone → space に継承される

集計の軸だけが本当に継承される。空間のパスを接頭辞として含む**最も深いゾーン**の `use` が渡り、**空間側の宣言が勝つ**。

```muro
koyu 1.1
name 継承の例
grid X 0 4000 8000
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ use:exclusive
space /L1/A/ldk  ldk  X1..X2 Y1..Y2 name:LDK
space /L1/A/hall hall X2..X3 Y1..Y2 name:玄関 use:common
```

```text
By use: exclusive 16.00 m2 (50.0%) / common 16.00 m2 (50.0%)
```

`/L1/A/ldk` は書いていない `exclusive` をゾーンから受け取り、`/L1/A/hall` は自分の `common` で上書きしている。

### `floor` は space → area に、`spec` は boundary → seg に区間上書きする

`area` と `seg` は**数えない分節**である。領域や区間と、そこだけで違う属性を運ぶ。

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 floor:オーク
  area X1..X1+1800 Y1..Y1+1800 name:土間 floor:タイル

boundary /L1/ldk /L1/corridor spec:LGS
  seg w:1800 at:0.5 spec:受付ガラス
```

**上書きは区間の上書きであって、合成でも継承でもない。**分節の値はその領域・その区間について読まれ、外側では親の値が読まれる。分節は面積にも室数にもグラフにも影響しない — 数えるのは空間と境界だけである。

### それ以外は渡らない

アセットから開口への値の流れだけが例外的に見える。**アセットの属性は開口の既定になり、開口の行に書いた属性が上書きする。**これは継承ではなく、既定値の束を一箇所に置くための参照である。アセットから継いだ `name` は型の名であって、その開口の同一性の主張ではない — 同じ建具を一枚の壁に二枚並べるのは普通の設計である。

`h` が空間からレベルへ落ちるのも継承ではない。空間の `h` が無ければレベルの `h` を読む、という導出の規則である。どちらも無ければ形が作れないので `SUF01` になる — 詳しくは [書かなかったとき](defaults.md)。
