---
title: 基準階を一度だけ書く
mode: howto
---

# 基準階を一度だけ書く

同じ平面が何層も続く建物で、レベルも空間も境界も**一度だけ**書く。例外階は差分として重ねる。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 一度だけ書けるものは三つある

| 書くもの | 一度だけ書く形 | 展開されるもの |
|---|---|---|
| レベル | `level L2..L6 4200 pitch:4200 …` | L2 L3 L4 L5 L6 の 5 宣言 |
| 空間・境界 | パスの先頭を `/L2..L6/…` にする | 各レベルの空間・境界 |
| 垂直境界 | `stack core L1..L6 type:stair` | 連続するレベル対ごとに 1 本 |

三つは独立している。レベルを範囲で宣言せずに空間だけを範囲で書いてもよいし、その逆でもよい。

## 1. レベルを範囲で宣言する

名が `<接頭辞><数字>..<接頭辞><数字>` の形なら、等差の連番として展開される。z は `z + pitch × k` になる。

```muro-part
level L1 0 h:2800 slab:1400
level L2..L6 4200 pitch:4200 h:2800 slab:1400
level R 25200 slab:600
```

`pitch:` は範囲宣言の**必須**の属性であり、単発の宣言には書けない。

```text
✖ nopitch.muro:line 9: A level range requires pitch: (the storey height in mm): L2..L6
✖ single.muro:line 8: pitch is available only on a level range declaration (L?..L?)
✖ desc.muro:line 9: Cannot read the level range: L6..L2
```

`h:` と `slab:` は展開された全レベルに同じ値で載る。範囲宣言の全規則は [level](../reference/muro/level.md) にある。

## 2. パスの先頭をスパンで書く

空間・ゾーン・境界のパスは、先頭セグメントを `L2..L6` と書けば、**両端の z のあいだにある宣言済みレベルを z の昇順に**展開する。接頭辞が違っていても構わない — 順序は名の綴りではなく z が決める。

```muro-part
space /L2..L6/office room  X1..X2 Y1..Y2 name:貸室 use:exclusive daylight:1
space /L2..L6/core   stair X2..X3 Y1..Y2 name:階段室 use:common stair:N form:return

boundary /L2..L6/office /L2..L6/core t:200 spec:RC
  door w:900 name:階段戸
```

境界の両端に同じスパンを書けば、同じ階どうしの境界が階ごとに一本ずつ生まれる。片方だけスパンにすることもできる。

**バルコニーのように一部の階にしか無いものは、その範囲だけを書く。**同梱の `examples/tower/typical.muro` は住戸を `/L3..L10/`、バルコニーを `/L4..L10/`、コアを `/L3..L11/` と書き分けている — 3階だけ南面が低層部の屋根テラスになるからである。

## 3. 縦動線は `stack` で貫く

```muro-part
stack core L1..L6 type:stair
```

書き方の詳細は [階をつなぐ](connect-storeys.md) にある。

## 4. 例外階は差分の層に置く

基準階の層はそのままにして、例外だけを別のファイルに書き、**あとから import する。**層は後に読まれたものほど強く、`over` は既にある値を差し替える。

```muro-part
# L6.muro — 最上階だけ社員食堂にする
over /L6/office h:3200 use:common name:社員食堂
over level L6 h:3200 slab:1000
```

`over` は定義ではない。対象が既に合成されていなければエラーになるので、**例外の層は基準階の層より後に import する。**強度と `over` の規則は [層に割る](split-into-layers.md) にある。

## 確かめる

```muro-part
# main.muro
koyu 1.1
name 基準階のある事務所ビル
unit mm

grid X 0 8400 16800
grid Y 0 8400

level L1 0 h:2800 slab:1400
level L2..L6 4200 pitch:4200 h:2800 slab:1400
level R 25200 slab:600

import ./L1.muro
import ./typical.muro
import ./L6.muro

stack core L1..L6 type:stair
```

```muro-part
# typical.muro — 5層分をこの 12 行が書いている
space /L2..L6/office room  X1..X2 Y1..Y2 name:貸室 use:exclusive daylight:1
space /L2..L6/core   stair X2..X3 Y1..Y2 name:階段室 use:common stair:N form:return

boundary /L2..L6/office /L2..L6/core t:200 spec:RC
  door w:900 name:階段戸
boundary /L2..L6/office /out edge:S t:200 spec:CW
  window w:8000 h:2600 name:CW
boundary /L2..L6/office /out edge:W t:200 spec:CW
boundary /L2..L6/office /out edge:N t:200 spec:CW
boundary /L2..L6/core /out edge:E t:200 spec:RC
boundary /L2..L6/core /out edge:N t:200 spec:RC
boundary /L2..L6/core /out edge:S t:200 spec:RC
```

```text
$ npx tsx src/cli.ts check main.muro
✔ Consistent — 13 spaces / 47 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**13 の空間と 47 の境界が、40 行足らずから出ている。**[`koyu levels`](../reference/cli/levels.md) が展開されたレベルを見せる。例外の層が L6 の階高と床組み厚を差し替えていることも、この出力に出る。

```text
$ npx tsx src/cli.ts levels main.muro
R	z:25200	slab:600
L6	z:21000	h:3200	slab:1000
  ↑ storey height 4200 = ceiling 3200 + slab 600 + 400 left over
L5	z:16800	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1000 + 400 left over
L4	z:12600	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L3	z:8400	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L2	z:4200	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L1	z:0	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
Per-space ceiling height: /L6/office h:3200
```

[`koyu stats`](../reference/cli/stats.md) は L6 だけを別の名と用途で数える。

```text
L6
  /L6/office	社員食堂	room	70.56 m2
  /L6/core	階段室	stair	70.56 m2
  Subtotal 141.12 m2
Total 846.72 m2 (indoor floor area)
  hall: 70.56 m2
  stair: 423.36 m2
  room: 352.80 m2
By use: common 564.48 m2 (66.7%) / exclusive 282.24 m2 (33.3%)
```

どの値をどの層が与えたかは [`koyu layers --attrs`](../reference/cli/layers.md) が答える。

```text
$ npx tsx src/cli.ts layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	L1.muro
  2	typical.muro
  3	L6.muro

Attribute provenance:
  level:L6:h	← 3 L6.muro
  level:L6:slab	← 3 L6.muro
  space:/L6/office:h	← 3 L6.muro
  space:/L6/office:name	← 3 L6.muro
  space:/L6/office:use	← 3 L6.muro
```

通行も展開される。最上階から外まで、階段は5層降りても扉を増やさない。

```text
$ npx tsx src/cli.ts doors main.muro /L6/office /out
3 doors — /L6/office → /L6/core → /L5/core → /L4/core → /L3/core → /L2/core → /L1/core → /L1/lobby → /out
```

## 落ちるところ

- **`pitch:` を忘れる。**範囲宣言は階高を書かないと展開できない。単発の宣言に書けば逆に叱られる。
- **番号を降順に書く。**`L6..L2` は読めない。
- **例外の層を基準階より先に import する。**`over` の対象がまだ存在しないのでエラーになる。
- **スパンの範囲に、対応する空間の無いレベルが混ざる。**`/L2..L6/…` はその範囲の全レベルに空間を作る。一部の階にだけ置きたいなら範囲を分ける。

## 次に

- [層に割って import で合成する](split-into-layers.md) — 例外階を差分として重ねる仕組み
- [階をつなぐ](connect-storeys.md) — 基準階を貫くコアの書き方
- [住戸を室に割る](subdivide-a-unit.md) — 基準階の住戸を間取りまで割る
