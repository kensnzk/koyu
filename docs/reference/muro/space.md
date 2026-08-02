---
title: space — 空間
mode: reference
---

# space — 空間

```muro-part
space /L5/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK floor:オーク
space /out/road-s name:南側道路 road:12000 outside:1
```

`space <パス> <型> [領域...] [属性...]` は空間を宣言する。**空間が一次要素である** — 壁は空間の持ち物ではなく二つの空間の関係であり ([boundary](boundary.md))、平面図も面積も動線も空間の並びから導出される。

## パス — 同一性

第1位置引数は `/` で始まるパスで、これがモデルの中の同一性である。

```muro-part
space /L5/A/ldk ldk X1..X2 Y1..Y2
```

- **パスは集計の階層でもある。**接頭辞で束ねるのが[ゾーン](zone.md)の仕事で、`/L5/A` というゾーンは `/L5/A/` で始まる空間をすべて配下に持つ。
- **先頭セグメントが宣言済みの[レベル](level.md)名なら、その空間はそのレベルに属する。**`/L5/A/ldk` は L5 に載る。レベル名でなければ (`/site/bldg` など) レベルは決まらないので、`level:` で明示する。
- パスの重複はエラーである。合成しているときは両者の出所が示される。

```text
Duplicate space path: /L1/a (first seen in floors/L1.muro at line 12)
```

パスは改名で変わる。改名を跨いで外部の台帳と突き合わせたいときは `uid:` を使う。

## 型 — 開かれた語彙

第2位置引数は型で、**任意**である。`room` も `ldk` も `厨房` も `tenant` も書けるし、書かなくてもよい。

```muro-part
space /L1/a room X1..X2 Y1..Y2
space /L1/b X1..X2 Y1..Y2
```

**koyu は型の位置を一切読まない。**型は集計の軸 ([stats](../cli/stats.md) の型別小計) と平面図の刷り字に現れるだけで、どの判定の入口にもならない。だから綴りを間違えても何も起きない — `bedroom` を `bedrom` と書いた行は、エラーにならず新しい型として一行増える。それでよいのは、そこに意味が置かれていないからである。

書かなければ正準形に `type` の鍵は現れない。**既定の語を捏造することはしない。**

### 構成の事実は宣言の側にある

外部であること・吹抜けであることは型ではなく[属性](attributes.md)で書く。

| 宣言 | 意味 |
|---|---|
| `outside:1` | 建物の外部。領域を持たなくてよい。`road:` を付ければ接道の対象になる |
| `void:1` | 吹抜け。床面積に算入せず、通行できず、床も天井も生成されない |

```muro-part
space /out name:南側道路 road:6000 outside:1
space /L2/hole X1..X2 Y1..Y2 name:吹抜け void:1
```

かつてこの二つは型の位置に書かれていた。型の位置は開かれた語彙なので、`exteriorr` と一字余分に打った瞬間にその空間は外部でなくなり、**延床が 16.20㎡ から 32.40㎡ へ倍増しながら check は緑のまま**だった。守りとして二語の一字違いだけを拒む見張りを置いていたが、それは規則の代わりに置いた勘であって、`void` の二字違いには `road` と `wood` — 人が正当に書く語 — が入るので広げることもできなかった。

