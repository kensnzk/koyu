[English](../en/howto/doors-and-escape.md) · **日本語**

# 動線と避難を問う

ある空間から外部まで扉を何枚通るかを数え、通れない空間を見つけて直す。

`check` はこの問いを持たない。`check` が見るのは構成が成立しているかどうかだけで、建物が使えるかどうかは見ない。**扉を一枚も書かない建物は `check` 緑のまま完全に密閉されている。** 密閉を捕まえるのは `doors` の仕事であり、編集のたびに `check` と並べて走らせる検査である。

## 前提

- `check` がエラー0で通っていること。
- 起点と終点の空間パスが分かっていること。パスの一覧は `koyu graph <file>` で出る。
- 既定境界の規則を知っていること — 接する空間の間には、宣言が無ければ扉のない壁が導かれる ([spec/semantics.md §2 既定境界](../../spec/semantics.md) / [ADR-0014](../../docs/decisions/0014-default-boundaries.md))。

## 手順

### 1. 対象のファイルを用意する

次は二階建ての家で、`check` は緑になる。境界は外皮の4本と階段の1本だけを書いてある。

```muro
koyu 0.4
name 閉じた家
unit mm

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500

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

```sh
npx tsx src/cli.ts check house.muro
```

```text
✔ 整合 — 空間 5 / 境界 7
```

境界を5本しか書いていないのに7本ある。差の2本が、接する室の間に導かれた既定の壁である。

### 2. 扉数を数える

```sh
npx tsx src/cli.ts doors house.muro /L2/bed /out
```

```text
/L2/bed から /out へは到達できません
```

終了コードは1。緑の建物の寝室から外に出られない。

### 3. 到達不能なら隣接を見る

`graph` は空間ごとの隣接を、境界の種別つきで並べる。

```sh
npx tsx src/cli.ts graph house.muro
```

```text
/out (外部)
  — 扉1 → /L1/hall  (spec:EW)
  | 壁 → /L1/ldk  (spec:EW)
  | 壁 → /L2/bed  (spec:EW)
  | 壁 → /L2/hall  (spec:EW)
/L1/ldk (LDK)
  | 壁 → /out  (spec:EW)
  | 壁 → /L1/hall
/L1/hall (玄関)
  — 扉1 → /out  (spec:EW)
  ↕ 階段 → /L2/hall
  | 壁 → /L1/ldk
/L2/bed (寝室)
  | 壁 → /out  (spec:EW)
  | 壁 → /L2/hall
/L2/hall (2階ホール)
  | 壁 → /out  (spec:EW)
  ↕ 階段 → /L1/hall
  | 壁 → /L2/bed
```

`| 壁` は扉のない壁で、通れない。`spec:` が付いていない `| 壁` の行 (`/L1/ldk` ↔ `/L1/hall` と `/L2/bed` ↔ `/L2/hall`) が、書いていないのに導かれた既定の壁である。寝室からホールへも、LDKから玄関へも出られない。

### 4. 通れない境界に扉を書く

既定の壁に扉を足すには、その組の境界を宣言して字下げで `door` を置く。宣言した時点で既定の導出は止まり、書いた境界がその組の境界になる。

```muro-part
boundary /L1/ldk /L1/hall t:120 spec:LGS
  door w:800
boundary /L2/bed /L2/hall t:120 spec:LGS
  door w:800
```

### 5. もう一度数える

```sh
npx tsx src/cli.ts doors house.muro /L2/bed /out
```

```text
2枚 — /L2/bed → /L2/hall → /L1/hall → /out
```

## 辺になる境界

`doors` が使うグラフの辺は、境界の型だけで決まる。

| 境界 | 通れるか | 数える扉 |
|---|---|---|
| `wall` (既定・扉なし) | 通れない | — |
| `wall` + `door` | 通れる | 1枚 |
| `open` | 常に通れる | 0枚 |
| `stair` (垂直) | 常に通れる | 0枚 |
| `shaft` (垂直) | 通れない | — |
| `void` (垂直) | 通れない | — |

`air:1` は遮蔽の話であって通行の話ではない。手すり・柵・塀は外気を通すが人は通さない — 通したければ扉を書く (`examples/house.muro` の門扉がこれで、塀の境界に `door w:900` が乗っている)。正確な定義は [spec/semantics.md §4 通行可能性](../../spec/semantics.md)。

「到達できません」が返る原因は三つある。

1. 経路上に扉のない壁がある (既定の壁を含む) — 最も多い。
2. 経路が `shaft` か `void` を通っている。エレベーターシャフトは連続していても通行路ではない。
3. 起点か終点のパスが存在しない。綴り違いも同じ文言で返るので、まず `graph` でパスを確かめる。

## 確かめる

同梱の tower で、9階の住戸から南側道路まで数える。

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L9/A/ldk /out/road-s
```

```text
4枚 — /L9/A/ldk → /L9/A/hall → /L9/corridor → /L9/st2 → /L8/st2 → /L7/st2 → /L6/st2 → /L5/st2 → /L4/st2 → /L3/st2 → /L2/st2 → /L1/st2 → /site/west → /site/walk → /out/road-s
```

4枚の内訳は、住戸内の扉 (LDK→玄関)・住戸の玄関扉 (A玄関)・階段室の防火戸 (西階段防火戸)・1階の屋外出口 (西階段屋外出口)。階段は9階から1階まで8層降りても扉を増やさない (`stair` は0枚)。歩道状空地と道路の間は `type:open` なので、これも0枚である。

シャフトは通れない。

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L1/ev /L2/ev
```

```text
/L1/ev から /L2/ev へは到達できません
```

手すりも通れない。`examples/house.muro` の吹抜けと2階ホールは `air:1` の手すりで仕切られている。

```sh
npx tsx src/cli.ts doors examples/house.muro /home/void /home/hall2
```

```text
/home/void から /home/hall2 へは到達できません
```

終了コードは、到達できたとき0、到達できないとき1。CIで避難経路を守るときはこれを使う。

## 関連

- [how-to 一覧](README.md)
- [階を足す](add-a-level.md) — 階段でつなぐ手順
- [住戸を間取りに割る](unit-layout.md) — 割った室の間に扉を置く
- [よくある詰まり](troubleshooting.md) — `check` 緑なのに `doors` が到達不能を返す行の直し方
- [六つの考え](../concepts.md) — 境界が関係であること、既定が壁であること
- [診断コード一覧](../diagnostics.md)
- [spec/semantics.md](../../spec/semantics.md) §4 通行可能性・§6 doors — 規範の定義
- [spec/language.md](../../spec/language.md) §4 boundary — 型と開口の文法
- [ADR-0014](../../docs/decisions/0014-default-boundaries.md) — 既定を壁にした理由と、「接しているのに境界が無い」警告 (BND07) を廃止した経緯
