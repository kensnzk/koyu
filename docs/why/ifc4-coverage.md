---
title: IFC4 エンティティ対応表
mode: explanation
---

# IFC4 エンティティ対応表

IFC4 のスキーマを鏡にして、**koyu が何を書けるか・何をまだ書けないか・何を方針として書かないか**を並べた表である。参考であって契約ではない — 契約は [約束の範囲](../reference/scope.md) と [持たないもの](../reference/not-held.md) が持つ。

用語に馴染みが無ければ [前提: BIM・IFC・IfcSpace・USD](bim-ifc-usd.md) を先に読む。

| 記号 | 意味 |
|---|---|
| **●** | 対応 — 書ける、または導出される |
| **◐** | 部分対応 — 書けるが解釈が浅い |
| **○** | 未対応 — 計画にある |
| **—** | 方針として対象外 (理由を明記) |

## 規模の見取り図

IFC のスキーマ (IFC2x3/4/4x3 統合) の約 1,140 エンティティのうち、幾何・形状表現系が約 250、構造解析系が約 45、設備系が約 150、土木系が約 50、関係 (`IfcRel*`) が約 60 である。

**幾何表現の層 — IFC の物量の中核 — を「形は生成物」の方針が丸ごと原本から追放している。**これが koyu が小さい理由の骨格である。残る建築系コア (空間構造・建築要素・属性・数量) がこの表の主戦場になる。

## A. 空間構造

| IFC | 状態 | koyu での対応 |
|---|---|---|
| `IfcProject` / `IfcBuilding` / `IfcBuildingStorey` | ● | `name` 宣言・パス階層・[`level`](../reference/muro/level.md) (z / h / slab、レベルスパン)。矩計は `koyu levels` |
| `IfcSpace` | ● | [`space`](../reference/muro/space.md) — **二次的存在から一次要素への格上げが主題そのものである** |
| `IfcSpatialZone` / `IfcZone` | ● | [`zone`](../reference/muro/zone.md) (数える集約)。階を跨ぐくくりは `level:` 属性 |
| `IfcSite` (敷地) | ◐ | `zone … site:1` + 地上の外部空間 + [`polygon`](../reference/muro/polygon.md) (所与のジオメトリ)。接道・建蔽率・容積率は `koyu site` が導出。残: 測地座標と真北、建築面積の算入細則 |
| `IfcExternalSpatialElement` | ● | `/out` は方角・性格ごとの複数の `exterior` に割れる (道路は `road:` に幅員)。粒度は自由で、一枚岩も有効 |
| `IfcRelAggregates` (空間分解) | ● | パスの階層そのもの ([パスは住所であり、集計の階層である](paths.md)) |

## B. 空間境界

| IFC | 状態 | koyu での対応 |
|---|---|---|
| `IfcRelSpaceBoundary` (PHYSICAL / VIRTUAL) | ● | [`boundary`](../reference/muro/boundary.md) の `kind` が `wall` / `open`。**IFC では付随的な関係が、ここでは一次のグラフの辺である** |
| 同 (INTERNAL / EXTERNAL) | ● | 宣言ではなく導出 (相手が `exterior` か)。半屋外も `open` / `air:1` から導出 |
| 2nd Level 境界 (熱計算粒度) | — | 省エネ計算の粒度は対象外。必要になったら生成物の側で導出する |

## C. 建築要素

| IFC | 状態 | koyu での対応 |
|---|---|---|
| `IfcWall` / `IfcWallStandardCase` | ● | 壁 = 境界の属性 (`t` / `spec` / `fire` / `sound`)。**壁を置く操作は存在しない** |
| `IfcRailing` | ● | `spec` の自由語 + `air:1`。`kind` に物の名を入れない |
| `IfcSlab` (床) | ● | 書かない — `level` の `slab` が既定。不在は `void` 境界 |
| `IfcSlab.ROOF` / `IfcRoof` (屋根) | ◐ | **陸屋根は導出される** — 上に空間が重なっていない範囲に、上階の `slab` または既定の厚さで架かる。吹抜けにも架かる。残: 勾配屋根・庇・パラペット |
| `IfcDoor` / `IfcWindow` | ● | [`door`](../reference/muro/door.md) / [`window`](../reference/muro/window.md) (`w` / `h` / `at` / `edge`)、開き勝手 `hinge` / `swing`、明示位置 `at:X2+450` (はみ出し・重なりは検査)。建具の型は [`asset`](../reference/muro/asset.md)、開き方は `style:hinged/sliding/auto`。窓台 `sill` は運搬層。残: 折戸、防火設備の別 (`fire` は運搬層で解釈しない)、枠と納まり |
| `IfcOpeningElement` / `IfcRelVoids` / `IfcRelFills` | ● | 開口は境界の字下げ。**ブーリアンは存在しない** — 壁は最初から開口で割られた区間の列である ([平面図は水平断面ではない](plan-is-not-a-section.md)) |
| `IfcStair` / `IfcStairFlight` / `IfcRamp` | ● | 空間の属性 (`stair:N` / `ramp:N` / `escalator:N` / `lift:1`) と垂直境界。**段数・蹴上げ・踏面・踊り場・勾配はすべて導出される** — 領域と階高と上る向きだけから。窮屈さと勾配は `stair.proportion` / `run.slope` が判定する ([縦動線](../reference/muro/vertical-circulation.md)) |
| `IfcColumn` | ● | [`column`](../reference/muro/column.md) — **位置を書かない要素。**通り芯の交点と床の交わりから現れる。空しか支えない半屋外 (上に床の無い屋上テラス) には立たない。扉との重なりは `column.blocksdoor` が判定する |
| `IfcBeam` / `IfcMember` | — | 構造は物の別の層。梁は空間の一次モデルに座を持たない |
| `IfcCurtainWall` | ◐ | `spec` の自由語で書ける (解釈は無い)。大開口は `window` でも書ける |
| `IfcCovering` (仕上げ) | ◐ | 床は `floor` 属性 + [`area`](../reference/muro/area.md) (数えない分節)。天井は `ceiling:0` で「張らない」が言えるだけ。下がり天井マップ・仕上表は未 |
| `IfcBuildingElementProxy` | ◐ | 自由語彙 (型 / `spec`) で運べる |

