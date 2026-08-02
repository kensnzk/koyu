---
title: 到達 — access.*
mode: reference
---

# 到達 — access.*

| 規則 | level |
|---|---|
| [`access.unreachable`](#access-unreachable) | violation |
| [`access.voidonly`](#access-voidonly) | violation |
| [`access.throughtenant`](#access-throughtenant) | caution |
| [`access.parking`](#access-parking) | violation |
| [`access.backofhouse`](#access-backofhouse) | caution |

**緑の `check` は「使える建物」を意味しない。**接する空間の既定は壁なので、扉を一枚も宣言しない二階建ては、構成として何一つ矛盾しないまま完全に密封される。

この章は、その予言が旗艦例で現実になったときに書かれた。`check` が緑のまま、「床の無い吹抜けにしか扉が開かない区画が20」「他人の店舗を貫通する避難路」「車の出入口の無い2層の駐車場」「バックヤードの奥で孤立したエスカレーター」を抱えていたのである。**予言した当人が予言を踏んだ。**直したことと再発しないことは別なので、五つを規則として置いてある。

## 通れる境界の定義

どの規則も同じ一つの定義の上に立つ。

**人が通れる境界** — `type:open` の境界、上下を繋ぐ `type:stair` の境界、そして `door` の書かれた壁。`type:shaft` と `type:void` は通れない。窓は通れない。

**通り抜けられない空間** — `void:1` を宣言した空間と、型が `shaft` の空間。どちらも空間としては連続していても人が通り抜ける先にはならない。

> **綴りの守りが二つに割れていることに注意。**`void:1` は[台帳](../muro/attributes.md)の鍵なので、`voi:1` と書けば [ATT03](../diagnostics/att.md#att03) で止まる。`shaft` は**型の位置の自由語**であり、`shaftt` と書けばこの規則は黙って掛からなくなる。core は型を一切読まないが、判定の面は読む — そしてこの面は[凍らない](../scope.md)。

**車が通れる境界** ([`access.parking`](#access-parking) だけが使う) — `type:open` の境界、幅 2400mm 以上の `door`、そして `ramp:` を持つ空間の縦連結。**階段の縦連結は、車にとってはただの段差である。**

## `access.unreachable` — 外部へ到達できない {#access-unreachable}

`violation`

領域を持つ空間から、通れる境界を辿って `outside:1` の空間へ出られない。

```muro-fail
koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
```

```text
✖ [access.unreachable] main.muro:line 6: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
Validation — 1 violation / 0 cautions
```

外部への壁は書いた。だが開口が無い。**問うのは扉の有無ではなく到達性である** — 扉を持っていても、その先が行き止まりなら出られない。

対象外になるのは、領域を持たない空間、`outside:1` の空間そのもの、型が `shaft` の空間、`void:1` の空間である。そして**外部空間が一つも書かれていない模型では、この規則は走らない** — 外部が無い模型に「外部へ出られない」と言っても意味がないからである。

violation にしてあるのは、出られない室を建築として読める解釈が無いからである。

**直し方** — 外部へ抜ける経路のどこかに `door` を書く。外部への境界は線分が複数になるので `edge:N/E/S/W` で辺を選ぶ。

```muro
koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
  door w:900 edge:S
```

どこで鎖が切れているかは [`koyu doors`](../cli/doors.md) が最少扉数の経路で答える。

## `access.voidonly` — 扉が吹抜けにしか開いていない {#access-voidonly}

`violation`

通れる境界を持っているのに、その行き先が全部 `void:1` の空間である。

```muro-fail
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/v X1..X2 Y1..Y2 void:1
space /L1/a room X2..X3 Y1..Y2
boundary /L1/a /L1/v type:open
```

```text
✖ [access.voidonly] main.muro:line 6: Doors open only onto a void: /L1/a (they open where there is no floor, so nobody can pass)
Validation — 1 violation / 0 cautions
```

吹抜けは空間としては連続するが**床が無い**。扉は穴に向かって開いていて、出入りしたつもりでどこへも行けない。区画を吹抜けに面して並べ、廊下との境界を書き忘れると起きる。旗艦例はこれを20区画抱えたまま緑だった。

この規則は外部空間の有無を問わない。通れる境界が一本も無い空間にも掛からない — それは [`access.unreachable`](#access-unreachable) の仕事である。

**直し方** — 床のある隣 (廊下・階段室) へ扉を書く。吹抜けに面した縁が本当に開いているのなら、それは通行ではなく**見下ろし**なので、`type:open` ではなく `air:1` の壁 (手すり) にする。

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/v X1..X2 Y1..Y2 void:1
space /L1/a room X2..X3 Y1..Y2
boundary /L1/a /L1/v air:1 h:1100
```

## `access.throughtenant` — 避難が賃貸区画を通る {#access-throughtenant}

`caution`

型が `stair` の空間から外部へ出るどの経路も、`use:rentable` の空間を通る。

```muro-caution
koyu 1.1
grid X 0 3000 9000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/s stair X1..X2 Y1..Y2
space /L1/t room X2..X3 Y1..Y2 use:rentable
boundary /L1/s /L1/t
  door w:900
boundary /L1/t /out
  door w:1800 edge:S
boundary /L1/s /out t:150
```

```text
⚠ [access.throughtenant] main.muro:line 6: Escape from /L1/s passes through rentable space (if the tenant locks up, there is no way out)
Validation — 0 violations / 1 caution
```

**テナントが施錠した瞬間、その階段は避難に使えなくなる。**`use:` はゾーンから継承されるので、区画ごとに書いていなくても親のゾーンに `use:rentable` があれば同じ判定が掛かる。

**caution にしてある理由** — 通ってよいかは契約と管轄の側の事実であって、書かれた構成には無い。賃貸区画の中に専用通路を通す設計は現にある。疑う値打ちはあるが、断じる根拠がここには無い。

**直し方** — 賃貸区画を避けて外部へ抜ける経路 (共用廊下・附室) を書く。階段室から直接外部へ出るなら、その境界に `door` を書く。

## `access.parking` — 車が外部へ出られない {#access-parking}

`violation`

`use:parking` の空間から、車が通れる境界だけを辿って外部へ出られない。

```muro-fail
koyu 1.1
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:900 edge:S
```

```text
✖ [access.parking] main.muro:line 6: No vehicle route to the exterior: /L1/p (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
Validation — 1 violation / 0 cautions
```

**人は 900mm の扉と階段で出られてしまうので、[`access.unreachable`](#access-unreachable) はこれを見ない。**駐車場だけが別の通行体で問われる理由がそこにある。

**直し方** — 車路の開口を `door w:2400` 以上にするか、境界を `type:open` にする。地下や上階の駐車場なら、斜路の空間に `ramp:` を書いて `stack` で繋ぐ — その縦連結だけが車の通れる階の跨ぎ方である。

```muro
koyu 1.1
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:2400 edge:S
```

## `access.backofhouse` — 共用廊下からバックヤードを通らずに届かない {#access-backofhouse}

`caution`

縦動線の宣言 (`stair:` / `escalator:`) を持つ `use:common` の空間へ、共用廊下から型 `backyard` の空間を通らずに届かない。

```muro-caution
koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/c corridor X1..X2 Y1..Y2 use:common
space /L1/b backyard X2..X3 Y1..Y2
space /L1/e room X3..X4 Y1..Y2 use:common escalator:N
space /L2/e room X3..X4 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /L1/c /L1/b
  door w:900
boundary /L1/b /L1/e
  door w:900
```

```text
⚠ [access.backofhouse] main.muro:line 8: /L1/e cannot be reached from a common corridor without passing through back-of-house (visitors cannot use this vertical circulation)
Validation — 0 violations / 1 caution
```

共用の縦動線は客動線の一部である。その乗り場へ行くのにバックヤードを抜けなければならないなら、客は乗れない。

**当の空間へは水平に入れなければならない。**自分の縦連結を経由してよいことにすると「上の階からそのエスカレーターで降りてくれば乗り場に着く」という循環が成り立ち、孤立をそのまま素通ししてしまう。だから検査は、その空間自身に接する `type:stair` の境界を使わない経路だけを見る。

**共用廊下 (型が `corridor` かつ `use:common`) が一つも無い建物では、この規則は走らない。**客動線と従業員動線の区別が無い建物 — 住宅など — の階段を孤立と誤検出しないためである。

**caution にしてある理由** — 「共用の縦動線はすべて客用」は粗い推定である。従業員用の共用階段を客用と読み違えることがある。

**直し方** — 共用廊下から直接届く位置へ動かすか、廊下との間に扉を書く。従業員用の縦動線なら `use:common` を外す。

```muro
koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/b backyard X1..X2 Y1..Y2
space /L1/c corridor X2..X3 Y1..Y2 use:common
space /L1/e room X3..X4 Y1..Y2 use:common escalator:N
space /L2/e room X3..X4 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /L1/b /L1/c
  door w:900
boundary /L1/c /L1/e
  door w:900
```

## 関連

- [`koyu doors`](../cli/doors.md) — 二つの空間の間の、扉の数が最も少ない経路
- [柱](column.md) — 扉が開かないもう一つの理由。柱が塞いでいる場合
- [外皮](envelope.md) — 外周に穴があると、そもそも外との関係が書かれていない
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
