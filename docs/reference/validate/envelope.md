---
title: 外皮 — envelope.gap
mode: reference
---

# 外皮 — envelope.gap

| 規則 | level |
|---|---|
| [`envelope.gap`](#envelope-gap) | caution |

**接する二つの空間の間には、何も書かなくても壁が導かれる。**書き忘れても壁は立つ。だが**外部への境界だけは導かれない** — 領域を持たない空間との間に既定の境界は引かれず、相手を名指すことそのものが情報だからである。

その非対称の帰結として、外部への境界の書き忘れは**黙って壁の不在**になる。図を見るまで気づかない。この規則は、それを言葉にするためにある。

## `envelope.gap` — 何にも面していない外周がある {#envelope-gap}

`caution`

```muro-caution
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:W t:200
  door w:900
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /out t:150
```

```text
⚠ [envelope.gap] main.muro:line 6: Perimeter not faced by any envelope: /L1/a — S 4000mm / N 4000mm (8000mm over 2 run(s)). Write a boundary to the exterior
Validation — 0 violations / 1 caution
```

`/L1/a` の外周は四辺ある。東は `/L1/b` と接しているので相手がいる。西には境界を一本書いた。**残る北と南は、他の空間とも宣言された境界とも向かい合っていない。**そこには壁が立たない。

メッセージは**どの辺が空いているかを言う**。合計長だけでは、辺を書き分けている図面のどこを直せばよいか分からないからである。辺の別が書かれていない境界にぶつかった区間は `N/S` `E/W` のようにまとめて出る。

### 何が検査されるか

外周のうち、次のどれにも当たらない区間が「穴」である。

1. 同じレベルの別の空間と向かい合っている区間
2. その空間について宣言された境界が覆う区間 (`type:open` でも `air:1` でも覆う — **どれも「書かない」とは違う**)

上下を繋ぐ境界 (`type:stair` / `type:shaft` / `type:void`) は水平の外周を覆わないので、覆う側には数えない。

### 検査するのは完全性ではなく「書き始めたなら閉じきる」

**外部への境界を一本も持たないレベルには、何も言わない。**そのレベルは外皮をまだ模型にしていないだけである — 二室一扉の最小の例に警告を出しても意味がない。

「外皮を書き始めている」の判定は具体的である。**領域を持たない空間 (`space /out outside:1` のような、範囲を書かない外部) との境界が、そのレベルのどこかに一本でも宣言されていること。**逆に言えば、外部を `space /out/n exterior X1..X3 Y2..Y3` のように**領域つきで**書いて敷地をタイルしている模型では、その境界は「領域を持つ空間どうし」なので、このレベルは外皮を書き始めたとは見なされない。

数えない空間もある。

- 領域を持たない空間 (外部そのもの)
- `outside:1` の空間
- 半屋外の空間 (外部に対して `type:open` か `air:1` で接することから導出される)
- `site:1` を持つゾーンの配下にある外構のタイル

どれも囲われていないのが正常だからである。

### 直し方

残りの辺に境界を書く。`edge:N/E/S/W` で辺を選ぶか、辺を限定しない一本で残り全部を受ける。

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:W t:200
  door w:900
boundary /L1/a /out edge:N t:200
boundary /L1/a /out edge:S t:200
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /out t:150
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

壁が要らない開放的な縁なら `type:open` を、手すりなら `air:1` を書く。**穴が閉じるのは「壁を書いたから」ではなく「相手を名指したから」である。**

## 関連

- [到達](access.md) — 外皮を閉じきると今度は出られなくなる。扉の話はそちら
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
