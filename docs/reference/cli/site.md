---
title: koyu site
mode: reference
---

# koyu site

敷地面積・接道・建蔽率・容積率を出す。宣言ではなく構成から導出される、基本計画のボリューム検討の数字である。

## 引数

```text
koyu site <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 必要な二つの宣言

| 要素 | 書き方 |
|---|---|
| 敷地 | `site:1` を持つ**ゾーン** |
| 道路 | `road:<幅員mm>` を持つ `exterior` の**空間** |

どちらも無ければ敷地レポートは出ない。

## 出力

```sh
npx tsx src/cli.ts site examples/house/main.muro
```

```text
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42.0%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

| 行 | 中身 |
|---|---|
| `Site` | 敷地ゾーンのパスと表示名 |
| `Site shape` | `polygon` を宣言したときだけ出る。頂点数 |
| `Site area` | `area:` を書いていれば `declared … / derived …` の二つ、書いていなければ `Site area (derived):` の一つ |
| `Road` | 道路ごとに一行。幅員と接道長 |
| `Building footprint` | 建築面積 (水平投影、粗い) と建蔽率 |
| `Total floor area` | 延床面積と容積率 |

比率の分母は、`area:` を書いていればその宣言値、書いていなければ導出値である。

## 敷地形状を宣言したとき

`polygon` で敷地形状を書くと、面積はその多角形から出る。ゾーンの `area:` (測量値) との照合がそのまま二つの数字として並ぶ。

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

**宣言値と導出値が食い違っても `site` は黙って両方を並べる。**食い違いを問題として言うのは [`koyu validate`](validate.md) の `site.area` (caution) である。建物が敷地形状からはみ出していれば `site.escape` (violation)、接道長が 2m 未満なら `site.frontage` (violation) が出る。

## 接道長の数え方

接道長は**敷地ゾーン配下の空間と道路との境界線分長の合計**である。建物の外壁が直接道路に面する分は数えない。外構を書かずに建物だけを道路に接させると、接道長が 0 になる。

## 敷地が無いとき

```sh
npx tsx src/cli.ts site examples/mansion.muro
```

```text
There is no site (write site:1 on a zone and road:<width> on the road)
```

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 敷地レポートを出せた |
| 1 | 敷地が無い (`site:1` のゾーンも `road:` を持つ外部も無い)、または構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**`site` は数字を出すだけで、合否は言わない。**建蔽率 51.9% が指定建蔽率を超えているかどうかは、この面が持っている情報ではない。

## 粗さについて

建築面積の算入細則は粗い。庇の出も、地階の扱いも、車庫の緩和も見ない。延床面積は [`koyu stats`](stats.md) の屋内床面積と同じ数で、半屋外と屋外は入っていない。

## 関連

- [koyu validate](validate.md) — `site.area` / `site.escape` / `site.frontage`
- [koyu stats](stats.md) — 延床面積の内訳
- [.muro リファレンス](../muro/index.md) — `zone` の `site:` と `polygon` の書き方
- [koyu コマンド](index.md) — 終了コードの共通の約束
