---
title: 到達できない空間を見つけて開ける
mode: howto
---

# 到達できない空間を見つけて開ける

閉じ込められた空間を機械的に洗い出し、通れる経路を書き足す。

**`check` はこの問いを持たない。**`check` が見るのは書かれたものがデータとして矛盾していないかだけで、建物が使えるかどうかは見ない。**扉を一枚も書かない建物は `check` 緑のまま完全に密閉されている。**捕まえるのは [`koyu validate`](../reference/cli/validate.md) と [`koyu doors`](../reference/cli/doors.md) であり、編集のたびに `check` と並べて走らせる検査である。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## なぜ密閉されるのか

接する空間のあいだには、宣言が無ければ**扉のない壁**が導かれる。これが既定であり、既定のままの壁は通れない。部屋を足すという行為は、それだけでは何にもつながらない。

## 1. 全体を掃く — validate

`validate` が、外部へ辿り着けない室を**すべて**列挙する。起点を自分で挙げる必要は無い。

```muro
koyu 1.0
name 閉じた家
unit mm

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /out exterior name:外部

space /L1/ldk  ldk     X1..X2 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y1..Y2 name:玄関
space /L2/bed  bedroom X1..X2 Y1..Y2 name:寝室
space /L2/hall hall    X2..X3 Y1..Y2 name:2階ホール

boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:玄関扉
boundary /L1/ldk /out edge:W t:150 spec:EW
boundary /L2/bed /out edge:W t:150 spec:EW
boundary /L2/hall /out edge:E t:150 spec:EW

boundary /L1/hall /L2/hall type:stair
```

```text
$ npx tsx src/cli.ts check house.muro
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

境界を5本しか書いていないのに7本ある。差の2本が、接する室のあいだに導かれた既定の壁である。`check` は緑である。

```text
$ npx tsx src/cli.ts validate house.muro
⚠ [envelope.gap] house.muro:line 13: Perimeter not faced by any envelope: /L1/ldk — S 3600mm / N 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
⚠ [envelope.gap] house.muro:line 14: Perimeter not faced by any envelope: /L1/hall — S 1800mm / N 1800mm (3600mm over 2 run(s)). Write a boundary to the exterior
⚠ [envelope.gap] house.muro:line 15: Perimeter not faced by any envelope: /L2/bed — S 3600mm / N 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
⚠ [envelope.gap] house.muro:line 16: Perimeter not faced by any envelope: /L2/hall — S 1800mm / N 1800mm (3600mm over 2 run(s)). Write a boundary to the exterior
✖ [access.unreachable] house.muro:line 13: Cannot reach the exterior: /L1/ldk (no passable boundary leads out — write a door)
✖ [access.unreachable] house.muro:line 15: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
Validation — 2 violations / 4 cautions
```

`access.unreachable` が違反 (violation) で、これが閉じ込めである。**`validate` の終了コードは violation があるときだけ 1 になる** — CI で避難経路を守るならこの一本でよい。ついでに `envelope.gap` が、何にも面していない外周も教えている。判定の一覧は [判定リファレンス](../reference/validate/index.md) にある。

## 2. 一本の経路を数える — doors

起点と終点を決めて数えるなら `doors` を使う。最少扉数と経路が出る。

```text
$ npx tsx src/cli.ts doors house.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

終了コードは1。緑の建物の寝室から外に出られない。

## 3. どの辺が壁なのかを見る — graph

[`koyu graph`](../reference/cli/graph.md) は空間ごとの隣接を、境界の種別つきで並べる。

```text
$ npx tsx src/cli.ts graph house.muro
/out (外部)
  — 1 door → /L1/hall  (spec:EW)
  | wall → /L1/ldk  (spec:EW)
  | wall → /L2/bed  (spec:EW)
  | wall → /L2/hall  (spec:EW)
/L1/ldk (LDK)
  | wall → /out  (spec:EW)
  | wall → /L1/hall
/L1/hall (玄関)
  — 1 door → /out  (spec:EW)
  ↕ stair → /L2/hall
  | wall → /L1/ldk
/L2/bed (寝室)
  | wall → /out  (spec:EW)
  | wall → /L2/hall
/L2/hall (2階ホール)
  | wall → /out  (spec:EW)
  ↕ stair → /L1/hall
  | wall → /L2/bed
```

