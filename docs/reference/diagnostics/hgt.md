---
title: HGT — 高さの不変量
mode: reference
---

# HGT — 高さの不変量

HGT は二つある。どちらも**書かれた値どうしが矛盾している**ことを言う。

| コード | severity | 何を言うか |
|---|---|---|
| HGT01 | error | 天井高 + 上階の床組み厚が階高を超えている — 上階に食い込む |
| HGT02 | error | 部分吹抜けなのに、階を貫く天井高が宣言されている |

**これは平面の重なりの断面版である。**同じレベルで二つの空間の領域が重なれば矛盾だと `check` が言う ([GEO02](./geo.md)) のと同じ資格で、下階の天井が上階の床を突き抜けていれば矛盾だと言う。どちらも「書かれたものがデータとして成立していない」話であって、建築の良し悪しの話ではない。だから HGT は `check` の側に残っている。

## 不変量

各空間について、次を検査する。

```text
有効天井高 + 上階の slab ≤ 階高
```

- **有効天井高**は、その空間の `h:` があればそれ、無ければ所属レベルの `h:` である。空間の `h:` がレベルの `h:` に勝つ。
- **上階の slab** は、次のレベルの `slab:` (床組み厚 — スラブ + 懐 + 仕上) である。
- **階高**は、次のレベルの `z` と自レベルの `z` の差である。階高は書かれない — レベルの `z` から導かれる。
- 許容は 0.5mm。丸めの誤差で落ちることはない。

積み上がりは `koyu levels` がテキストの矩計として見せる。

```sh
koyu levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:400
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

## 誰が検査されるか

不変量を問われるのは、次のすべてを満たす空間だけである。

- **上にレベルがある。**最上階には上階の床が無いので、食い込む先が無い。
- **上に空間が重なっている。**上階に空間はあるが自分の真上には無い、という空間は問われない。上階に空間が一つも無いレベルは、全体が「覆われている」ものとして扱う。
- **半屋外ではない。**外部に `type:open` か `air:1` で接する空間 — バルコニー・テラス・屋外階段 — に天井は無い。
- **縦動線の宣言を持たない。**`stair:` `ramp:` `escalator:` `lift:` を持つ空間の天井は上の走りに沿って傾いており、一つの数で語れない。宣言的な免除である。
- **上階の `slab:` と有効天井高がどちらも決まっている。**どちらかが書かれていなければ立式できない。**その状態は不変量の破れではなく情報の欠落**なので、[SUF01 と SUF03](./suf.md) が別に言う。HGT は黙る。

最後の一点は事故になりやすい。上階に `slab:` を書き忘れると、下階の高さは**検査されないまま緑になる**。`--strict` を回して SUF03 を拾うこと。

## HGT01 — 上階に食い込みます

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

```text
/L1/a collides into the floor above: ceiling height 2800 + L2's slab 400 = 3200 > storey height 3000
```

**原因** — 天井高 2800 と床組み厚 400 の合計が階高 3000 を超えている。メッセージが三つの数字を全部出すので、どれを動かすかはその場で決まる。

**直し方** — 三つのうちどれかを動かす。

- 天井高を下げる — `level L1 0 h:2400 slab:400`
- 床組みを薄くする — `level L2 3000 h:2400 slab:200`
- 階高を上げる — `level L2 3400 h:2400 slab:400`

その室だけ天井を下げたいなら、レベルではなく空間に書く。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2 h:2400
space /L2/a room X1..X2 Y1..Y2
```

階を貫かせたいのであれば、それは吹抜けの宣言 — 下の HGT02 を見る。

## HGT02 — 部分吹抜けの被覆不足

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:5400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

```text
/L1/a collides into the floor above: ceiling height 5400 + L2's slab 400 = 5800 > storey height 3000. The void covers only 50.0% — under a partial void keep the ceiling height within the storey height (the height of the void part is derived)
```

**原因** — `type:void` の境界は、高さの不変量に対する**宣言的な免除**である。しかし免除が効くのは、吹抜けが下階の平面を覆う範囲までである。上の例は下階の半分しか吹抜けていないのに、下階の天井高を階を貫く 5400 と宣言している。残り半分の上には床があるので、そこを 5400 にはできない。

免除が全面に効くのは**被覆率 99% 以上**のときだけである。メッセージは被覆率を小数一桁で出す — しきい値と衝突しない粒度である。

**直し方** — 下階の天井高を階高内に収める。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

**吹抜け部分の高さは宣言しない。**`void` の関係から導出される。下階の天井高は「床のある側の天井高」であって、吹抜けの高さではない。

全面を吹抜けにしたいのなら、`void` 空間の領域を下階の領域と同じにする。そのとき被覆率は 100% になり、階を貫く天井高がそのまま通る。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:5400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
boundary /L1/a /L2/v type:void
```

## HGT が言わないこと

**建築的な高さの判断は一件も持たない。**軒高・最高高さ・道路斜線・北側斜線・日影・天井高の下限 — これらは `check` にも `koyu validate` にも無い。koyu は高さについて「書かれた数どうしが噛み合っているか」だけを言う。

`koyu validate` が持つ高さまわりの判定は、階段の踏面と蹴上げの釣り合い (`stair.proportion`) と斜路の勾配 (`run.slope`) の二つで、どちらも**導出された形**に対する注意であって、法規の高さ制限ではない。

## 関連

- [SUF — 充足性](./suf.md) — 天井高や `slab` が**書かれていない**ときはこちら
- [VRT — 垂直境界](./vrt.md) — `type:void` の境界そのものの検査
- [GEO — 領域の重なり](./geo.md) — 平面での同じ話
- [koyu check](../cli/check.md) / [koyu validate](../cli/validate.md)
