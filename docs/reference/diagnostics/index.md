---
title: 診断コード索引
mode: reference
---

# 診断コード索引

`koyu check` が返すメッセージの全目録である。コードは **65**、族は **19**、内訳は error 49 件・warning 16 件。この頁はどのコードがどの族に属し、どの重さを持つかを一枚で見せる。原因と最小の再現と直し方は族ごとの頁にある。

`check` が言うのは**書かれたものがデータとして矛盾していないか**までである。建物として使えるかは言わない — それは `koyu validate` の 15 の規則が別に言う。二つは型からして別で、`check` は `Diagnostic { code, severity }` を返し、`validate` は `Finding { rule, level }` を返す。コードの綴り (3字+2桁) と規則の綴り (`site.escape` のような `章.規則`) も字面で見分けがつく。

**人向けの `check` はコードを表示しない。**この索引を引く前に `--json` を付けてコードを手に入れる — 手順は[診断を読む](reading.md)にある。

## severity は二つしかない

| severity | 意味 | `check` の終了コード | `check --strict` の終了コード |
|---|---|---|---|
| `error` | 構成が成立していない。書かれた構成から一意な形が作れない | 1 | 1 |
| `warning` | 疑わしい。成立はしていて、形も一意に決まる | 0 | 1 |

severity はコードの不変属性である。**同じコードが場合によって error になったり warning になったりはしない。**重さを変える必要が出たときは、既存コードの severity を動かさず、新しいコードを切る。

## 症状から引く