`| wall` は扉のない壁で、通れない。**`spec:` が付いていない `| wall` の行が、書いていないのに導かれた既定の壁である** — `/L1/ldk` ↔ `/L1/hall` と `/L2/bed` ↔ `/L2/hall` がそれで、寝室からホールへも、LDKから玄関へも出られない。

## 4. 通れない境界に扉を書く

既定の壁に扉を足すには、その組の境界を宣言して字下げで `door` を置く。**宣言した時点で既定の導出は止まり、書いた境界がその組の境界になる。**

```muro-part
boundary /L1/ldk /L1/hall t:120 spec:LGS
  door w:800
boundary /L2/bed /L2/hall t:120 spec:LGS
  door w:800
```

```text
$ npx tsx src/cli.ts doors house.muro /L2/bed /out
2 doors — /L2/bed → /L2/hall → /L1/hall → /out

$ npx tsx src/cli.ts validate house.muro
Validation — 0 violations / 4 cautions
```

違反は消えた。残る4件は外皮の穴 (caution) である。

## 辺になる境界

`doors` と `access.unreachable` が使うグラフの辺は、境界の型だけで決まる。

| 境界 | 通れるか | 数える扉 |
|---|---|---|
| `wall` (既定・扉なし) | 通れない | — |
| `wall` + `door` | 通れる | 1枚 |
| `open` | 常に通れる | 0枚 |
| `stair` (垂直) | 常に通れる | 0枚 |
| `shaft` (垂直) | 通れない | — |
| `void` (垂直) | 通れない | — |

**`air:1` は遮蔽の話であって通行の話ではない。**手すり・柵・塀は外気を通すが人は通さない。通したければ扉を書く。

```text
$ npx tsx src/cli.ts doors examples/house.muro /home/void /home/hall2
Cannot reach /home/hall2 from /home/void
```

シャフトは連続していても通行路ではない。

```text
$ npx tsx src/cli.ts doors examples/tower/main.muro /L1/ev /L2/ev
Cannot reach /L2/ev from /L1/ev
```

## 「到達できません」が返る三つの原因

1. **経路上に扉のない壁がある。**既定の壁を含む。最も多い。
2. **経路が `shaft` か `void` を通っている。**エレベーターシャフトは全階を貫いていても通行路ではない。
3. **起点か終点のパスが存在しない。**綴り違いも同じ文言で返るので、まず `graph` でパスを確かめる。

## 床の無いところへ開いた扉

扉があるのに通れないという例外が一つある。吹抜けにしか開いていない扉である。床が無いのだから誰も渡れない。

```text
✖ [access.unreachable] voidonly.muro:line 14: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
✖ [access.voidonly] voidonly.muro:line 14: Doors open only onto a void: /L2/bed (they open where there is no floor, so nobody can pass)
```

同じことは屋外にも起きる。**バルコニーに `window` しか書かなければ、そのバルコニーには出られない。**開口は通行 (`door`) か採光 (`window`) のどちらかであり、一枚が両方を担うとは言えない。掃き出しサッシは引違い部を `door`、FIX部を `window` として分けて書く。

## 車が出られない

駐車場には人の経路とは別の判定がある。`access.parking` は、**幅 2400mm 以上の開口・`type:open` の境界・斜路**のいずれも無い駐車場を violation にする。人用の扉しか無い地下駐車場は、これで捕まる。

```text
✖ [access.parking] main.muro:line 32: No vehicle route to the exterior: /B2/park (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
✖ [access.parking] main.muro:line 32: No vehicle route to the exterior: /B1/park (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
✖ [access.parking] main.muro:line 33: No vehicle route to the exterior: /B2/ramp (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
```

## 次に

- [階をつなぐ](connect-storeys.md) — `stair` と `shaft` の使い分け
- [住戸を室に割る](subdivide-a-unit.md) — 割った室のあいだに扉を置く
- [階を足す](add-a-storey.md) — 足した階が浮いていないことの確認
