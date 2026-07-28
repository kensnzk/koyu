---
title: column — 位置を書かない柱
mode: reference
---

# column — 位置を書かない柱

```
column <一辺mm> <レベル範囲|レベル名> [d:奥行] [x:通り,…] [y:通り,…] [属性…]
```

**柱の位置はどこにも書かれない。**書くのは「どの階に・どれだけの寸法で・どの通りに」だけである。柱は**通り芯の交点のうち、そのレベルに床のある所**に立つ — 壁が「二つの空間が接する所」に現れるのと同型の規則である。

```muro-part
column 800 L1..L6
column 900 B2..L6 x:X2,X3 y:Y2 d:1200 spec:SRC
```

第一位置引数が一辺mm (正の数)、第二位置引数がレベル範囲かレベル名である。階の範囲を分けて三行書けば、上へ行くほど細くなる柱が出る。

## 床とは何か

柱が立つ「床」の母集団は、そのレベルにあって次をすべて満たす空間である。

- 領域を持つ
- `type:exterior` ではない
- `type:void` ではない
- **半屋外であって、かつ上にどのレベルの床も重なっていない、のではない**

最後の一つが**空しか支えない床には柱を立てない**という規則である。露天のテラスや屋上庭園に柱は立たない — 柱が持ち上げるものが無いからである。上階が張り出したバルコニーの下には立つ。

半屋外かどうかは宣言ではなく導出である (外部に対して `open` か `air:1` の境界を持つ領域つき空間)。上が覆われているかどうかも導出である (どのレベルであれ、平面が重なる空間が上にあるか)。

```muro
koyu 1.0
unit mm
grid X 0 6000 12000
grid Y 0 6000
level L1 0 h:3000 slab:200
level L2 3200 h:3000 slab:200

space /L1/room room X1..X2 Y1..Y2 name:室
space /L1/terrace terrace X2..X3 Y1..Y2 name:テラス
space /L2/room room X1..X2 Y1..Y2 name:上階の室
space /out exterior name:外部

boundary /L1/terrace /out type:open

column 800 L1
```

テラスは `open` で外部に接するので半屋外であり、その上に L2 の空間は重なっていない。だから X3 通りには柱が立たない。

```ts
import { parseFile } from "@kensnzk/koyu/node";
import { columnsFor } from "@kensnzk/koyu";

const model = parseFile("col.muro");
for (const c of columnsFor(model, "L1")) console.log(c.grid, c.w, c.d);
```

```text
X1/Y1 800 800
X1/Y2 800 800
X2/Y1 800 800
X2/Y2 800 800
```

`/L2/room` の割付を `X1..X3` に広げてテラスの上を覆うと、同じ宣言から六本になる。

```text
X1/Y1 800 800
X1/Y2 800 800
X2/Y1 800 800
X2/Y2 800 800
X3/Y1 800 800
X3/Y2 800 800
```

床の判定に使うのも**導出された形**である。[描かれた線](line.md)で切り落とされた側に交点が落ちれば、そこに柱は立たない。交点が形の辺の上にあれば内側として数える。

## 属性

| 属性 | 層 | 意味 |
|---|---|---|
| `d` | 構造 | 矩形断面の奥行mm。既定は一辺と同じ (角柱) |
| `x` / `y` | 構造 | 立てる通りの限定。カンマ区切り。未指定は全通り |
| `name` | 解釈 | 表示名。`drop column` が指す名でもある |
| `spec` | 運搬 | 物の名 — 運ぶだけ |

台帳に無いキーはドットを含む名前空間を持たなければ書けない (ATT03)。`x:` / `y:` に未宣言の通り名を書けば parse がその場で止める。

通り名の列は順序を持たない — `x:X2,X1` と `x:X1,X2` は同じ構成であり、正準JSONでは通りの並び順に整えられる。

## 宣言の順序は意味である

**同じ交点に二本は立たない。先に書かれた宣言が勝つ。**だから柱の宣言の並びを入れ替えると別の建物になる。正準JSONは柱の宣言を並べ替えない — 並べ替えれば、別の建物が同一バイトの正準JSONを持つことになる。

一本も立たない宣言は、理由を二つに割って報告される。**狙う交点に床が無い**のか、床はあるが**先の宣言に取られた**のかで、直す手が正反対だからである。

```text
⚠ Not one column stands for this declaration (the grid intersections have no floor): L1 800mm square
⚠ This column declaration (L1 700mm square) stands nowhere because an earlier declaration took the same intersections (at the same intersection the earlier declaration wins)
```

`drop column <名>` で宣言を消せる。**名が一意でなければ拒む** — どちらを消すのかが決まらないまま片方を消したりはしない。

```text
✖ The column name C1 is not unique
```

## 柱は空間でも境界でもない

だから柱は**面積にも `koyu doors` のグラフにも現れない**。床面積は空間の壁芯面積の合計であって、柱の断面は差し引かれない。動線は空間と境界の網であって、柱はそこに節点も辺も持たない。

柱が現れるのは形の側だけである — 平面の断面、立体の角柱、そして検証の `column.blocksdoor` (violation) である。導出された柱が導出された扉と重なれば、それが言葉になる。

柱の z 範囲はそのレベルの FL から FL + 階高までである。階高は「上のレベルがあればその差、無ければその階の最大天井高 + 屋根版の厚さ」で、**天井高が一つも決まらなければ階高も決まらず、そのレベルには柱も壁も立たない** (SUF01 が error として言う)。

## 診断

| コード | severity | 何を言うか |
|---|---|---|
| COL01 | warning | この宣言に対して一本も立たない — 狙う交点に床が無い |
| COL02 | warning | この宣言に対して一本も立たない — 先の宣言が同じ交点を取った |
| ATT03 | error | 台帳に無い属性キー |

母集団は**宣言**である。「このレベルに何本立ったか」ではなく「この宣言から何本立ったか」を問う — 前者を数えると、同じ階の別の宣言が一本でも立てた瞬間に、一本も立たない宣言が黙って通る。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [space](space.md) — 柱が立つ床を与えるもの
- [grid](grid.md) — 交点を与えるもの
- [boundary](boundary.md) — 半屋外を導出する `open` と `air:1`
- [line](line.md) — 床の形を切る
- [koyu validate](../cli/validate.md) — 柱が扉を塞いでいないかを言う
