---
title: RUN — 縦動線
mode: reference
---

# RUN — 縦動線

RUN は四つ生きている。RUN04・RUN06・RUN07・RUN08 は**欠番**である。

| コード | severity | 何を言うか |
|---|---|---|
| RUN01 | error | 一つの空間に縦動線の宣言が複数ある |
| RUN02 | error | 値が上る向きになっていない |
| RUN03 | error | 領域が矩形一つでない、またはレベルが特定できない |
| RUN04 | — | **欠番** |
| RUN05 | error | `form` の値が不正、または形が決まらない |
| RUN06 RUN07 RUN08 | — | **欠番** |

階段・斜路・エスカレーター・昇降機は「レベル間を通れる」という一つの関係の、装置の違いにすぎない。この記法は二つを分けて持つ。

- **トポロジー** — どのレベルとどのレベルが繋がるか。垂直境界 (`stack` / `boundary type:stair`) が持つ。
- **形** — 段割り・踊り場・勾配。空間の宣言から**導出される**。段数も踏面も勾配も書かない。

宣言は一行である。**鍵が装置を名指し、値が上る向きを言う。**

```muro-part
space /L1/s stair X1..X2 Y1..Y2 stair:N
```

鍵は `stair:` `ramp:` `escalator:` `lift:` の四つ。値は方位 (N=+Y, S=-Y, E=+X, W=-X) で、向きを持たない `lift:` だけは `1` と書く。

RUN が見るのは**宣言から形が一意に決まるか**だけである。決まった形が登りやすいかどうかは建築の側の判断で、`koyu validate` が別に言う。

**一つの空間から RUN が出す診断は高々一件である。**下の順に見て、一つ当たった時点でその空間の走査は終わる。

## RUN01 — 縦動線の宣言が複数あります

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N ramp:N
space /L2/s stair X1..X2 Y1..Y2
```

```text
More than one vertical circulation declaration: stair:N ramp:N (one space carries one)
```

**原因** — 四つの鍵は、装置ごとの**形の生成規則**を選ぶ宣言である。一つの空間が二つの規則で同時に形を持つことはできない。

**直し方** — 空間を分けて、それぞれに一つずつ書く。階段と斜路が同居する空間は、実際には二つの空間である。

## RUN02 — 値は上る向きです

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:up
space /L2/s stair X1..X2 Y1..Y2
```

```text
The value of stair is the direction it rises, N/E/S/W: stair:up
```

**原因** — 段割りを決めるには「どちらへ上るか」が要る。これは領域からは導けない唯一の情報なので、書かれなければならない。`up` `1` `north` はいずれも通らない。

`lift:` は別の本文になる。

```text
The value of lift is 1: lift:N
```

**直し方** — 方位一文字を書く (`stair:N`)。昇降機は `lift:1`。

## RUN03 — 領域は矩形一つです

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 + X2..X3 Y1..Y2 stair:N
space /L2/s stair X1..X3 Y1..Y2
```

```text
The region of vertical circulation is a single rectangle (a union leaves the step division undetermined): /L1/s
```

**原因** — 段割りは「走る向きの長さ」と「それに直交する幅」から決まる。L字やコの字の合併には、その二つが一意に無い。

**直し方** — 階段室を矩形一つで割り付ける。L字の階段室が要る場面は、多くは階段と踊り場ホールに分けるべき場面である。

RUN03 は同じコードで、あと二つの状態も言う。

```text
Vertical circulation requires a region: /L1/s
```

領域を一つも書いていない。

```text
The level of the vertical circulation cannot be determined: /house/s
```

レベルが決まらない。この場合は [SUF02](./suf.md) も同時に出る — 同じ空間の別の帰結である。

## RUN05 — form の値が不正です

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N form:spiral
space /L2/s stair X1..X2 Y1..Y2
```

```text
form is straight / return: form:spiral (write a spiral as a succession of turns)
```

**原因** — `form` は `straight` (直進) と `return` (折返し) の二つだけである。koyu は曲線を導入していないので、螺旋階段・螺旋斜路は「折返しの連続」として近似する。

RUN05 は同じコードで、あと二つの状態も言う。

```text
form:return may not be written on lift (only a stair and a ramp turn back)
```

折返すのは階段と斜路だけである。エスカレーターと昇降機に `form:return` は書けない。

```text
The form of the vertical circulation is undetermined: /L1/s (check that the landing does not exceed the full length)
```

書かれた値どうしが噛み合わず、形が出せない。`landing:` (中間踊り場の奥行) や `entry:` (乗り込みの床の奥行) が走り全体の長さを食い尽くしている、というのがほとんどである。

**直し方** — `form:return` にするか、複数のレベルに分けて折返しを積む。走りが足りなければ、階段室を長くするか、踊り場を短くする。

## 導出された形を読む

`koyu runs` が、導出された形をそのまま表で出す。

```muro
grid X 0 3000
grid Y 0 12000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
```

```sh
koyu runs ramp.muro
```

```text
L1→L2	ramp	r	rise 3000mm	straight	slope 1/3.3	going 9800mm	/L1/r
```

段数も勾配も書かれていないのに出ているのが、導出である。

## 欠番の四つ

**RUN04 は [SUF04](./suf.md) に合流した。**「上にレベルが無いので形が一つも生成されない」という話は、縦動線の問題ではなく充足性の問題だからである。コードは SUF に属するが、走査は RUN と同じ一周の中にあるので、診断は縦動線の宣言の順に出る。

**RUN06・RUN07・RUN08 は判定へ移った。**この三つは「導出された形が使えるか」を言っていた — それは建築の側の判断であって、書かれたものが成立しているかという話ではない。

| かつて | 今 | level |
|---|---|---|
| RUN06 (段が窮屈) | `stair.proportion` | caution |
| RUN07 (勾配が急) | `run.slope` | caution |
| RUN08 (形はあるが繋がっていない) | `run.disconnected` | caution |

番号は**再利用されない**。

```sh
koyu validate ramp.muro
```

```text
⚠ [run.disconnected] <absolute path>/ramp.muro:line 5: /L1/r has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [run.slope] <absolute path>/ramp.muro:line 5: Derived slope 1/3.3 is steeper than the declared 1/12 (lengthen the run or lower the storey height)
Validation — 0 violations / 2 cautions
```

上のファイルは `check` では緑である。**`slope:` は書く勾配ではなく、許容する勾配の上限**であって、判定のためだけに在る。`run.disconnected` は「図には階段が描かれるのに動線が通らない」という最も気付きにくい食い違いを言う — 形の宣言 (`ramp:N`) だけを書いて、トポロジーの宣言 (`stack` / `boundary type:stair`) を書き忘れた状態である。

段の窮屈さも同じ構えである。

```sh
koyu validate tight.muro
```

```text
⚠ [stair.proportion] <absolute path>/tight.muro:line 5: Derived step dimensions are cramped: 17 risers of 176mm, tread 13mm (2*riser+tread = 365mm; expected 550-700mm)
Validation — 0 violations / 1 caution
```

## 関連

- [SUF — 充足性](./suf.md) — SUF04 (上にレベルが無い) と SUF02 (レベルが決まらない)
- [VRT — 垂直境界](./vrt.md) — トポロジーの側の検査
- [VER — 言語の版](./ver.md) — 縦動線の宣言は 0.5 の語 (VER03)
- [koyu validate](../cli/validate.md) — `stair.proportion` / `run.slope` / `run.disconnected`
- [koyu check](../cli/check.md)