| 症状 | 見るコード |
|---|---|
| 境界を書いたのに「接していない」と言われる | [BND04](bnd.md#bnd04) |
| 扉や窓を置いたら「線分が複数あります」と言われる | [OPN05](opn.md#opn05) |
| 外壁に窓を開けたいのに置けない | [OPN04](opn.md#opn04) [OPN05](opn.md#opn05) |
| 階段や吹抜けを書いたのに叱られる | [VRT01](vrt.md#vrt01) [VRT02](vrt.md#vrt02) [VRT03](vrt.md#vrt03) |
| 階段に扉を書いたら「解釈されません」と言われる | [VRT05](vrt.md#vrt05) |
| 空間を並べたら「領域が重なっています」と言われる | [GEO02](geo.md#geo02) |
| 住戸を室に割ろうとして重なりを叱られる | [GEO02](geo.md#geo02) — 直し方は割付ではない |
| 境界のパスを書いたら「未定義」と言われる | [REF01](ref.md#ref01) |
| 床材を貼った `area` が通らない | [SEG01](seg.md#seg01) [SEG02](seg.md#seg02) |
| レベルを書いたつもりが「レベルが特定できません」と言われる | [SUF02](suf.md) |
| 階高の検算が通らない | [HGT01](hgt.md) [HGT02](hgt.md) |
| 天井高や床組み厚を書かずに、天井も床も生成されていない | [SUF01](suf.md) [SUF03](suf.md) |
| 属性を書いたのに効いていない | [ATT01](att.md) [ATT02](att.md) [ATT03](att.md) |
| 敷地の数字が合わない | `check` は言わない — `koyu validate` の `site.escape` / `site.area` が言う |
| 階段の踏面や勾配が窮屈 | `check` は言わない — `koyu validate` の `stair.proportion` / `run.slope` が言う |
| 外皮に穴が開いている | `check` は言わない — `koyu validate` の `envelope.gap` が言う |
| ファイルが1行も読まれずに落ちる | [SYN01](syn.md) |

## 全コード

並びは台帳の順である。

### REF — 参照 (1)

| コード | severity | 一文 |
|---|---|---|
| [REF01](ref.md#ref01) | error | 未定義の空間を参照しています |

### BND — 境界 (6)

| コード | severity | 一文 |
|---|---|---|
| [BND01](bnd.md#bnd01) | error | 同じ空間同士の境界は書けません |
| [BND02](bnd.md#bnd02) | error | 境界が重複しています |
| [BND03](bnd.md#bnd03) | error | 異なるレベルの空間に壁境界は書けません |
| [BND04](bnd.md#bnd04) | error | 空間が接していないため境界を導けません |
| [BND05](bnd.md#bnd05) | warning | 同じ空間対に edge 限定つきと無しの境界が併存しています |
| [BND06](bnd.md#bnd06) | warning | 外周に残る辺が無く、境界線分がゼロです |

### LVL — レベル (1)

| コード | severity | 一文 |
|---|---|---|
| [LVL01](lvl.md) | error | 二つのレベルの z が同じです |

### GEO — 領域の重なり (2)

| コード | severity | 一文 |
|---|---|---|
| [GEO01](geo.md#geo01) | error | 一つの空間の領域同士が重なっています |
| [GEO02](geo.md#geo02) | error | 二つの空間の領域が重なっています |

### VRT — 垂直境界 (6)

| コード | severity | 一文 |
|---|---|---|
| [VRT01](vrt.md#vrt01) | error | 垂直境界は領域とレベルを持つ空間同士に書きます |
| [VRT02](vrt.md#vrt02) | error | 垂直境界は隣り合うレベルの間に書きます |
| [VRT03](vrt.md#vrt03) | error | 垂直境界の空間が平面上で重なっていません |
| [VRT04](vrt.md#vrt04) | warning | void 境界の上側が `type:void` ではありません |
| [VRT05](vrt.md#vrt05) | warning | 垂直境界の開口は解釈されません |
| [VRT06](vrt.md#vrt06) | warning | 垂直境界の `seg` は解釈されません |

### OPN — 開口 (8)

| コード | severity | 一文 |
|---|---|---|
| [OPN01](opn.md#opn01) | error | `hinge` の軸違い |
| [OPN02](opn.md#opn02) | error | 開口同士が重なっています |
| [OPN03](opn.md#opn03) | warning | open 境界の開口は通行に影響しません |
| [OPN04](opn.md#opn04) | error | 開口を置ける境界線分がありません |
| [OPN05](opn.md#opn05) | error | 境界線分が複数あって曖昧です |
| [OPN06](opn.md#opn06) | error | 開口の幅が境界線分の長さを超えています |
| [OPN07](opn.md#opn07) | error | 開口の明示位置の軸違い |
| [OPN08](opn.md#opn08) | error | 開口の明示位置が線分からはみ出します |

### SEG — 数えない分節 (8)

`area` (室の内側) が SEG01・SEG02、`seg` (境界の上) が SEG03〜SEG08 である。

| コード | severity | 一文 |
|---|---|---|
| [SEG01](seg.md#seg01) | error | 領域を持たない空間に `area` は書けません |
| [SEG02](seg.md#seg02) | warning | `area` が領域からはみ出しています |
| [SEG03](seg.md#seg03) | warning | open 境界の `seg` は解釈されません |
| [SEG04](seg.md#seg04) | error | `seg` を置ける境界線分がありません |
| [SEG05](seg.md#seg05) | error | `seg` の境界線分が複数あって曖昧です |
| [SEG06](seg.md#seg06) | error | `seg` の幅が境界線分の長さを超えています |
| [SEG07](seg.md#seg07) | error | `seg` の明示位置の軸違い |
| [SEG08](seg.md#seg08) | error | `seg` の明示位置が線分からはみ出します |

### ZON — ゾーン (2)

| コード | severity | 一文 |
|---|---|---|
| [ZON01](zon.md) | warning | ゾーンの下に空間がありません |
| [ZON02](zon.md) | warning | ゾーンと同じパスの空間があります |

### HGT — 高さの不変量 (2)

| コード | severity | 一文 |
|---|---|---|
| [HGT01](hgt.md) | error | 上階の床に食い込みます |
| [HGT02](hgt.md) | error | 部分吹抜けの被覆が足りません |

### SUF — 充足性 (4)

| コード | severity | 一文 |
|---|---|---|
| [SUF01](suf.md) | error | 天井高が決まらず、天井も屋根も生成できません |
| [SUF02](suf.md) | error | レベルが特定できず、立体が一つも生成できません |
| [SUF03](suf.md) | warning | レベルに `slab` が無く、床が一枚も生成されません |
| [SUF04](suf.md) | warning | 縦動線の宣言に対して形が一つも生成されません |

### SIT — 敷地形状 (3)

| コード | severity | 一文 |
|---|---|---|
| [SIT01](sit.md) | error | 敷地形状に重複する頂点があります |
| [SIT02](sit.md) | error | 敷地形状が自己交差しています |
| [SIT04](sit.md) | warning | `polygon` に対応するゾーンがありません |

SIT03 と SIT05 は[欠番](retired.md)である。

### UID — 同一性 (4)

| コード | severity | 一文 |
|---|---|---|
| [UID01](uid.md) | error | `uid` は数字だけのトークンにできません |
| [UID02](uid.md) | error | `uid` に空白は使えません |
| [UID03](uid.md) | error | `uid` が重複しています |
| [UID04](uid.md) | error | 同じ対象の中で `name` が重複しています |

### ATT — 属性 (3)

| コード | severity | 一文 |
|---|---|---|
| [ATT01](att.md) | error | 属性は正の数値で書きます |
| [ATT02](att.md) | error | 属性の値が台帳の語彙にありません |
| [ATT03](att.md) | error | 台帳に無い属性キーで、名前空間もありません |

### DAY — 採光の対象 (1)

| コード | severity | 一文 |
|---|---|---|
| [DAY01](day.md) | error | `daylight` は 1 (採光判定の対象) か 0 (対象外) です |

### RUN — 縦動線 (4)

| コード | severity | 一文 |
|---|---|---|
| [RUN01](run.md) | error | 一つの空間に縦動線の宣言が複数あります |
| [RUN02](run.md) | error | 縦動線の値は上る向き N/E/S/W です |
| [RUN03](run.md) | error | 縦動線の領域が矩形一つでない、またはレベルが不明です |
| [RUN05](run.md) | error | `form` の値が不正、または形が決まりません |

RUN04・RUN06・RUN07・RUN08 は[欠番](retired.md)である。

### LIN — 描かれた線 (3)

| コード | severity | 一文 |
|---|---|---|
| [LIN01](lin.md) | error | 線が二つの空間を分離していません |
| [LIN02](lin.md) | error | 垂直境界に線は描けません |
| [LIN03](lin.md) | warning | 線が何も切っていません |

### COL — 柱 (2)

| コード | severity | 一文 |
|---|---|---|
| [COL01](col.md) | warning | 宣言に対して立つ柱が0本です |
| [COL02](col.md) | warning | 同じ交点に先の柱宣言が立っています |

### VER — 言語版の受理条件 (4)

| コード | severity | 一文 |
|---|---|---|
| [VER01](ver.md) | error | koyu 0.1 のファイルに、境界が宣言されていない接触ペアがあります |
| [VER02](ver.md) | error | koyu 0.3 以前のファイルに `daylight` の無い居室型があります |
| [VER03](ver.md) | error | koyu 0.4 以前のファイルに 0.5 の語があります |
| [VER04](ver.md) | error | koyu 0.5 以前のファイルに 1.0 の語があります |

### SYN — 構文・合成 (1)

| コード | severity | 一文 |
|---|---|---|
| [SYN01](syn.md) | error | 構文または合成のエラー |

SYN01 は個別の検査ではなく、読み込みが投げた例外を一件に写したものである。**`check --json` のときにだけ現れる** — `--json` を付けない `check` は例外をそのまま印字して終了コード1で終わる。

## 欠番

**番号は再利用しない。**過去の出力が読めなくなるからである。11 の番号が欠番で、そのうち 6 つは `koyu validate` の規則へ、4 つは SUF の族へ移った。何が何に置き換わったかは[欠番の診断コード](retired.md)にある。

`BND07` `HGT03` `HGT04` `HGT05` `RUN04` `ENV01` `RUN06` `RUN07` `RUN08` `SIT03` `SIT05`

## check が緑でも見ていないこと

**緑は「構成がデータとして矛盾しておらず、書かれた構成から形が作れる」までを意味する。**建築としての妥当性については何も言わない。特に次の二つは緑のまま通り抜ける。

**閉じた建物。**接する空間の既定は壁であり、壁は扉が無ければ通れない。扉を一枚も書かない二階建ては緑のまま完全に密封される。

```sh
koyu doors <file> /L2/bed /out/road
```

これが「到達できません」と答えたら、動線が繋がっていない。`koyu validate` の `access.unreachable` も同じことを違反として言う。

**採光。**窓を一枚も書かなくても緑になる。`koyu light <file>` が居室ごとの 1/7 判定を出し、`koyu validate` の `daylight.ratio` が違反として言う。

`check` の呼び方と旗は [koyu check](../cli/check.md) に、判定の側は [koyu validate](../cli/validate.md) にある。