## D. バルコニー — 床の延長か

IFC4 にバルコニー専用のエンティティは無い (実務は `IfcSlab` + `IfcRailing` + 外部 `IfcSpace` の組合せ)。

**koyu の答え: バルコニーは床の延長ではなく空間である。**そもそも床は原本に書かれないので、「床の延長か」という問いは物の言語に属する。空間として書き、半屋外は導出され、床は生成物である。手すりと立ち上がりの高さは境界の `h` が持つ (`spec:手すり air:1 h:1100`)。

残るのは**鉛直方向の複合プロファイル**である — 「RC 立ち上がり 1200 + 笠木手摺」のような断面は書けない。窓の `sill` / `h`、腰壁、立ち上がりを統一する語彙が要る。

## E. 属性・分類・材料・数量

| IFC | 状態 | koyu での対応 |
|---|---|---|
| `IfcPropertySet` / `IfcProperty` | ● | 開かれた `key:value` + [属性の台帳](../reference/muro/attributes.md)。台帳に無いキーは名前空間が要る ([語彙が開いている理由](open-vocabulary.md)) |
| `IfcTypeObject` / `IfcRelDefinesByType` | ◐ | [`asset`](../reference/muro/asset.md) が建具の型を持つ。建具以外の型 (壁種別など) は `spec` の自由語のまま |
| `IfcElementQuantity` (数量) | ◐ | **数量は宣言せず導出する** (`koyu stats` / `koyu light`)。壁芯固定で、内法・容積対象・区画面積の規約は未 |
| `IfcClassification` (外部分類) | ○ | 台帳と外部辞書 (bSDD / Uniclass / 室用途コード) の橋。未着手 |
| `IfcMaterial` / `IfcMaterialLayerSet` | ◐ | `spec` は名前だけ。層構成は実施設計の情報であり、合成の後段レイヤーの候補 |
| `IfcGrid` | ● | [`grid`](../reference/muro/grid.md) (通り芯 + オフセット) |
| `IfcOwnerHistory` | ● | **持たない — git が履歴である** |

## F. 敷地の外・都市

| IFC | 状態 | koyu での対応 |
|---|---|---|
| `IfcGeographicElement` (外構) | ○ | アプローチ・駐車場・植栽・舗装。外部空間の分節 + 外構語彙 |
| `IfcMapConversion` / `IfcProjectedCRS` (測地) | ○ | 真北と測地座標。採光・日影の方位、都市データ接続の前提 |
| IFC4x3 土木 (道路・鉄道・橋梁・トンネル 約 50) | — | 対象外 (建築に絞る) |

## G. 方針として対象外

| IFC 領域 | 理由 |
|---|---|
| 幾何・形状表現 (約 250) | **形は生成物。**原本に形を持たないことが主題である |
| 構造解析系 (`IfcStructural*` 約 45) | 構造は物の別の層 |
| 設備系 (約 150) | 対象外。PS・EV・機械室は空間として既に書ける |
| プロセス・コスト (`IfcTask` / `IfcCostItem` 等) | 探求の範囲外 |
| 資産管理・センサー (`IfcAsset` / `IfcSensor` 等) | 動的な状態は原本に入れない。パスが外部キーになる |
| スタイル・表示 (`IfcStyledItem` 等) | 描画はツールの仕事。原本は構成 |

## 対応の思想

IFC の「エンティティ」は、koyu では三つのどれかに落ちる。

1. **構造として解釈される少数の語** — `kind` と、台帳の解釈層の属性
2. **開かれた語彙の値** — 型と `spec`。`IfcRailing` も `IfcCurtainWall` もここ
3. **導出される生成物** — 数量・幾何・内外の別・段数・柱・屋根

**エンティティを増やさずにカバレッジを広げるのがこの設計の賭けであり、この表はその検算である。**

そして**カバー率は価値ではない。**足せば機械の視野から外れ、目的が壊れる ([このデータの解像度](resolution.md))。○ の行は「いつか埋める穴」ではなく、**埋めるかどうかを五つの問いで判断する候補**である ([語彙が開いている理由](open-vocabulary.md))。

## この先

- [koyu と IFC4・IFCX・BOT・USD](vs-ifc.md) — トークン実測つきの比較
- [このデータの解像度](resolution.md)
- [持たないもの](../reference/not-held.md)
