---
title: 縦動線 — stair / ramp / escalator / lift
mode: reference
---

# 縦動線 — stair / ramp / escalator / lift

段数も踏面も踊り場も勾配も、`.muro` には書かれない。**書かれるのは領域と階高と「上る向き」だけで、形はそこから導かれる。**

宣言は空間の属性である。**キーが装置を名指し、値が上る向きを言う。**

```muro-part
space /L1/st  stair      X1..X2 Y1..Y2 name:階段 stair:N form:return turn:R
space /L1/rmp ramp       X2..X3 Y1..Y2 name:斜路 ramp:E slope:8
space /L1/es  escalator  X3..X4 Y1..Y2 name:エスカレーター escalator:N lane:1200
space /L1/ev  shaft      X4..X5 Y1..Y2 name:昇降機 lift:1
```

| キー | 値 |
|---|---|
| `stair:` | 上る向き `N` / `E` / `S` / `W` |
| `ramp:` | 上る向き `N` / `E` / `S` / `W` |
| `escalator:` | 上る向き `N` / `E` / `S` / `W` |
| `lift:` | `1` (昇降機に向きは無い) |

向きは `N` = +Y、`S` = −Y、`E` = +X、`W` = −X である。第二引数の型 (`stair` `ramp` `shaft` …) は集計のための語彙であって、形を決めるのは属性のキーの方である。

**一つの空間に宣言は一つだけである。**

```text
RUN01  More than one vertical circulation declaration: stair:N ramp:N (one space carries one)
```

## 形が決まる条件

宣言から形が一意に決まらなければ、`check` が止める。次の五つが揃っていなければならない。

1. 縦動線の宣言が**ちょうど一つ**
2. 値が向きとして読める (昇降機なら `1`)
3. 領域が**矩形一つ**である (`+` で合併した L 字は不可)
4. レベルが特定できる
5. 昇降機以外は、**上に次のレベルがある**

```text
RUN02  The value of stair is the direction it rises, N/E/S/W: stair:up
RUN02  The value of lift is 1: lift:2
RUN03  The region of vertical circulation is a single rectangle (a union leaves the step division undetermined): /L1/st
SUF04  No level sits above L3, so no form is generated for /L3/st
```

`SUF04` だけが警告で、残りはエラーである。**昇降機は上のレベルが無くても形を持つ** — かごはそのレベルの中で閉じる。

## form — 直と折返し

```text
form:straight   直進 (既定)
form:return     折返し
```

**折返せるのは階段と斜路だけである。**エスカレーターと昇降機に `form:return` を書けばエラーになる。曲線は無い — 螺旋は折返しの連続として書く。

```text
RUN05  form is straight / return: form:spiral (write a spiral as a succession of turns)
RUN05  form:return may not be written on escalator (only a stair and a ramp turn back)
```

`turn:` は折返しの回り方で、**`L` と書いたときだけ左**、未記入も他の値も右 (`R`) である。`turn:R` なら第一の走りが進行方向の左に来る。

## 乗り込みの帯

走りは領域の縁からは始まらない。**近端に乗り込みの帯が残り、そこが扉の開く場所になる。**縁から始めると階段室の扉が段板に直接ぶつかる。直進では遠端にも同じ帯が残る。

```text
form:straight   走りに使える長さ = 全長 − entry × 2
form:return     走りに使える長さ = 全長 − entry
```

`entry:` の既定は **1100mm**。この帯が全長を食い切ると形が決まらない。

```text
RUN05  The form of the vertical circulation is undetermined: /L1/s (check that the landing does not exceed the full length)
```

## 段割り

