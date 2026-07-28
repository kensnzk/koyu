---
title: 住戸を室に割る
mode: howto
---

# 住戸を室に割る

一室として書いてある住戸を LDK・洋室・水回りに割り、割ったあとも住戸単位の面積が壊れないようにする。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 住戸が一つの `space` として書けていて、[`koyu check`](../reference/cli/check.md) がエラー0で通っていること。
- その住戸の領域 (`X?..X? Y?..Y?` の合併) が分かっていること。

## 最初に踏む罠 — 領域を持つ親の下に、領域を持つ子は置けない

住戸の `space` を残したまま子の `space` を足すと、親の領域と子の領域が重なる。

```muro-bad
koyu 1.0
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450
level L4 11000 slab:450

space /L3/A unit X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2400 name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
```

```text
✖ unit.muro:line 10: Space regions overlap: /L3/A and /L3/A/ldk
✖ unit.muro:line 10: Space regions overlap: /L3/A and /L3/A/bed1
```

**パスの親子関係は面積の二重算入を免除しない。**`/L3/A` と `/L3/A/ldk` は、パスの上で親子であっても、平面の上では重なった二つの空間である。

## 1. 親を `zone` に置き換える

住戸の行を `space` から `zone` に変える。ゾーンは幾何を持たず、**パス接頭辞で配下の空間を束ねる集約**である。領域も型も書かない。

```muro-part
zone /L3/A name:Aタイプ use:exclusive
```

`space` の行を消し忘れると、同じパスの空間とゾーンが並んで警告になる (ZON02)。

```text
⚠ unit-clash.muro:line 10: A space shares its path with a zone (settle on one of them): /L3/A
```

ゾーンが束ねられるもの、継承する属性、集計のされ方は [zone](../reference/muro/zone.md) にある。

## 2. 子の空間で住戸の領域を敷き詰める

子の領域の合併が、もとの住戸の領域と一致するように書く。壁芯で敷き詰めれば、ゾーンの導出面積はもとの住戸の面積にそのまま一致する。

```muro-part
space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
```

L字の室は矩形の合併 (`+`) で書く。

## 3. 室のあいだに扉を書く

接する空間の既定は扉のない壁である。間仕切りそのものは書かなくてよいが、**扉は書かないと通れない。**

```muro-part
boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
```

同じ二室が L 字で二辺に接するときは、`edge:N/E/S/W` で辺を選ぶ。

## 4. 玄関で外側につなぐ

住戸を割ると、内廊下や外部と接するのは住戸ではなく**個々の室**になる。玄関の扉は、玄関ホールと廊下のあいだの境界に移す。

```muro-part
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

## 確かめる

```muro
koyu 1.0
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450
level L4 11000 slab:450

zone /L3/A name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
space /L3/corridor corridor X1..X3 Y2..Y3 name:内廊下 use:common

boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/bed2 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/hall t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

```text
$ npx tsx src/cli.ts check unit.muro
✔ Consistent — 6 spaces / 10 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

宣言した境界は5本だが、10本あると出る。**差の5本は、接していて宣言の無い組に導かれた既定の壁である。**

[`koyu stats`](../reference/cli/stats.md) が、間取りに割ったあとも住戸の言葉で面積を返す。

```text
$ npx tsx src/cli.ts stats unit.muro
L3
  /L3/A/ldk	LDK	ldk	33.28 m2
  /L3/A/bed1	洋室1	bedroom	10.24 m2
  /L3/A/bed2	洋室2	bedroom	7.68 m2
  /L3/A/wet	水回り	wet	7.68 m2
  /L3/A/hall	玄関	hall	2.56 m2
  /L3/corridor	内廊下	corridor	25.60 m2
  Subtotal 87.04 m2
Total 87.04 m2 (indoor floor area)
By zone (counted aggregation):
  /L3/A	Aタイプ	61.44 m2
  ldk: 33.28 m2
  bedroom: 17.92 m2
  wet: 7.68 m2
  hall: 2.56 m2
  corridor: 25.60 m2
By use: exclusive 61.44 m2 (70.6%) / common 25.60 m2 (29.4%)
```

`By zone` の行が住戸の面積であり、専有・共用の比も一行も書き足さずに出る。`use:exclusive` はゾーンから配下の室へ継承される。

玄関から各室へ通れることは [`koyu doors`](../reference/cli/doors.md) が答える。

```text
$ npx tsx src/cli.ts doors unit.muro /L3/A/bed1 /L3/corridor
3 doors — /L3/A/bed1 → /L3/A/ldk → /L3/A/hall → /L3/corridor
```

## 割ると変わること

- **採光の対象は型では動かない。**判定に入るかどうかは `daylight:1` の宣言だけが決める。割る前に住戸へ `daylight:1` を書いていたなら、**割ったあとは宣言を室の側へ書き直す** — 書き直さなければ、割った瞬間に採光の判定が消える。どの室を対象にするかは設計者の判断であって、`ldk` や `bedroom` という綴りからは決まらない。手順は [窓を開けて採光を通す](windows-and-daylight.md) にある。
- **`stats` の型別が細かくなる。**住戸一つが `unit` として計上されていたところが `ldk` `bedroom` `wet` `hall` に分かれる。粒度の変化を吸収するのはゾーン別の行だけである。
- **粒度は混在してよい。**一部の住戸だけ割り、残りは一室のままにできる。同梱の `examples/tower/typical.muro` は A タイプだけを間取りまで割り、B〜F は `unit` 一室のまま置いている。

## 寸法と並びで割るとき

室の位置ではなく**寸法と並び**が決まっているなら、領域の代わりに `band` で書ける。帯は読み込みの時点で通常の空間へ展開されるので、以降の手順 — ゾーンの親・境界・開口・確かめ方 — は何も変わらない。

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

全要素に寸法を書けば、合計が帯幅と一致することが読み込みの時点で照合される — 寸法の打ち間違いの検算になる。文法は [band](../reference/muro/band.md) にある。

## 次に

- [窓を開けて採光を通す](windows-and-daylight.md) — 割った室に窓を開ける
- [到達できない空間を見つける](find-unreachable.md) — 玄関から各室まで通れるか
- [基準階を一度だけ書く](typical-floors.md) — 同じ間取りが複数階に載るとき