属性の位置に移すと、綴りを守るのは台帳になる ([ATT03](../diagnostics/att.md#att03) が未知の鍵を、[ATT02](../diagnostics/att.md#att02) が値域を拒む)。`outsid:1` はエラーであり、`acme.outside:1` は運搬層として通る — **著者が「これは自分の語で、ツールは読まない」と綴れる**からである。開いていることと信頼できることは、境界が宣言されていれば両立する ([scope](../scope.md))。

## 領域 — 矩形の合併

領域は `X?..X? Y?..Y?` の**二トークン**で、X 系の範囲と Y 系の範囲を一つずつ書く。`+` を独立したトークンとして挟めば、複数の矩形の合併になる (L 字など)。

```muro-part
space /L1/L ldk X1..X3 Y1..Y2 + X1..X2 Y2..Y3 name:L字
```

- 逆順表記 (`X2..X1`) は同じ矩形の別綴りで、昇順に正規化して保存される。
- 幅ゼロの領域はエラーになる。
- **同一空間の中で矩形が重なれば [GEO01](../diagnostics/geo.md)、同じレベルの空間同士が重なれば [GEO02](../diagnostics/geo.md)** で、どちらもエラーである。
- 領域は省略してよい。`exterior` の空間や、幾何を持たない読み替えのための空間は領域なしで書ける。ただし領域を持たない空間には[分節](area.md)を書けない。

領域を持つ空間には[レベル](level.md)と天井高が要る。どちらかが決まらなければ立体が一つも作れないので、[SUF02](../diagnostics/suf.md) / [SUF01](../diagnostics/suf.md) のエラーになる。

通り参照とオフセットの綴り方は [位置と領域](positions.md) にある。

## 寸法で書く — 帯の要素

領域の代わりに寸法と並びで割るなら [band](band.md) を使う。帯の直下に字下げした `space` 行が、領域ではなく `w:` を持つ。

```muro-part
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

字下げしていない `space` に `w:` は書けない。字下げを落とした要素が「領域を持たない空間」として黙って通るのを防ぐためである。

```text
✖ b5.muro:line 4: w: may not be written on space (a space written by width sits indented under band)
```

## 字下げの分節 — area

`space` の直下に字下げした `area` は、室内の数えない分節である。床材の切替のような、面積にも室数にもグラフにも現れない情報を運ぶ。[area](area.md) を見る。

## レベルスパン

パスの**先頭セグメント**が `L3..L10` の形なら、宣言済みレベルの z 順の並びに展開される。基準階を一度だけ書くための綴りである。

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:Bタイプ use:exclusive
```

一行の中の複数パスは同じスパンを指していなければならない。展開された空間には、字下げした `area` も同じように付く。

## 属性の一覧

空間に書ける鍵はここに挙げたものと、ドットを含む名前空間つきの鍵 (`acme.sensor:23`) だけである。**台帳に無い鍵で名前空間も無いものは [ATT03](../diagnostics/att.md) のエラーになる** — `heigh:2400` が黙って読み飛ばされて緑になる、という事故を塞ぐためである。

```text
✖ s1.muro:line 4: /L1/a carries heigh:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.heigh:2400)
```

三つの層に分かれる。**構造層**は parse が型のついたフィールドへ持ち上げるもの、**解釈層**は core が値を読むもの、**運搬層**は core が一切見ずに運ぶだけのものである。層の考え方は [属性の三層](attributes.md) にまとめてある。

### 構造層

| 鍵 | 値 | 意味 |
|---|---|---|
| `level:` | 宣言済みのレベル名 | 所属レベルの明示。既定はパスの先頭セグメント。階を跨ぐくくり (メゾネット) や、パスの先頭がレベル名でないとき (`/site/bldg`) に要る。未宣言のレベルを指せば `Undeclared level: level:L9` で止まる |
| `w:` | 正の整数 mm / `rest` | [帯](band.md)の要素の寸法。帯の外の `space` には書けない |

### 解釈層

| 鍵 | 値 | 意味 |
|---|---|---|
| `h:` | 正の数値 mm | 天井高。既定はレベルの `h:`。高さ不変量と矩計が読む |
| `use:` | 自由語 | 集計の軸 (`rentable` `exclusive` `common` …)。[ゾーン](zone.md)から継承され、空間側の宣言が勝つ |
| `road:` | 正の数値 mm | `exterior` 空間の幅員 — 道路の印。`site` が接道長を導出する |
| `daylight:` | `0` / `1` | 採光判定の対象の宣言。`1` を書いた空間にだけ `light` が 1/7 を掛ける。既定は対象外。継承しない |
| `ceiling:` | `0` / `1` | `0` で天井を張らない (現し天井)。既定は張る |
| `uid:` | 不透明トークン | 改名を跨ぐ永続同一性。数字だけの形と空白はエラー。モデル全体 (space と zone を横断) で一意 |
| `name:` | 自由語 | 表示名。図面と一覧に出る。書かなければパスの末尾セグメントが使われる |
| `stair:` `ramp:` `escalator:` | `N` / `E` / `S` / `W` | 縦動線の宣言。キーが装置を、値が上る向きを名指す |
| `lift:` | `1` | 昇降機の宣言 (向きを持たない) |
| `form:` | `straight` / `return` | 縦動線の折返し。既定は `straight` |
| `turn:` | `R` / `L` | 折返しの回る向き。既定は `R` |
| `entry:` | 正の数値 mm | 乗り込みの床の奥行。既定 1100 |
| `landing:` | 正の数値 mm | 折返しの中間踊り場の奥行。既定は導出 (目標踏面からの残余) |
| `riser:` | 正の数値 mm | 蹴上げの上限。既定 180 |
| `tread:` | 正の数値 mm | 目標踏面。既定 300 |
| `lane:` | 正の数値 mm | 一台・一車線の幅。エスカレーターの既定 1200 |
| `slope:` | 正の数値 | 斜路の許容勾配の分母 (`slope:6` = 1/6 まで)。書く勾配ではなく検査の上限 |

**値も検査される。**数値でなければ [ATT01](../diagnostics/att.md)、決まった語彙の外なら [ATT02](../diagnostics/att.md) である (`daylight` は [DAY01](../diagnostics/day.md)、`form` と縦動線の向きは [RUN](../diagnostics/run.md) 族が守る)。書いたのに解釈されなかった値は、黙って既定へ落ちない。

```text
$ npx tsx src/cli.ts check s3.muro --json
  "code": "DAY01",
  "message": "daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes",
  "code": "ATT02",
  "message": "ceiling on /L1/a is one of 0 / 1: ceiling:2",
  "code": "ATT02",
  "message": "turn on /L1/a is one of R / L: turn:X",
```

### 運搬層

| 鍵 | 意味 |
|---|---|
| `floor:` | 床仕上げ。[area](area.md) が区間上書きできる |
| `spec:` | 物の名。ツールは解釈せず運ぶだけ |
| `<名前空間>.<鍵>:` | ドットを含む鍵は誰でも書けて、core は中身に一切の意味を与えない (`acme.sensor:23` `bems.temp:22.5`) |

### 空間に書けない鍵

紛らわしい三つを名指しておく。

- `site:` と `area:` は[ゾーン](zone.md)の鍵である。空間に書けば ATT03 になる。
- `underground:` は[レベル](level.md)の鍵である。空間に書けば ATT03 になる。
- `type:` は[境界](boundary.md)の鍵である。空間の型は属性ではなく第2位置引数であり、しかも任意である。

## daylight — 採光の対象は宣言する

```muro
koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2400 slab:150
space /L1/living living X1..X2 Y1..Y2 daylight:1 name:居間
space /out name:外部 outside:1
boundary /L1/living /out edge:S t:120
  window w:2400 h:1800
```

```text
$ npx tsx src/cli.ts light d1.muro
✔ /L1/living	居間	window 4.32 m2 / floor 20.00 m2 = 1/4.6 (needs 1/7 ≈ 2.86 m2)
✔ Every room meets 1/7 — 1 room in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

`daylight:` を書かなければその室は判定の外である。**属性は法の概念ではなくツールの振る舞いを名指している** — 何に 1/7 を掛けるかは書き手が決める。

## ceiling — 天井は近似である

天井面は室の輪郭を `h:` の高さで写したものとして導出される。

**この輪郭は、実際の天井と必ずしも一致しない。**折上げ天井も、梁型の下がり天井も、数室にまたがる連続天井も、カーテンウォール手前の見切りも、この解像度の外にある。導出は基本計画の粗さでの近似であって、作図された天井ではない。

天井そのものが無い室 — 現し天井 — だけは宣言できる。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2 ceiling:0
```

このモデルから生成される面は次のとおりで、`/L1/b` には天井が無い。

```text
floor /L1/a -150 0
ceiling /L1/a 2370 2400
roof /L1/a 2400 2600
floor /L1/b -150 0
roof /L1/b 2400 2600
```

吹抜け・外部・半屋外・縦動線の空間にはもともと天井が張られないので、`ceiling:0` は要らない。

## 縦動線

階段・斜路・エスカレーター・昇降機は、装置を名指す鍵と上る向きだけで宣言する。**段数も踏面も踊り場も勾配も書かない** — 領域と階高から導出される。

```muro-part
space /B2..B1/ramp ramp X3..X5 Y1..Y2 name:車路 use:parking ramp:E form:return slope:6
space /B2..B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 use:common stair:N form:return
space /B2..B1/ev shaft X3+2600..X3+5200 Y2..Y2+5400 name:EV use:common lift:1
```

```text
$ npx tsx src/cli.ts runs examples/basement/main.muro
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B2/ramp
B2→B1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B2/st
```

一つの空間に装置は一つだけである (二つ書けば [RUN01](../diagnostics/run.md))。領域は矩形一つでなければならない。**どの階と繋がるかは空間ではなく垂直の[境界](boundary.md)が持つ** — 装置の宣言は形の生成規則であって、トポロジーではない。規則の全体は [縦動線](vertical-circulation.md) にある。

## 空間から導かれるもの

書いた `space` から、書かずに出てくるものがある。

- **面積** — 壁芯で算定され、`void` と `exterior` は延床から外れる。
- **境界** — 同じレベルで平面が接する領域つき空間の組には、宣言が無ければ壁の境界が導かれる。
- **半屋外** — `open` または `air:1` の境界で `exterior` に接する空間は半屋外として扱われ、天井も屋根も架からない。
- **柱** — 通り芯の交点のうち、床のある空間の内側に立つ。
- **床・天井・屋根** — レベルの `slab:` と `h:` から生成される。

```text
$ npx tsx src/cli.ts stats v1.muro
L1
  /L1/hall	ホール	hall	14.40 m2
  /L1/r	r	room	14.40 m2
  Subtotal 28.80 m2
L2
  /L2/void	吹抜け	void (not counted as floor area)
  /L2/r	r	room	14.40 m2
  Subtotal 14.40 m2
Total 43.20 m2 (indoor floor area)
  hall: 14.40 m2
  room: 28.80 m2
```

## 子で割るときは親をゾーンにする

領域つきの `space` の下に領域つきの `space` を置くと、二つの領域が重なって [GEO02](../diagnostics/geo.md) になる。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/A unit X1..X3 Y1..Y2
space /L1/A/ldk ldk X1..X2 Y1..Y2
```

```text
✖ z1.muro:line 4: Space regions overlap: /L1/A and /L1/A/ldk
```

住戸を室に割るなら、親を[ゾーン](zone.md)にする。ゾーンは幾何を持たず、パス接頭辞で配下を束ねるだけだからである。
