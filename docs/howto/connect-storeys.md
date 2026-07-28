---
title: 階をつなぐ (階段・シャフト・吹抜け)
mode: howto
---

# 階をつなぐ (階段・シャフト・吹抜け)

上下に重なる空間のあいだに、階段・エレベーターシャフト・吹抜けを書く。段数も踏面も勾配も書かず、形は導出させる。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 垂直の既定は床である

平面が重なる二つの空間のあいだには、書かなくても**床**がある。これが既定なので、床を書く必要はない。**書くのは例外のほうだけ**で、例外は三つしかない。

| 型 | 通れるか | 床 | 使うもの |
|---|---|---|---|
| `stair` | 通れる (扉0枚) | 無い | 階段・斜路・エスカレーター |
| `shaft` | 通れない | 無い | EVシャフト・DS・PS |
| `void` | 通れない | 無い | 吹抜け |

**通行のトポロジーは `stair` の一語が引き受ける。**階段も斜路もエスカレーターも「レベル間を通れる」という同じ関係であり、装置の違いは境界ではなく空間の側が言う。三つの型の意味は [stack](../reference/muro/stack.md) にまとまっている。

## 1. 上下に同じ位置の空間を置く

垂直の関係は、二つの空間のあいだの関係である。**両端の空間が要る。**階段室なら各階に階段室の空間を、シャフトなら各階にシャフトの空間を置く。

```muro-part
space /L1..L3/st stair X2..X3 Y1..Y2 name:階段室 use:common stair:N form:return
space /L1..L3/ev shaft X3..X4 Y1..Y2 name:EV     use:common lift:1
```

パスの先頭を `L1..L3` のスパンで書けば、宣言済みレベルの z 順に展開される。書き方の詳細は [基準階を一度だけ書く](typical-floors.md) にある。

**縦動線は空間である。**面積を持ち、通行でき、避難経路になる。境界だけにすると集計から落ちる。

## 2. 形は宣言せず、生成規則を選ぶ

段数・蹴上・踏面・勾配は**どこにも書かない。**書くのは「どこに・どれだけの大きさで・どちらへ上るか」だけで、レベル差と導出された走り長から形が出る。

| 属性 | 意味 |
|---|---|
| `stair:N/E/S/W` | 階段。上る向き (N=+Y, S=−Y, E=+X, W=−X) |
| `ramp:N/E/S/W` | 斜路 |
| `escalator:N/E/S/W` | エスカレーター |
| `lift:1` | エレベーター (走りを持たない) |
| `form:return` / `form:straight` | 折返しか直進か |
| `slope:` | 勾配の**上限**の宣言。検査に使われる |

螺旋階段は書かない — 折返し (`form:return`) の連続として書く。属性の一覧は [縦動線](../reference/muro/vertical-circulation.md) にある。

## 3. 垂直境界を張る

二層だけなら `boundary` を一本書く。

```muro-part
boundary /L1/hall /L2/hall type:stair
```

**階数が多いなら `stack` で一度に書く。**`stack <末尾のセグメント> <レベル範囲> type:` は、連続するレベル対ごとに垂直境界を一本ずつ張るのと同じである。

```muro-part
stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

`stack ev L1..L3 type:shaft` は次の二行に等しい。

```muro-part
boundary /L1/ev /L2/ev type:shaft
boundary /L2/ev /L3/ev type:shaft
```

階を跨ぐ関係はどの階の層にも属さない。複数ファイルに割っているなら base層に置く。

## 確かめる

```muro
koyu 1.0
name 階をつなぐ稽古
unit mm

grid X 0 8400 11200 14000
grid Y 0 5600 8400

level L1 0 h:2800 slab:1400
level L2 4200 h:2800 slab:1400
level L3 8400 h:2800 slab:1400
level R 12600 slab:600

space /out exterior name:外部

space /L1..L3/st   stair X2..X3 Y1..Y2 name:階段室 use:common stair:N form:return
space /L1..L3/ev   shaft X3..X4 Y1..Y2 name:EV use:common lift:1
space /L1..L3/hall hall  X2..X4 Y2..Y3 name:乗場ホール use:common

space /L1/lobby     hall X1..X2 Y1..Y3 name:エントランス use:common
space /L2..L3/office room X1..X2 Y1..Y3 name:貸室 use:exclusive

boundary /L1..L3/hall /L1..L3/st t:200 spec:RC
  door w:900 name:階段防火戸
boundary /L1..L3/hall /L1..L3/ev t:200 spec:RC
boundary /L1..L3/st /L1..L3/ev t:200 spec:RC

boundary /L1/lobby /L1/st t:200 spec:RC
boundary /L1/lobby /L1/hall type:open
boundary /L1/lobby /out edge:W t:200 spec:CW
  door w:1800 name:正面出入口
boundary /L1/lobby /out edge:N t:200 spec:CW
boundary /L1/lobby /out edge:S t:200 spec:CW

