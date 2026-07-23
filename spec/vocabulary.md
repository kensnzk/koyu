# 語彙の台帳

原稿の方針「意味の与え方は、巨大なクラス階層ではなく語彙」を運用に落とした文書。要素ごとに何が付くか、どの語をツールが解釈するかの契約であり、開かれた語彙の「開き方」の規則である (ADR-0007 / ADR-0008)。

## 五つの規則

**1. kindは関係のトポロジーだけを言う。** boundaryのtype (wall/open/stair/shaft/void) はグラフ・導出・検査が構造として解釈する語で、増やすのは最後の手段。IFCが空間境界 (IfcRelSpaceBoundary) に Physical/Virtual しか言わせないのと同じ構えをとる。

**2. 物の名はspec語彙。** 手すり・RC・LGS・EW・ガラスパーティション… specの値は自由語で、ツールは解釈しない (運ぶだけ)。IFCで要素クラス (IfcRailing, IfcCurtainWall) にあたるものは、ここではspecの値である — 物は関係の属性、という転回の帰結。

**3. 解釈される属性は台帳に載せる。** ツールが読む属性 (下表の★) は契約であり、変えるときはADRを書く。それ以外の k:v は自由だが、同じ意味に別の語を使わないため、意味の定まった語はこの台帳に追記して育てる。台帳は一つ。

**4. 単位と形式。** 長さはmm、線分上の位置は0..1、面積の出力は㎡。属性キーは小文字英字、値は自由 (日本語可)、コアの値は英字。

**5. 継承と上書き。** `use` は zone→space に継承され、spaceの宣言が勝つ。`floor` は space→area が区間上書き。`spec` は boundary→seg が区間上書き。数えない分節 (area/seg) は上書きだけを運び、構成に影響しない (ADR-0003)。

## 要素別の台帳

### space
| 属性 | 解釈 | 意味 |
|---|---|---|
| type | ★一部 | 開かれた語彙。構造として解釈: `exterior` (外部)・`void` (吹抜け)。lightの対象: `unit` `room` `ldk` `bedroom` `living` |
| 領域 | ★ | `X?..X? Y?..Y?` を `+` で合併 (L字)。オフセット `X2+600` 可 |
| level: | ★ | 所属レベルの明示。既定はパス先頭セグメント。階を跨ぐくくり (メゾネット) で使う |
| h | ★ | 天井高mm (既定はレベルのh)。高さ不変量とlevelsが読む |
| use | ★ | statsの集計軸 (rentable/exclusive/common…)。zoneから継承 |
| hab | ★ | lightの対象制御 (1で追加、0で除外) |
| name / floor / … | — | 自由。floorはareaが上書きできる |

### boundary
| 属性 | 解釈 | 意味 |
|---|---|---|
| type | ★ | wall / open (水平) / stair / shaft / void (垂直)。既定 wall |
| t | ★ | 壁厚mm (芯振り分け)。描画と既定値100 |
| air | ★ | 1=遮蔽しない物 (手すり・柵)。半屋外の導出・細線描画・light 0.7 に効く |
| edge | ★ | 線分をa側矩形の特定の辺に限定 (N/E/S/W) |
| spec / fire / sound / h / … | — | 自由 (specは物の名。fire/soundはM2の区画クエリで解釈予定) |

### opening (boundaryの字下げ)
| 属性 | 解釈 | 意味 |
|---|---|---|
| kind | ★ | door (通行) / window (採光。通行しない) |
| w / h | ★ | 幅・高さmm。windowのhはlightが読む |
| at | ★ | 線分上の位置0..1 (既定0.5) |
| edge | ★ | 複数線分の辺選択 |
| hinge | ★ | 開き勝手: 吊元 (水平線分はW/E、垂直線分はN/S。既定は始端側) |
| swing | ★ | 開き勝手: 開く側 (a/b。既定はa=領域を持つ側) |
| sill / name / … | — | 自由 |

### level
`z` (位置引数)、`h` (基準天井高)、`slab` (床組み厚)、`pitch` (範囲宣言のみ) — すべて★。

### zone
`name` (自由)、`use` (★継承元)。幾何を持たない。

### area / seg (数えない分節)
位置 (areaは領域、segはat/w/edge — ★) + 任意の上書き属性 (—)。

## IFCとの対応 (参考)

boundary wall/open ↔ IfcRelSpaceBoundary の PHYSICAL/VIRTUAL。内外の別 ↔ InternalOrExternalBoundary (こちらは宣言でなく導出)。spec:手すり ↔ IfcRailing (要素クラスは語彙の値になる)。opening ↔ IfcOpeningElement + IfcDoor/IfcWindow。zone ↔ IfcZone。stair/shaft/void の垂直境界と slab の既定は、空間一次ゆえにIFCに直接の相当物を持たない。
