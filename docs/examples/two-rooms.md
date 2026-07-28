---
title: two-rooms — 記法の最小単位
mode: explanation
---

# two-rooms — 記法の最小単位

`examples/two-rooms.muro`。26行 / 空間3 / 境界3 / 屋内床面積 32.40㎡。室を二つ並べ、その間に扉を一枚、外へ出る扉を一枚、窓を三つ。**この記法の要素が一通り出そろう最小の場面**である。

![two-rooms L1](../img/two-rooms.svg)

## 初めて示すもの

- **[`space`](../reference/muro/space.md)** — パスが同一性、型が第2位置引数、領域が矩形の合併。
- **[`boundary`](../reference/muro/boundary.md)** — 壁は物ではなく**二つの空間の関係**であること。壁芯線分はどこにも書かれておらず、両室の矩形から導出される。
- **字下げの [`door`](../reference/muro/door.md) / [`window`](../reference/muro/window.md)** — 開口は壁 (境界) に属し、空間には属さない。
- **`/out`** — 外部も一つの空間である。領域を持たないので、外皮の境界は**明示的に書かれている**。
- **`edge:S`** — 外部への開口は辺を選ぶ必要がある。`/L1/b` の外周は3辺に分かれるためで、方位は X が東正・Y が北正 (N=+Y, S=-Y, E=+X, W=-X)。
- **`daylight:1`** — 採光判定の対象は型からは推定されない。書いた空間だけが `light` の母集団に入る。

## 全文

```muro
koyu 1.0
name 二室
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150

space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B daylight:1
space /out exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000

boundary /L1/a /out t:150 spec:EW1 fire:60
  window w:2600 h:1100 edge:S name:腰窓
boundary /L1/b /out t:150 spec:EW1 fire:60
  door w:900 h:2100 edge:S name:玄関
  window w:2600 h:1100 edge:E name:腰窓
```

**室と室のあいだの壁は「書かれている」ように見えて、実際に書かれているのは関係だけである。**`boundary /L1/a /L1/b` は「AとBが壁で接する」としか言っていない。線分の始点と終点は、二つの矩形が Y1..Y2 の区間で X2 の線上に重なるという事実から出る。壁厚 120 は芯から両側へ 60 ずつ振り分けられ、面積はどちらの室も壁芯で 3600×4500 = 16.20㎡ になる。

外皮の3本 (`boundary /L1/a /out` など) は書かなければならない。`/out` は領域を持たないので「接している」ことを幾何から導けないからである。逆に、もし `boundary /L1/a /L1/b` の行を消しても A と B のあいだには壁が立つ — 接する空間の既定は壁である。ただしその壁は扉を持たないので、**通れなくなる**。

## 投げる問い

### 外へ出るのに何枚の扉を通るか

居室Aには外部への扉が無いので、答えは居室Bを経由する。

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

### 隣接の全体はどうなっているか

「壁」と「扉1枚」の区別が、そのままグラフの辺の重みになる。

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 1 door → /L1/b  (spec:PW1)
  | wall → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 1 door → /L1/a  (spec:PW1)
  — 1 door → /out  (spec:EW1 fire:60)
/out (外部)
  | wall → /L1/a  (spec:EW1 fire:60)
  — 1 door → /L1/b  (spec:EW1 fire:60)
```

窓は辺に現れない。`window` は採光の器であって通行の口ではないからである。

### 面積はどう数えられるか

```sh
npx tsx src/cli.ts stats examples/two-rooms.muro
```

```text
L1
  /L1/a	居室A	room	16.20 m2
  /L1/b	居室B	room	16.20 m2
  Subtotal 32.40 m2
Total 32.40 m2 (indoor floor area)
  room: 32.40 m2
```

### 採光は足りているか

```sh
npx tsx src/cli.ts light examples/two-rooms.muro
```

```text
✔ /L1/a	居室A	window 2.86 m2 / floor 16.20 m2 = 1/5.7 (needs 1/7 ≈ 2.31 m2)
✔ /L1/b	居室B	window 2.86 m2 / floor 16.20 m2 = 1/5.7 (needs 1/7 ≈ 2.31 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

窓面積 2.86㎡ は 2600×1100 から出た。**原本のどこにも 2.86 とは書かれていない。**

## 次に読む

- 複数階と吹抜けが加わる — [office](office.md)
- 同じ場面を IFC4 / IFCX で書いた実測 — [koyu と IFC の実測比較](vs-ifc.md)