boundary /L2..L3/office /L2..L3/st t:200 spec:RC
boundary /L2..L3/office /L2..L3/hall t:200 spec:RC
  door w:1600 name:貸室入口
boundary /L2..L3/office /out edge:W t:200 spec:CW
boundary /L2..L3/office /out edge:N t:200 spec:CW
boundary /L2..L3/office /out edge:S t:200 spec:CW

boundary /L1..L3/st /out edge:S t:200 spec:RC
boundary /L1..L3/ev /out edge:S t:200 spec:RC
boundary /L1..L3/ev /out edge:E t:200 spec:RC
boundary /L1..L3/hall /out edge:N t:200 spec:RC
boundary /L1..L3/hall /out edge:E t:200 spec:RC

stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

```text
$ npx tsx src/cli.ts check vert.muro
✔ Consistent — 13 spaces / 43 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

[`koyu runs`](../reference/cli/runs.md) が、書かなかった形を答える。段数も踏面も原本のどこにも無い。

```text
$ npx tsx src/cli.ts runs vert.muro
L1→L2	lift	EV	/L1/ev
L1→L2	stair	階段室	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/st
L2→L3	lift	EV	/L2/ev
L2→L3	stair	階段室	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L2/st
L3→R	lift	EV	/L3/ev
L3→R	stair	階段室	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L3/st
```

階段は通行の辺になり、扉を増やさない。3階の貸室から外までの4枚は、貸室入口・階段防火戸 (3階)・階段防火戸 (1階)・正面出入口である — 2層降りるあいだ扉は1枚も増えない。

```text
$ npx tsx src/cli.ts doors vert.muro /L3/office /out
4 doors — /L3/office → /L3/hall → /L3/st → /L2/st → /L1/st → /L1/hall → /L1/lobby → /out
```

シャフトは通れない。連続していても通行路ではない。

```text
$ npx tsx src/cli.ts doors vert.muro /L1/ev /L2/ev
Cannot reach /L2/ev from /L1/ev
```

## 吹抜けを書く

下階の天井が抜けているところには、**上階側に `void` 型の空間を置き**、下階の空間との間に `type:void` の垂直境界を書く。

```muro-part
space /L2/void void X2..X3 Y1..Y2 name:リビング上部

boundary /L1/ldk /L2/void type:void
```

`void` は床面積に算入されない。[`koyu stats`](../reference/cli/stats.md) がそう言う。

```text
L2
  /L2/bed	主寝室	bedroom	26.50 m2
  /L2/hall	2階ホール	hall	13.25 m2
  /L2/void	リビング上部	void (not counted as floor area)
  Subtotal 39.75 m2
```

通行もできない。[`koyu graph`](../reference/cli/graph.md) の `↕ void` は辺に見えるが、渡れない辺である。

```text
/L2/void (リビング上部)
  ↕ void → /L1/ldk
  | wall → /L2/bed
  | wall → /L2/hall
```

```text
$ npx tsx src/cli.ts doors two.muro /L1/ldk /L2/void
Cannot reach /L2/void from /L1/ldk
```

## 落ちるところ

### 形はあるのに繋がっていない — run.disconnected (caution)

`stair:` や `form:` を書いたのに `stack` も垂直境界も書いていないと、階段の形は導出されるのに通行のグラフは切れたままになる。`check` は緑を返す。捕まえるのは [`koyu validate`](../reference/cli/validate.md) である。

```text
⚠ [run.disconnected] vert-nostack.muro:line 15: /L1/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [run.disconnected] vert-nostack.muro:line 15: /L2/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [run.disconnected] vert-nostack.muro:line 15: /L3/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
```

### 段が窮屈になる — stair.proportion (caution)

階段室が短すぎると、同じ段数を短い走りに詰め込むので踏面が痩せる。上の例の階段室の奥行を 8400 から 4000 に縮めると、

```text
$ npx tsx src/cli.ts runs vert-cramped.muro
L1→L2	lift	EV	/L1/ev
L1→L2	stair	階段室	rise 4200mm	return	24 risers of 175mm, tread 164mm	going 3600mm	/L1/st
```

```text
⚠ [stair.proportion] vert-cramped.muro:line 15: Derived step dimensions are cramped: 24 risers of 175mm, tread 164mm (2*riser+tread = 514mm; expected 550-700mm)
```

**直すのは階段の寸法ではなく、階段室の大きさである。**階高から必要な走り長を先に決める手順は [書く前に寸法を決める](choose-dimensions.md) にある。

### シャフトを通って避難させてしまう

`doors` が「到達できません」を返す原因のうち、最も気づきにくいのが `shaft` と `void` である。エレベーターシャフトは全階を貫いていても通行路ではない。避難経路は必ず `stair` を通す。

## 次に

- [到達できない空間を見つける](find-unreachable.md) — つないだつもりの経路を機械的に検査する
- [基準階を一度だけ書く](typical-floors.md) — 同じコアが何層も続くとき
- [書く前に寸法を決める](choose-dimensions.md) — 階段室・シャフトの実寸
