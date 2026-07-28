---
title: office — 複数階と吹抜け
mode: explanation
---

# office — 複数階と吹抜け

`examples/office.muro`。110行 / 空間17 / 境界43 / 屋内床面積 419.84㎡。2フロア＋屋上レベルの小さなオフィス。基本計画の解像度で書かれていて、垂れ壁も建具詳細も表現しない — **省略ではなく抽象度の選択**である。

![office L1](../img/office-L1.svg)

![office L2](../img/office-L2.svg)

## 初めて示すもの

- **複数[レベル](../reference/muro/level.md)** — `level L1` `level L2` と、空間を持たない `level R`。屋上レベルは L2 の高さ検査に上限を与えるためだけに宣言されている。
- **吹抜け** — `space /L2/void void …` と、垂直の `boundary /L1/hall /L2/void type:void`。**床の不在も境界で書く。**
- **垂直境界** — `type:stair` (通行可) と `type:shaft` (連続するが通行不可)。床は書かない。書くのは例外だけ。
- **`type:open`** — 何も無い境界。常に通行可能。
- **`air:1`** — 物はあるが外気と光を遮らないもの (吹抜けに面する腰壁＋手すり)。
- **[数えない分節](../reference/muro/area.md)** — 字下げの `area` (床材の切替) と [`seg`](../reference/muro/seg.md) (壁材の切替)。どちらも面積・室数・グラフに現れない。
- **空間ごとの天井高** — `h:6700` でホールだけ2層分。`levels` が個別天井高として別掲する。
- **開口の比率位置** — `at:0.8` `at:0.25`。0..1 の比率で線分内にクランプされる。

## 抜粋

垂直方向の書き方はこの3行しかない。残りの床はすべて既定である。

```muro-part
boundary /L1/stair /L2/stair type:stair
boundary /L1/ev /L2/ev type:shaft
boundary /L1/hall /L2/void type:void
```

`stair` は「上下に繋がっていて、しかも人が通れる」。`shaft` は「上下に繋がっているが人は通れない」。`void` は「床が無い」。この三語だけで、階段室・EVシャフト・2層吹抜けが書き分けられる。

数えない分節は、室を割らずに材料だけを変える。

```muro-part
space /L1/hall     hall     X1..X2 Y1..Y2       name:エントランスホール use:common floor:フローリング h:6700
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
space /L1/office   office   X2..X4 Y1..Y2       name:事務室 use:rentable
boundary /L1/office /L1/corridor t:120 spec:LGS
  door w:900
  seg at:0.75 w:3600 spec:ガラスパーティション
```

`area` を足してもホールの面積は 40.96㎡ のまま、室数も1のままである。`seg` を足しても境界は一本のままで、グラフの辺も増えない。**割ることと、数えることは別である。**

## 投げる問い

### 2階の執務室から外へ、扉は何枚か

EVはシャフト (通行不可) なので、経路は階段室を通る。

```sh
npx tsx src/cli.ts doors examples/office.muro /L2/office /out
```

```text
4 doors — /L2/office → /L2/corridor → /L2/stair → /L1/stair → /L1/corridor → /L1/hall → /out
```

`/L2/stair → /L1/stair` は階段の垂直境界で、`type:stair` は常に通行可なので扉を増やさない。

### 高さはどう積み上がるか

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ storey height 4000 = ceiling 2700 + slab 1300
L1	z:0	h:2700	slab:600
  ↑ storey height 4000 = ceiling 2700 + slab 1300
Per-space ceiling height: /L1/hall h:6700
```

各レベルの下に出る一行が矩計である。**天井高 + 上階の床組み厚 ≤ 階高**という不変量を `check` が全レベルで検算していて、ここでは 2700 + 1300 = 4000 でぴったり収まっている。`h:6700` のホールだけが個別天井高として最後に別掲される。

### 吹抜けは床面積に入るか

入らない。

```sh
npx tsx src/cli.ts stats examples/office.muro
```

```text
L1
  /L1/hall	エントランスホール	hall	40.96 m2
  /L1/office	事務室	office	81.92 m2
  /L1/corridor	廊下	corridor	30.72 m2
  /L1/stair	階段室	stair	12.80 m2
  /L1/ev	EV	ev	12.80 m2
  /L1/wc-m	男子WC	wc	12.00 m2
  /L1/wc-w	女子WC	wc	13.60 m2
  /L1/machine	機械室	machine	25.60 m2
  Subtotal 230.40 m2
L2
  /L2/void	エントランス吹抜け	void (not counted as floor area)
  /L2/office	執務室	office	102.40 m2
  /L2/corridor	廊下	corridor	10.24 m2
  /L2/stair	階段室	stair	12.80 m2
  /L2/ev	EV	ev	12.80 m2
  /L2/wc-m	男子WC	wc	12.00 m2
  /L2/wc-w	女子WC	wc	13.60 m2
  /L2/machine	倉庫	machine	25.60 m2
  Subtotal 189.44 m2
Total 419.84 m2 (indoor floor area)
  hall: 40.96 m2
  office: 184.32 m2
  corridor: 40.96 m2
  stair: 25.60 m2
  ev: 25.60 m2
  wc: 51.20 m2
  machine: 51.20 m2
By use: common 235.52 m2 (56.1%) / rentable 184.32 m2 (43.9%)
```

`void` の行だけが `(not counted as floor area)` になる。レンタブル比 43.9% は `use:` の集計から出た数字で、どこにも書かれていない。

## 次に読む

- 敷地・外構・半屋外が加わる — [house](house.md)
- 基準階を一度だけ書く — [mansion](mansion.md)
