---
title: 採光 — daylight.ratio / daylight.unknown
mode: reference
---

# 採光 — daylight.ratio / daylight.unknown

| 規則 | level |
|---|---|
| [`daylight.ratio`](#daylight-ratio) | violation |
| [`daylight.unknown`](#daylight-unknown) | caution |

**採光の対象は宣言である。**型からは推定しない — `room` だからといって居室とは限らないし、`storage` に窓を要求されることもある。`daylight:1` を書いた空間だけに、床面積の 1/7 という判定が掛かる。どの粒度に判定を掛けるか — 住戸まるごとか、割った室ごとか — は `daylight:1` を書く位置として書き手が決める。

`daylight:` に書けるのは `1` (対象) と `0` (対象外) だけである。`daylight:yes` と書くと [`koyu check`](../cli/check.md) がその場でエラーにする — 解釈できない値を黙って既定へ落として、判定ごと消えるのを防ぐためである。

## 数と、閾値の分かれ目

床面積と有効窓面積は**数**であって判定ではない。[`koyu light`](../cli/light.md) はその数を返し、判定を掛けるのはこの巻である。

- **床面積** — 壁芯で測った領域の面積 (㎡)。
- **有効窓面積** — その空間に接する境界の上に書かれた `window` について、`w × h × 係数` を合計した面積 (㎡)。
- **必要面積** — 床面積 ÷ 7。

係数は**窓の先が何か**で決まる。これは形の導出であって、建築の判断ではない。

| 窓の先 | 係数 |
|---|---|
| 外部空間 (`exterior`) | 1.0 |
| 上に床がある半屋外 — 庇下・下階のバルコニー | 0.7 |
| 上が開いた半屋外 — 庭・最上階のバルコニー | 1.0 |
| 屋内の隣室 | 0 (数えない) |

半屋外かどうかも導出である — 外部に対して `type:open` の境界か `air:1` の境界 (手すりなど、遮蔽しない物) で接する空間が半屋外になる。「上に床があるか」は、どのレベルであれ上に空間が重なっているかで決まる。

**判定は甘い。**採光補正係数を掛けず、用途別の割合も適用建築物の別も見ない。基本計画の解像度に合わせた早期警報であって、法適合の判定ではない。

## `daylight.ratio` — 採光が足りない {#daylight-ratio}

`violation`

有効窓面積が床面積の 1/7 に足りない。

```muro-fail
koyu 1.0
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
  door w:900 edge:N
```

```text
✖ [daylight.ratio] main.muro:line 6: Insufficient daylight: /L1/a — effective window 0.36 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
Validation — 1 violation / 0 cautions
```

600×600 の窓は 0.36㎡、床は 3600×4500 = 16.20㎡ なので必要面積は 2.31㎡。**一桁足りない。**

**直し方** — 窓を大きくするか増やす。`h:` を書き忘れていないか確かめる (下の `daylight.unknown` が出ていればそれである)。採光を問う必要のない空間なら `daylight:1` を外す。

数がどれだけ足りないかは [`koyu light`](../cli/light.md) が室ごとに並べる。

### 庇下は 0.7 になる

同じ窓でも、上に床のあるバルコニー越しなら 0.7 が掛かる。

```muro-fail
koyu 1.0
grid X 0 3600 5400
grid Y 0 4500
level L1 0 h:2400 slab:150
level L2 2550 h:2400 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b balcony X2..X3 Y1..Y2
space /L2/a room X2..X3 Y1..Y2
boundary /L1/b /out type:open
boundary /L1/a /L1/b t:150
  window w:2400 h:1200
boundary /L1/a /out t:150
  door w:900 edge:N
boundary /L2/a /out t:150
  door w:900 edge:N
```

```text
✖ [daylight.ratio] main.muro:line 7: Insufficient daylight: /L1/a — effective window 2.02 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
Validation — 1 violation / 0 cautions
```

窓は 2400×1200 = 2.88㎡ だが、`/L2/a` がバルコニーの上に載っているので 2.88 × 0.7 = 2.02㎡ になり、2.31㎡ に届かない。上階の `/L2/a` を消せば同じ窓が 2.88㎡ として数えられ、判定は通る — **バルコニーの上に何が載るかが、下階の採光を決める。**

## `daylight.unknown` — 窓面積を数え切れていない {#daylight-unknown}

`caution`

`h:` を持たない `window` があり、その面積が合計から落ちている。

```muro-caution
koyu 1.0
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:2400 h:1200 edge:S
  window w:600 edge:E
  door w:900 edge:N
```

```text
⚠ [daylight.unknown] main.muro:line 6: Window area is not fully counted: /L1/a has a window without h: (write h: on it)
Validation — 0 violations / 1 caution
```

`h:` の無い窓は高さが決まらないので面積が出ず、黙って合計から落ちる。**落ちたことを黙っていると、足りているのか数えていないのかが区別できない。**この caution はその区別のためだけにある。

ここでは南面の窓 (2.88㎡) だけで 1/7 を超えているので `daylight.ratio` は出ていない。両方出ることもあるし、`h:` の無い窓しか無ければ有効窓面積 0.00㎡ として `daylight.ratio` も同時に出る。

数えるのは**係数が 0 でない境界の窓だけ**である。屋内の隣室に向いた窓に `h:` が無くても、そもそも採光に数えない窓なので何も言わない。

**直し方** — その窓に `h:` を書く。採光に関係しない窓 (物入れの点検口など) なら、その空間から `daylight:1` を外す。

## 関連

- [`koyu light`](../cli/light.md) — 床面積と有効窓面積という数そのもの
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
