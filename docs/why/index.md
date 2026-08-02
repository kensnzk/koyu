---
title: koyu とは何か
mode: explanation
---

# koyu とは何か

建築のデータは、図面から CAD、BIM に至るまで、一貫して**建てるべき物**の記述だった。壁・床・柱・梁を並べ、室はその囲みの結果として後から導かれる。物のデータは三十年かけて何度もデジタル化されたが、**建築そのもの — 空間の分節・接続・序列 — は、いまだに機械可読になっていない。**

koyu はその順序を逆にする。空間を一次要素とするテキスト (`.muro`) を建築の原本とし、形はそこから必要に応じて導く。これは BIM の改良ではなく、**記述する対象の取り替え**である。建築物 (物) から建築 (空間) へ。

対象を替えると、建物一棟のデータが桁ごと縮む。延床 4,786 ㎡・11 階建ての複合ビルが、原本 9 ファイル・453 行・8,574 トークンで書ける。延床 31,606 ㎡・地下 2 階＋地上 19 階の複合建築が 646 行・12,685 トークンである。**一棟が丸ごと機械の視野に入る。**

## 三行で

**空間が一次で、壁は物ではなく二つの空間の関係である。**だから室を数え上げれば壁は付いてくる。

**原本は意味を持ち、形を持たない。**平面図も面積も動線も、書かれるのではなく導かれる。

**軽さは目的ではなく、役割から出る結果である。**書くしかないもの — 意味・関係・同一性 — だけを持てば、一棟が LLM の一つのコンテキストに載る。

## 何が書かれ、何が計算されるか

```muro
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

この 5 行に壁は一本も書かれていない。それでも `koyu check` は境界を 1 本数える。

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

二つの室が接しているので、その間の壁が**導かれている**。壁を置く操作は koyu に存在しない。詳しくは [空間中心のモデル](space-is-primary.md) と [境界による壁の表現](boundary-is-a-relation.md)。

## 五分で「自分に向いているか」を確かめる

順に打つ。どれも同梱の例で動く。

**1. 整合を見る。**

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**2. 構成にそのまま問う。**部材モデルなら抽出作業が要る問いが、変換なしに答えになる。

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 1 door → /L1/b  (spec:PW1)
  | wall → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 1 door → /L1/a  (spec:PW1)
  — 1 door → /out  (spec:EW1 fire:60)
/out (外部)
  | wall → /L1/a  (spec:EW1 fire:60)
  — 1 door → /L1/b  (spec:EW1 fire:60)
```

**3. 動線を数える。**

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

**4. 一棟の規模で同じことをする。**

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436.0%
```

接道長も建築面積も延床も、どこにも書かれていない。敷地形状と空間の領域から導かれている。

**5. 「緑」の意味を確かめる。**次の 11 行は `check` が緑で、しかも外へ出られない。

```muro
koyu 1.1
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/hall hall X1..X2 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2
space /out outside:1
boundary /L1/hall /out t:150
boundary /L2/bed /out t:150
boundary /L1/hall /L2/bed type:stair
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```text
$ npx tsx src/cli.ts doors sealed.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

ここで納得できるかどうかが分かれ目である。`check` は「書かれたものがデータとして矛盾していない」までしか言わない — [check の保証範囲](green-is-not-a-building.md)。建築としての判定は `koyu validate` が別に言う。

### 向いている

- 基本計画の段階で、**構成の決定**を versioning したい
- 面積・動線・区画・採光を、抽出作業なしに問いたい
- LLM やエージェントに建物を直接編集させたい
- 設計案の比較を git のブランチ比較にしたい
- 実測・センサー・都市データと、建物の**空間**の側で繋ぎたい

### 向いていない

- 施工図の解像度が要る (納まり・下地・接合部)
- 曲面・自由形状が主題である
- 構造解析・設備計算のモデルが欲しい
- 既存の IFC 資産と往復させたい (出口は作るが往復は作らない)

境界線の引き方は [記述できる粒度](resolution.md) にある。

## この巻の読み方

**記法の考え方**

- [空間中心のモデル](space-is-primary.md) — 出発点
- [境界による壁の表現](boundary-is-a-relation.md)
- [既定の境界](silence.md)
- [導出される情報](source-and-derived.md)
- [パスと面積集計](paths.md)
- [属性の拡張](open-vocabulary.md)

**約束の形**

- [check の保証範囲](green-is-not-a-building.md)
- [check と validate の違い](two-kinds-of-green.md)
- [言語・判定・描画の分離](three-domains.md)
- [ファイル分割と重ね合わせ](composition-is-for-time.md)
- [導出の決定性](form-must-be-unique.md)
- [平面図の生成](plan-is-not-a-section.md)

**既存の世界との関係**

- [BIM・IFC・USD の基礎](bim-ifc-usd.md) — この分野の語彙を持たない読者へ
- [IFC・USD との比較](vs-ifc.md) — トークン実測つき
- [IFC4 対応表](ifc4-coverage.md)
- [記法形式の比較](dsl-not-yaml.md) — YAML/JSON との書き比べ
- [記述できる粒度](resolution.md)

約束の正確な範囲は [約束の範囲](../reference/scope.md) にある。
