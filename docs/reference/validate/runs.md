---
title: 縦動線 — stair.proportion / run.slope / run.disconnected
mode: reference
---

# 縦動線 — stair.proportion / run.slope / run.disconnected

| 規則 | level |
|---|---|
| [`stair.proportion`](#stair-proportion) | caution |
| [`run.slope`](#run-slope) | caution |
| [`run.disconnected`](#run-disconnected) | caution |

**段数も踏面も踊り場も勾配も書かない。**書くのは装置と上る向きだけ (`stair:N` `ramp:E` `escalator:S` `lift:N`) で、あとは領域と階高から導かれる。[`koyu check`](../cli/check.md) が保証するのは「宣言から形が一意に決まる」までである — **決まった形が登りやすいかは、この巻が言う。**

書かないものを検査する、という構えなので、検査の対象は「書かれた値」ではない。**導出された値である。**

```sh
koyu runs main.muro
```

```text
L1→L2	stair	s	rise 3000mm	straight	17 risers of 176mm, tread 150mm	going 2400mm	/L1/s
```

`lift` は段も勾配も持たないので、この章のどの規則も掛からない。

## `stair.proportion` — 導出された段が窮屈 {#stair-proportion}

`caution`

導出された踏面が 240mm 未満か、`2×蹴上 + 踏面` が 550〜700mm の外に出た。後者は歩幅則である。

```muro-warn
koyu 1.0
grid X 0 3000
grid Y 0 4600
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
⚠ [stair.proportion] main.muro:line 6: Derived step dimensions are cramped: 17 risers of 176mm, tread 150mm (2*riser+tread = 502mm; expected 550-700mm)
Validation — 0 violations / 1 caution
```

数はこう出る。上る高さは 3000mm、蹴上げの上限は既定 180mm なので蹴上げは 17段 (3000/17 = 176mm)。走る向きの奥行 4600mm から、両端の乗り込みの床 (既定 1100mm) を引いた 2400mm が走り長で、それを 16 の踏面で割ると 150mm。**階段室が浅すぎる。**

蹴上げの上限は `riser:`、乗り込みの床は `entry:`、中間踊り場は `landing:` で書き換えられる。

折返し (`form:return`) では走りごとに踏面が違う。検査は**最も窮屈な走り**を見るので、表示される踏面もその走りの値である。

**直し方は三つある。**どれも導出の入力を変える。

```muro
koyu 1.0
grid X 0 3000
grid Y 0 7000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

走る向きに深くした (4600 → 7000mm)。走り長 4800mm ÷ 16 = 踏面 300mm、`2×176 + 300 = 652mm` で歩幅則の中に入る。

浅いままでも `form:return` で折り返せば走り長が倍になり、同じ 300mm に届く。

```muro
koyu 1.0
grid X 0 3000
grid Y 0 4600
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N form:return
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

三つ目は `riser:` を上げて段数を減らすこと。**これは寸法の警告であって、法適合の判定ではない。**

## `run.slope` — 導出された勾配が急すぎる/常用域の外 {#run-slope}

`caution`

斜路とエスカレーターで意味が違う。同じ規則名なのは、どちらも「導出された勾配が受け入れられる幅の外に出た」という一つの事実だからである。

### 斜路 — 宣言した上限より急な勾配

`slope:` は**書く勾配ではない。許容する勾配の上限**であり、この検査のためだけに存在する。`slope:12` は「1/12 より急にはしない」という宣言である。

```muro-warn
koyu 1.0
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
stack r L1..L2 type:stair
```

```text
⚠ [run.slope] main.muro:line 6: Derived slope 1/1.3 is steeper than the declared 1/12 (lengthen the run or lower the storey height)
Validation — 0 violations / 1 caution
```

上る高さ 3000mm に対して走り長は 3800mm しかない (6000mm から乗り込みの床 1100mm×2 を引いた値) ので、勾配は 1/1.3。1/12 の要求からは一桁違う。

`slope:` を書かない斜路には、この検査は掛からない。**上限を宣言していない斜路について、koyu が代わりに上限を決めることはしない。**

**直し方** — 斜路の領域を走る向きに伸ばす、`form:return` で折り返して走り長を倍にする、または階高を下げる。1/12 を実際に成立させるには、上の例では走る向きに 40000mm 必要になる (走り長 37800mm で 1/12.6)。**斜路は長い。**数字がそれを言う。

### エスカレーター — 常用域の外

エスカレーターには `slope:` を書かなくても、導出された勾配が 1/2.3 〜 1/1.4 (約1/1.7 = 30度を中心とした幅) から外れれば同じ規則が出る。

```muro-warn
koyu 1.0
grid X 0 1200
grid Y 0 12000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/e room X1..X2 Y1..Y2 escalator:N
space /L2/e room X1..X2 Y1..Y2
stack e L1..L2 type:stair
```

```text
⚠ [run.slope] main.muro:line 6: Derived slope 1/3.3 is outside the usual escalator range (about 1/1.7 = 30 degrees)
Validation — 0 violations / 1 caution
```

これは**緩すぎる**側の例である。領域が長すぎて、実在しない寝たエスカレーターが導かれている。同じ領域を 7200mm にすると走り長 5000mm で勾配 1/1.7 になり、判定は通る。

## `run.disconnected` — 上下を繋ぐ垂直境界が無い {#run-disconnected}

`caution`

**形とトポロジーは別々に書かれる。**`stair:N` は段の形を作るが、階と階が繋がっているとは言っていない。繋ぐのは `stack` か `boundary type:stair` である。

```muro-warn
koyu 1.0
grid X 0 3000
grid Y 0 7000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
```

```text
⚠ [run.disconnected] main.muro:line 6: /L1/s has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
Validation — 0 violations / 1 caution
```

垂直境界が無ければ、[`koyu doors`](../cli/doors.md) は上階へ抜ける経路を見つけない。**図には階段が描かれるのに動線が通らない**という、最も気付きにくい食い違いである。だから caution にしてある。

検査は素朴である — その空間が `type:stair` か `type:shaft` の境界の端になっているかを見るだけで、繋ぎ先が正しい階かどうかまでは問わない。

**直し方** — `stack s L1..L2 type:stair` を書く。逆に「形は要らないが繋がっている」場合 (昇降機のシャフトなど) は、縦動線の宣言のほうを外して垂直境界だけを残す。

## 関連

- [`koyu runs`](../cli/runs.md) — 装置・上る高さ・段数・踏面・勾配・走り長の一覧
- [到達](access.md) — 縦動線が客動線から孤立していないかは `access.backofhouse` が言う
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
