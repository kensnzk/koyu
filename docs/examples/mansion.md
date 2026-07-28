---
title: mansion — 基準階を一度だけ書く
mode: explanation
---

# mansion — 基準階を一度だけ書く

`examples/mansion.muro`。192行 / 空間122 / 境界332 / 屋内床面積 2,366.40㎡ / 半屋外 162.16㎡。10階建て43戸の内廊下型集合住宅。**122の空間が192行で書けている**のは、基準階を一度しか書いていないからである。

![mansion L1](../img/mansion-L1.svg)

![mansion L5](../img/mansion-L5.svg)

![mansion L10](../img/mansion-L10.svg)

## 初めて示すもの

- **レベルの範囲宣言** — `level L3..L9 6700 pitch:2900 h:2400 slab:500`。等差の7レベルが1行。
- **パスのスパン展開** — 先頭セグメントが `L2..L9` なら、宣言済みレベルの z 順に展開される。`space` も `zone` も `boundary` も展開され、**字下げの扉も展開先すべてに付く**。
- **[`stack`](../reference/muro/stack.md)** — `stack ev L1..L10 type:shaft` が連続レベル対に垂直境界を一括で張る。EV9本・階段9本が2行。
- **粒度の混在** — A タイプだけ間取りまで割り、B〜E は住戸のまま。`zone /L2..L9/A` が専有面積の言葉を保つので、割った住戸も割らない住戸も同じ土俵で数えられる。
- **バルコニー越しの採光** — バルコニーの上に空間があれば係数 0.7、無ければ 1.0。**同じ一行から、階ごとに違う答えが出る。**
- **屋外階段** — `spec:手すり air:1` の境界だけで半屋外になり、階段室が屋内床面積から別掲へ移る。
- **開口の分解** — 掃き出しサッシを引違い部 (`door`) と FIX 部 (`window`) に分けて書く。開口は通行か採光のどちらかで、一つが両方を担うとは言わない。

## 抜粋

基準階8フロアぶんの記述はここから始まる。`/L2..L9/` が8回展開される。

```muro-part
zone /L2..L9/A name:Aタイプ use:exclusive
space /L2..L9/A/ldk     ldk     X1+2600..X2 Y1..Y2-1800 + X1..X1+2600 Y1..Y1+1400 name:LDK
space /L2..L9/A/bedroom bedroom X1..X1+2600 Y1+1400..Y2-1800 name:洋室
space /L2..L9/A/balcony balcony X1..X2 Y1-1400..Y1 name:バルコニー
space /L2..L9/B unit X2..X3 Y1..Y2               name:Bタイプ use:exclusive
```

垂直は最後の2行だけである。

```muro-part
stack ev L1..L10 type:shaft
stack stair L1..L10 type:stair
```

`stack ev L1..L10 type:shaft` は「L1↔L2, L2↔L3, …, L9↔L10 の9対すべてに、`/L?/ev` 同士を結ぶ `shaft` の境界を張れ」と読まれる。屋外階段も同様に9対。**2行で18本の垂直境界が立つ。**

バルコニーへの開口は、通行と採光を別々に書く。

```muro-part
boundary /L2..L9/A/ldk /L2..L9/A/balcony t:180 spec:EW fire:60
  door w:1200 h:2200 at:X1+1400 name:掃き出し引違い
  window w:2600 h:2200 sill:0 at:X1+4000 name:掃き出し窓
boundary /L2..L9/A/balcony /out t:120 spec:手すり air:1 h:1100
```

最後の一行 (`spec:手すり air:1`) がバルコニーを半屋外にする。手すりは物としてそこにあるが、外気も光も遮らない。

## 投げる問い

### 5階のLDKから外へ、扉は何枚か

屋外階段は `type:stair` で通行可、しかも扉を持たないので、何階分を降りても扉は増えない。

```sh
npx tsx src/cli.ts doors examples/mansion.muro /L5/A/ldk /out
```

```text
3 doors — /L5/A/ldk → /L5/A/hall → /L5/corridor → /L5/stair → /L4/stair → /L3/stair → /L2/stair → /L1/stair → /out
```

経路は8つの空間を通るが、扉は3枚である。

### 同じ一行の窓が、階によって違う答えを出すか

出す。基準階の窓は一度しか書かれていないが、判定は展開後の全51室に対して出る。

```sh
npx tsx src/cli.ts light examples/mansion.muro
```

```text
✔ /L2/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L3/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L4/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L5/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L6/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L7/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L8/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3 (needs 1/7 ≈ 2.44 m2)
✔ /L9/A/ldk	LDK	window 5.72 m2 / floor 17.08 m2 = 1/3.0 (needs 1/7 ≈ 2.44 m2)
```

(上は A タイプの LDK の8行だけを抜いたもの。全体は52行で、末尾に `✔ Every room meets 1/7 — 51 rooms in scope` が出る。)

掃き出し窓は 2.6×2.2 = 5.72㎡ である。2〜8階では 4.00㎡ に減っていて、9階だけ 5.72㎡ のまま。**9階のバルコニーの上に何も無いからである。**屋根を書く場所はどこにも無く、「上に何が重なっているか」は上階の空間の並びから読まれる。

### 割った住戸と割らない住戸を、同じ土俵で数えられるか

数えられる。ゾーンが「一戸」の言葉を保つ。

```sh
npx tsx src/cli.ts stats examples/mansion.muro
```

```text
By zone (counted aggregation):
  /L2/A	Aタイプ	34.80 m2
  /L3/A	Aタイプ	34.80 m2
  /L4/A	Aタイプ	34.80 m2
  /L5/A	Aタイプ	34.80 m2
  /L6/A	Aタイプ	34.80 m2
  /L7/A	Aタイプ	34.80 m2
  /L8/A	Aタイプ	34.80 m2
  /L9/A	Aタイプ	34.80 m2
```

A タイプは LDK・洋室・水回り・玄関の4空間に割れているが、ゾーンとして 34.80㎡ の一戸である。B〜E は割っていないので空間そのものが一戸になる。集計の側からは区別が要らない。

末尾の総計はこうなる。

```text
Total 2366.40 m2 (indoor floor area)
Semi-outdoor 162.16 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By use: common 662.40 m2 (28.0%) / exclusive 1704.00 m2 (72.0%)
```

半屋外 162.16㎡ はバルコニーと屋外階段である。**算入するかどうかは制度の細部の話なので、合計には混ぜず別掲する。**

## 次に読む

- 敷地形状と例外階の差分レイヤー — [tower](tower.md)
- 縦動線を書く — [basement](basement.md)