蹴上げの数は、階高を蹴上げの上限で割った切り上げ (最低2段)。踏面は、**走り一本**の長さをその走りの段の隙間の数で割った残りである。折返しでは走りが二本あって踏面も二つ出るので、代表するのは窮屈な方になる (後述の[集約値](#集約値))。

```text
段数   = max(2, ceil(上る高さ ÷ riser))
蹴上げ = 上る高さ ÷ 段数
踏面   = 走り一本の長さ ÷ max(1, その走りの段数 − 1)
  form:straight   走り一本 = 走りに使える長さ、その走りの段数 = 全段数
  form:return     走り一本 = 全長 − entry − 踊り場、段数は下の走りが k・上の走りが 段数 − k
```

`riser:` は**蹴上げの上限** mm で、既定は **180**。書けば段数が変わる。

折返しの中間踊り場は**残余として決まる**。走り長・踏面・踊り場は一つの式で結ばれていて、書けるのは高々二つである。設計者が握りたいのは踏面の快適さなので、既定では残余を踊り場へ寄せる — 目標踏面 `tread:` (既定 **300mm**) を先に取り、残りが踊り場になる。逆に `landing:` を書けば踏面が残余になる。導出値も書かれた値も、**最小奥行 1100mm** を下回れば 1100mm まで引き上げられる。

段の分割は `k = min(段数−1, max(1, round(段数÷2)))` で、踊り場の高さは FL + k×蹴上げ。round が半数を切り上げるので、**奇数段では下の走りが一段多い**。斜路の折返しは踊り場を高さのちょうど半分に置く。

導出の結果は `runs` が印字する。

```text
$ koyu runs core.muro
L1→L2	lift	昇降機	/L1/ev
L1→L2	stair	階段	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/st
L2→R	lift	昇降機	/L2/ev
L2→R	stair	階段	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L2/st
```

## 並列 — エスカレーター

エスカレーターだけが並列の台を持つ。一台の呼び幅は `lane:` (既定 **1200mm**)、台数は 幅 ÷ 呼び幅 の切り捨てで最低一台、一台の幅は呼び幅と 幅÷台数 の小さい方、余りは両端に等分される。

**台ごとに走る向きが交互になる** — 上りの隣は上から降りてくる一台である。

`lane:` は階段・斜路・昇降機では効かない。台数は常に一である。

```text
$ koyu runs examples/complex/main.muro
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
```

## 集約値

一つの走りが複数の区間に分かれるとき、代表する値の取り方は決まっている。

| 値 | 取り方 |
|---|---|
| 走りの水平長 (`going`) | **一台目だけ**を数える (折返しの二本はどちらも数える) |
| 踏面 | **最も窮屈な走り**が代表する |
| 勾配 | **最も急な走り**が代表する |

折返しの二本目は段数が多い分だけ細かい。一本目だけを見ると、窮屈な走りが検査をすり抜ける。

## 属性の一覧

| キー | 既定 | 何を決めるか |
|---|---|---|
| `stair:` `ramp:` `escalator:` | — | 装置と上る向き (`N`/`E`/`S`/`W`) |
| `lift:` | — | 昇降機 (値は `1`) |
| `form:` | `straight` | `straight` / `return`。折返せるのは階段と斜路だけ |
| `turn:` | `R` | 折返しの回り方。`L` と書いたときだけ左 |
| `entry:` | 1100 | 乗り込みの帯の奥行 mm |
| `landing:` | 導出 | 中間踊り場の奥行 mm (最小 1100) |
| `riser:` | 180 | 蹴上げの**上限** mm。段数を決める |
| `tread:` | 300 | 目標踏面 mm。折返しの踊り場を導くのに使う |
| `lane:` | 1200 | 一台の呼び幅 mm。エスカレーターだけが読む |
| `slope:` | — | 許容勾配の分母。**形には効かない** — 検証だけが読む閾値 |

`entry:` `landing:` `riser:` `tread:` `lane:` `slope:` はいずれも正の数でなければならない。

## トポロジーは別に書く

**縦動線の宣言は形を作るだけで、階を繋がない。**「どのレベルとどのレベルが通じているか」は垂直の境界が持つ — `stack` か、`boundary … type:stair` である。

```muro-part
space /L1..L2/st stair X1..X2 Y2..Y3 name:階段 stair:N form:return
stack st L1..L2 type:stair
```

**縦の通行可能性は `stair` の一語が引き受ける。**階段も斜路もエスカレーターもトポロジーは同じなので、境界の型は増やさない。装置の違いは空間側の宣言だけが持つ。昇降機のシャフトは `type:shaft` で、連続するが人は通れない。

形だけを書いて垂直の境界を落とすと、`check` は緑のまま通る。言うのは `koyu validate` である。

```text
⚠ [run.disconnected] nostack.muro:line 13: /L1/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
```

## 登りやすさは check の保証ではない

`check` が言うのは「宣言から形が一意に決まる」までである。**決まった形が登りやすいかは別の面が言う。**

| 判定 | いつ出るか |
|---|---|
| `stair.proportion` | 導出された踏面が 240mm 未満、または 2×蹴上げ+踏面 が 550〜700mm の外 |
| `run.slope` (斜路) | 導出された勾配が、書かれた `slope:` の 1/N より急 |
| `run.slope` (エスカレーター) | 導出された勾配が常用域 (およそ 1/1.7 = 30度) の外 |
| `run.disconnected` | 形はあるが、階を繋ぐ垂直の境界が無い |

```text
$ koyu validate a.muro
⚠ [stair.proportion] a.muro:line 12: Derived step dimensions are cramped: 24 risers of 175mm, tread 165mm (2*riser+tread = 515mm; expected 550-700mm)
⚠ [run.slope] a.muro:line 14: Derived slope 1/0.9 is steeper than the declared 1/12 (lengthen the run or lower the storey height)
⚠ [run.slope] a.muro:line 15: Derived slope 1/0.9 is outside the usual escalator range (about 1/1.7 = 30 degrees)
```

閾値は日本の慣行の粗い写しであり、凍っていない。**これらは判定であって、保証ではない。**

## 平面と立体に現れるもの

平面図は「そのレベルで FL から 1200mm の高さで切った断面」である。上る走りは切断面と部品の高さを比べて可視区間が決まり、下りる走りは同じ枠を共有する上りの走りが**隠した残り**に現れる。段鼻は可視区間の中だけに並び、切断線は走りの幅いっぱいを横切る一本の線分として出る。

矢印は、エスカレーターなら台ごとに、階段と斜路なら出発する走りと到着する走りに一本ずつ。向きは人の進む向きだけから決まり、**エスカレーターはどちらの面でも同じ向きを指し、階段と斜路は下りの面で反転する** — 機械の向きは固定で、人の向きは面で変わるからである。

立体では、階段の走りは蹴上げ k 段に対して段板 **k−1 枚** (最上段は上階の床が受ける)、斜路は傾いた版一枚、エスカレーターは**一台につき版一枚と欄干二枚**、昇降機のかごは**階高に依らず一定の高さ**の箱になる。欄干の寸法は [form/constants.md](../form/constants.md) にある。

## 通しの例

```muro
koyu 1.0
name 階段室のある小さなコア
unit mm

grid X 0 2800 5600 12000
grid Y 0 2000 8600

level L1 0 h:3600 slab:600
level L2 4200 h:3600 slab:600
level R  8400 slab:500

space /L1..L2/hall   hall   X1..X4 Y1..Y2 name:ホール use:common
space /L1..L2/st     stair  X1..X2 Y2..Y3 name:階段 use:common stair:N form:return turn:R
space /L1..L2/ev     shaft  X2..X3 Y2..Y3 name:昇降機 use:common lift:1
space /L1..L2/office office X3..X4 Y2..Y3 name:事務室 use:exclusive

space /out name:外部 outside:1

boundary /L1..L2/st /L1..L2/hall t:180 spec:RC
  door w:900 name:D1
boundary /L1..L2/ev /L1..L2/hall t:180 spec:RC
  door w:1100 name:D2
boundary /L1..L2/office /L1..L2/hall t:100 spec:LGS
  door w:900 name:D3

boundary /L2/hall /out edge:S t:200
boundary /L1..L2/hall /out edge:W t:200
boundary /L1..L2/hall /out edge:E t:200
boundary /L1..L2/st /out edge:W t:200
boundary /L1..L2/st /out edge:N t:200
boundary /L1..L2/ev /out edge:N t:200
boundary /L1..L2/office /out edge:N t:200
boundary /L1..L2/office /out edge:E t:200

boundary /L1/hall /out edge:S t:200
  door w:1800 name:E1

stack st L1..L2 type:stair
stack ev L1..L2 type:shaft
```

```text
$ koyu check core.muro
✔ Consistent — 9 spaces / 28 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ koyu validate core.muro
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

階段の領域は 2800 × 6600mm、上る高さは 4200mm。乗り込み 1100mm を引いた 5500mm から、目標踏面 300mm で踊り場 2200mm が残余として決まり、走り一本が 3300mm、蹴上げは 24 段で 175mm、踏面は 300mm になる。**その数字はどこにも書かれていない。**

## 関連

- [stack](stack.md) — 階を跨ぐ関係の一括宣言とスパン展開
- [space](space.md) — 空間の宣言、領域とパス
- [boundary](boundary.md) — 境界の型、水平と垂直
- [koyu check](../cli/check.md) — 形が一意に決まるかを見る門番
- [koyu validate](../cli/validate.md) — 登りやすさの判定
