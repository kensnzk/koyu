---
title: 約束の範囲 — check が緑であることの意味
mode: reference
---

# 約束の範囲 — check が緑であることの意味

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

この一行が何を約束し、何を約束しないか。**それがこの頁である。**

## 緑の定義

> **構造層と解釈層について、宣言された不変量が成り立つ。運搬層については何も言わない。建築としての妥当性については何も言わない。**

これは判定ではなく**読解の一部**であって、壊れた JSON を JSON パーサが弾くのと同じ層にある。

## 三つの領域

koyu は三つの領域からなる。**求められる品質が違うので、分けてある。**

| 領域 | 何を持つか | 大きさ | 品質 | 版 |
|---|---|---|---|---|
| **core** | 言語・意味論・合成・同一性・[導出](form/index.md)・構造整合の診断・問い・[正準 JSON](json/index.md) | 小さい | **きれいでなければならない** | **凍る** |
| **検証** | [建築的な判定](validate/index.md) — 15 の規則 | 大きくなる | 汚くてよい | 凍らない |
| **表現・ビルド** | SVG 生成と外部のビュアー | 大きくなる | 汚くてよい | 凍らない |

**依存は一方向である。**検証も表現も core に依存し、core はどちらにも依存しない。core は自分だけで完結して動く。この一方向は文ではなくテストが機械的に守る。

分けないと二つのことが同時に起きる — **汚さが core に染み出して凍り、core の慎重さが検証と表現の成長を止める。**分けることそのものが、検証と表現が汚くてよい条件である。凍らない領域の汚れはいつでも書き直せるので安い。凍る領域の汚れは永久に残る。

型からして別である。core が返すのは `Diagnostic { code, severity }`、検証が返すのは `Finding { rule, level }` — 綴りも型も混ざらない。**判定を足しても言語の版は動かない。**

## 保証するもの

| 保証 | 診断 |
|---|---|
| パスと同一性の一意性 | [UID01–04](diagnostics/uid.md) / [ZON02](diagnostics/zon.md) / 合成時のパス重複エラー |
| 参照先の存在 | [REF01](diagnostics/ref.md) / アセット未定義 / `polygon` の対応ゾーン([SIT04](diagnostics/sit.md)) |
| レベルの定義 | [LVL01](diagnostics/lvl.md) / [VRT02](diagnostics/vrt.md) |
| 区画の重なり(平面) | [GEO01 / GEO02](diagnostics/geo.md) |
| 区画の重なり(断面) | [HGT01 / HGT02](diagnostics/hgt.md) |
| 合成の解決が定まること | 合成エラー |
| **形を作るのに必要な情報の充足** | [SUF01–04](diagnostics/suf.md) |
| 関係の健全性 | [BND01–06](diagnostics/bnd.md) / [VRT01–06](diagnostics/vrt.md) |
| 導出の一意性(開口・`seg`・線・柱・縦動線の形) | [OPN01–08](diagnostics/opn.md) / [SEG01–08](diagnostics/seg.md) / [LIN01–03](diagnostics/lin.md) / [COL01–02](diagnostics/col.md) / [RUN01–03 / RUN05](diagnostics/run.md) |
| 解釈される属性の値域 | [ATT01–03](diagnostics/att.md) / [DAY01](diagnostics/day.md) |
| 与件の健全性 | [SIT01 / SIT02](diagnostics/sit.md) |

**断面の重なりが core にあるのは、それが平面の重なりの断面版だからである。**下階の天井と上階の床が同じ z を占める状態は、二つの空間の領域が重なる状態と同じ種類の矛盾であり、そこからは一意な形が作れない。「階高・軒高・斜線」のような建築的な高さの判断は保証しない — それは検証の面である。

## 保証しないもの

**採光・面積率・容積率・外皮の連続・階段の登りやすさ・扉の設置可能性・避難・接道 — その他あらゆる建築的な妥当性。**そして**[運搬層](muro/attributes.md)の属性の意味**。

これらは存在しないのではなく、**別の面にある**。[`koyu validate`](cli/validate.md) が持つ。

```sh
npx tsx src/cli.ts validate examples/two-rooms.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

出力自身がそう名乗る。

## 緑を根拠に「動く」と主張しない

`check` が緑でも建物が使えるとは限らない。

**接する空間の既定は壁なので、扉を一枚も宣言しない二階建ては緑のまま完全に密封される。**外皮も自動では生えない — 領域を持たない空間(外部)との境界は導出されないので、外への `boundary` の書き忘れは黙って壁の不在になる。

動線は [`koyu doors`](cli/doors.md) が、判定は `koyu validate` が別に答える。

## 問いは合否を言わない

集計とグラフの問いは core が持つ。**ただし合否を言わない。**

| 問い | core が返すもの | 検証が言うこと |
|---|---|---|
| 採光 | 床面積と有効窓面積 | 1/7 を満たすか(`daylight.ratio`) |
| 敷地 | 敷地面積・接道長・建築面積・延べ面積・その商 | 2m の接道(`site.frontage`)・はみ出し(`site.escape`) |
| 縦動線 | 段数・蹴上げ・踏面・勾配 | 窮屈さ(`stair.proportion`)・勾配(`run.slope`) |
| 外皮 | 何にも面していない外周の線分 | それが穴か(`envelope.gap`) |
| 動線 | 最少扉数の経路と通行可能性 | 外部へ出られるか(`access.*`) |
| 柱と開口 | 通り芯から立つ柱と線分上の開口 | 重なっているか(`column.blocksdoor`) |

**閾値は建築の側にある。**1/7 も 2m も 240mm も、原本の構成が満たすべき不変量ではない。**数を返すところまでが core で、数に線を引くのが検証である。**

## 属性の三層

| 層 | 例 | core の態度 |
|---|---|---|
| **構造層** | パス・区画・レベル・関係の相手・`kind` | **必ず見る。**壊れていれば読まない |
| **解釈層** | `h` `use` `daylight` `road` `site` `style` … | 台帳が値域を定義し、**見る** |
| **運搬層** | `acme.sensor` `bems.temp` `survey.measured` … | **見ない。**名前空間つきで開いている |

**運搬層は名前空間(ドット区切り)を持つ。**名前空間を持たない未知のキーは**エラー**([ATT03](diagnostics/att.md))である — `heigh:2400` のような一字違いが黙って効かないことを防ぐためで、これが「見ていないこと」と「見て問題がないこと」を区別できる唯一の形である。

宣言が無ければ、見ていないことと見て問題がないことが区別できない。**その状態の「異常なし」は何も意味しない。持てるが判定しないは正当な状態であり、それを明示することが自由の条件である。**

## 隣り合う頁

- [凍る面](stability.md) — 何を壊さないと約束するか
- [同一性](identity.md) — uid が保証する範囲
- [持たないもの](not-held.md) — この記述の解像度
- [koyu check](cli/check.md) — 門番の使い方
- [koyu validate](cli/validate.md) — 判定の面
- [診断](diagnostics/index.md) — 65 のコード
- [判定](validate/index.md) — 15 の規則
