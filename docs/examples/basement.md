---
title: basement — 縦動線の最小例
mode: explanation
---

# basement — 縦動線の最小例

`examples/basement/main.muro`。86行 / 1ファイル / 空間15 / 境界49 / 屋内床面積 1,242.08㎡。地下2層＋駐車場斜路。**建物ですらないものを書いて、縦動線の記法を決める**ための例である。二室一扉と同じ精神で、地下2層・駐車場・折返し斜路一本・階段・EV・地上への出口しか書かれていない。

![basement B1](../img/basement-B1.svg)

## 初めて示すもの

- **[縦動線](../reference/muro/vertical-circulation.md)は空間である。**斜路も階段も面積を持ち、通行でき、避難経路になる。接続だけにすると集計から落ちる。
- **段数も踏面も勾配も書かない。**書くのは「どこに・どれだけの大きさで・どちらへ上るか」だけで、あとは規則が形を出す。
- **`slope:` は上限の宣言であって値ではない。**実際の勾配はレベル差 ÷ 導出された走り長で決まり、宣言は検査に使われる。
- **螺旋は書かない。**折返し (`form:return`) の連続として書く。曲線は導入しない。
- **地下は宣言である。**`level B2 -7400 … underground:1`。z の負値からは推定しない。
- **土に接する壁は `spec` 語彙。**`spec:RC土圧壁`。境界の型は増やさない — 物の名は `spec` が運ぶ。
- **[`column`](../reference/muro/column.md)** — `column 800 B2..L1` の一行。柱の位置はどこにも書かれていない。

## 抜粋

レベルと柱。地下であることは属性で言う。

```muro-part
level B2 -7400 h:2600 slab:800 underground:1
level B1 -3700 h:2600 slab:800 underground:1
level L1 0 h:4000 slab:900
level R 4900 slab:500

column 800 B2..L1
```

地下2層の割付。同じ割付を `/B2..B1/` で一度だけ書く。

```muro-part
space /B2..B1/park parking X1..X3 Y1..Y3 name:駐車場 use:parking
space /B2..B1/ramp ramp X3..X5 Y1..Y2 name:車路 use:parking ramp:E form:return slope:6
space /B2..B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 use:common stair:N form:return
space /B2..B1/ev shaft X3+2600..X3+5200 Y2..Y2+5400 name:EV use:common lift:1
```

`ramp:E` は「東へ上る斜路」、`stair:N` は「北へ上る階段」、`lift:1` は「昇降機」。`form:return` は折返しである。**この四語が、この記法における縦動線の全部**である。

垂直の関係は3行。

```muro-part
stack ramp B2..L1 type:stair
stack st B2..L1 type:stair
stack ev B2..L1 type:shaft
```

斜路も階段も「レベル間を通れる」という一つの関係である。装置の違いは形の生成規則の違いにすぎないので、境界の型は `stair` を共有する。

外周は土である。境界の型を増やさずに `spec` 語彙で言う。

```muro-part
boundary /B2..B1/park /out edge:W t:500 spec:RC土圧壁
boundary /B2..B1/park /out edge:S t:500 spec:RC土圧壁
boundary /B2..B1/ramp /out edge:E t:500 spec:RC土圧壁
```

車路シャッターも、人の扉と同じ `door` である。違いは寸法とアセット名だけ。

```muro-part
asset VG1 door w:6000 h:3000 style:sliding name:車路シャッター
boundary /L1/ramp /road edge:E t:200 spec:RC
  door VG1 name:車路出入口
```

## 投げる問い

### 段数・踏面・勾配はいくつか

原本のどこにも書かれていない。[`runs`](../reference/cli/runs.md) が答える。

```sh
npx tsx src/cli.ts runs examples/basement/main.muro
```

```text
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B2/ramp
B2→B1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B2/st
B1→L1	lift	EV	/B1/ev
B1→L1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B1/ramp
B1→L1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B1/st
L1→R	lift	EV	/L1/ev
```

`21 risers of 176mm` はレベル差 3700mm を蹴上の常用域で割った結果であり、`slope 1/7.2` は 3700 ÷ 26800 である。走り長 26800mm は、折返しの斜路が幅 9000mm × 奥行 7000mm の空間に収まったときの実長として導出された。**書かれた三つの数 (レベルのz・空間の矩形・`form:return`) から、これらすべてが出る。**

`slope:6` は「1/6 より急にするな」という上限の宣言である。導出された 1/7.2 はそれより緩いので、[`validate`](../reference/cli/validate.md) は何も言わない。

### 駐車場から車は出られるか

```sh
npx tsx src/cli.ts doors examples/basement/main.muro /B2/park /out
```

```text
2 doors — /B2/park → /B2/ramp → /B1/ramp → /L1/ramp → /L1/st → /out
```

これは**人の**経路である。`/L1/ramp → /L1/st → /out` を通っていて、階段室の扉から外へ出ている。車が通れる幅の開口 (車路シャッター) は `/road` へ開いており、そちらへは別に辿る。車が出られなくなる書き方をすると `validate` の `access.parking` が捕まえる。

### 高さは収まっているか

```sh
npx tsx src/cli.ts levels examples/basement/main.muro
```

```text
R	z:4900	slab:500
L1	z:0	h:4000	slab:900
  ↑ storey height 4900 = ceiling 4000 + slab 500 + 400 left over
B1	z:-3700	h:2600	slab:800
  ↑ storey height 3700 = ceiling 2600 + slab 900 + 200 left over
B2	z:-7400	h:2600	slab:800
  ↑ storey height 3700 = ceiling 2600 + slab 800 + 300 left over
```

`left over` は余りである。**天井高 + 上階の床組み厚 ≤ 階高**という不変量は満たされていて、余った分は懐になる。破れば `check` がエラーで止める。

## 次に読む

- 同じ縦動線の語彙が19階建てで働く — [complex](complex.md)
- 柱・線・帯を一度に見る — [書きたいものから引く](by-pattern.md)
