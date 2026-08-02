---
title: 既定の境界
mode: explanation
---

# 既定の境界

koyu の記法が短いのは、覚えることが少ないからではなく、**書かないことが多い**からである。何が書かれず、書かれないことが何を意味するのかを知らないまま構文表を読むと、行が足りないのか多いのかが判断できない。

**「書かない」は三通りあり、意味が違う。**

| 接触の種類 | 書かなかったときの意味 | では宣言は何のためにあるか |
|---|---|---|
| 同一レベルで平面が接する、領域つきの空間どうし | **壁** (導出される) | 例外 (`type:open` / `air:1`) と、属性・開口のため |
| 上下のレベルで平面が重なる空間どうし | **床** (導出される) | 例外 (`stair` / `shaft` / `void`) のため |
| 領域を持たない空間 (`exterior` など) との接触 | **何も無い** | 外皮そのもののため |

規則の綴りは [既定境界](../reference/muro/defaults.md) にある。この頁が言うのは、なぜこの三段構えなのかである。

## 上の二つは対称である

**水平は壁、垂直は床。どちらも書かない。**

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

二室の間に壁がある。上下階が重なっていれば、その間に床がある。**どちらも建築の既定であり、例外の方が珍しい。**

既定を逆にしたらどうなるかを考えると、この選択の理由が見える。接する二室の間に壁があると書かせるなら、`space` 行の数だけ `boundary` 行が要る。425 空間の建物なら 1,364 本である。それは記述ではなく**書き取り**であって、設計判断を一つも運んでいない。

**宣言が要るのは、既定から外れるときと、既定の実体に値を与えるときだけである。**

```muro-part
boundary /L1/a /L1/b type:open          # 例外 — 壁ではなく開放
boundary /L1/a /L1/b t:120 spec:PW1     # 既定の壁に、厚みと仕様を与える
boundary /L1/hall /L2/bed type:stair    # 例外 — 床ではなく階段
```

「接しているのに境界が宣言されていない」という警告はかつて存在したが、既定が壁になったことで役目を終え、廃止された。**書かないことが積極的な意味を持つ以上、それは欠落ではない。**

## 三つ目だけが違う

**内壁は自動、外壁は手動。**この非対称は既定値の表を眺めていても出てこない。ここを見落とすと図面が壊れる。

上のファイルは `check` が緑で、しかし**外壁が一本も無い。**黒く描かれるのは中央の一本 — 導出された既定の壁 — だけで、外周には何も無い。

外部空間と、外部との境界を書いて初めて外皮ができる。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

**理由はある。**どの外部か — 道路・隣地・庭・共用廊下 — の名指しがそれ自体情報であり、既定では導けない。外部を一枚岩の `/out` にするか、方角ごとに割るかは設計の判断である。接道長は「道路として宣言された外部空間」に接する長さから出るので、その割り方が数値に効く。

**境目は「`exterior` かどうか」ではなく「領域を持つかどうか」である。**`space /out/garden exterior X2..X3 Y1..Y2 level:L1` のように領域とレベルを持つ外部空間なら、接する室との間に既定の壁が導出される。

## 外皮の欠落は、緑では捕まらない — 判定では捕まる

`check` は外皮の欠落を見ない。それは構成の矛盾ではないからである。

見るのは判定の側である。

```sh
npx tsx src/cli.ts validate gap.muro
```

```text
⚠ [envelope.gap] gap.muro:line 6: Perimeter not faced by any envelope: /L1/b — S 3600mm / E 4000mm / N 3600mm (11200mm over 3 run(s)). Write a boundary to the exterior
```

この判定は粗い — **外部への境界を一本でも書いたレベルだけ**を見る。外皮をまだ模型にしていない階を「穴が開いている」とは言わない。「書き始めたなら閉じきる」という整合の要求であって、完全性の要求ではない。粗さが許されるのは、判定が凍らない領域にあるからである ([check と validate の違い](two-kinds-of-green.md))。規則は [envelope.gap](../reference/validate/envelope.md)。

## 沈黙が導出を生む — 半屋外

三段構えの効き目が最もよく出るのが半屋外である。**半屋外は宣言できない。導出される。**

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room ldk X1..X2 Y1..Y2
space /L1/balcony balcony X2..X3 Y1..Y2
space /out outside:1
boundary /L1/room /L1/balcony t:150
  window w:1600 h:2000
boundary /L1/balcony /out type:open
```

最後の一行がバルコニーを半屋外にする。`type:terrace` と書いても、`type:balcony` と書いても、半屋外にはならない — **半屋外にするのは境界の側である。**

```text
L1
  /L1/room	room	ldk	14.40 m2
  /L1/balcony	balcony	balcony	7.20 m2 (semi-outdoor, reported separately)
  Subtotal 14.40 m2
Total 14.40 m2 (indoor floor area)
Semi-outdoor 7.20 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
```

外部に対して `open` または `air:1` の境界を持つ、領域つきの空間が半屋外である。手すりで囲われたテラスは `air:1` — 物はあるが外気と光を遮らない — で書き、それがそのまま半屋外の条件を満たす。**性質を宣言するのではなく、性質を生む構成を書く。**

## 沈黙は「空でよい」ではない

書かなくてよいことと、書かなくても形になることは別である。**形を作るのに必要な情報が欠けていれば、`check` はエラーを出す。**

天井高が決まらなければそのレベルには壁も柱も立たないので、これはエラー (SUF01) である。レベルが決まらない領域つきの空間もエラー (SUF02) である。**既定を勝手に捏造して形を作ることはしない** — 作れないなら、その要素を作らずに「作れない」と言葉にする。

一覧は [SUF — 充足性](../reference/diagnostics/suf.md) にある。

## この先

- [導出される情報](source-and-derived.md)
- [check の保証範囲](green-is-not-a-building.md)
- [既定境界](../reference/muro/defaults.md)
- [導出の定数](../reference/form/constants.md) — 書かれなかったときに何を導くか
