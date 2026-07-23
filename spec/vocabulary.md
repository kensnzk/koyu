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
| type | ★一部 | 開かれた語彙。構造として解釈: `exterior` (外部 — 複数に割れる: /out/road等)・`void` (吹抜け)。lightの対象: `unit` `room` `ldk` `bedroom` `living` |
| road | ★ | exterior空間の幅員mm — 道路の印。siteコマンドが接道を導出する (ADR-0009) |
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
| (先頭トークン) | ★ | 建具アセットの参照 (`door SD1 …` — Reference)。アセットの属性が既定になり、インスタンスが上書きする (ADR-0010) |
| w / h | ★ | 幅・高さmm。windowのhはlightが読む |
| at | ★ | 位置。比率0..1 (既定0.5、線分内にクランプ) または通り芯参照 `at:X2+450` (絶対 — クランプせず、はみ出し・軸違い・開口同士の重なりはエラー) |
| edge | ★ | 複数線分の辺選択 |
| hinge | ★ | 開き勝手: 吊元 (水平線分はW/E、垂直線分はN/S。既定は始端側) |
| swing | ★ | 開き勝手: 開く側 (a/b。既定はa=領域を持つ側) |
| style | ★ | 建具の型: hinged (開き戸・既定) / sliding (引き戸) / auto (自動ドア)。平面の建具表現が変わる |
| sill / name / … | — | 自由 |

### asset (建具アセット — ADR-0010)
`asset 名 door|window 属性…` — 参照される既定値の束 (RevitのFamily、USDのReference)。第4の要素ではなく、開口の属性の出所を一箇所にするだけ。kindは参照する開口と一致していなければならない。名前の重複は合成時もエラー。

### polygon (敷地形状 — ADR-0011)
`polygon /ゾーンパス x,y x,y x,y ...` — 所与のジオメトリ (測量由来)。この記法で唯一「書かれる形」で、site:1のゾーンに対応する (無ければ警告)。導出面積 (シューレース)・建物のはみ出し検査・配置図の敷地境界線をツールが解釈する (★)。別ファイル+importの隔離レイヤー運用を標準とする。

### import (合成 — ADR-0010)
`import ./L1.muro` — 書かれたファイルからの相対パス。base層が基盤 (koyu/name/unit/grid/level) を一度だけ宣言し、層は空間・境界・ゾーン・アセットを加算する。衝突 (空間パス・アセット名の重複、grid/nameの再宣言) は出所つきのビルドエラー。同一ファイルの二重importは冪等。

### level
`z` (位置引数)、`h` (基準天井高)、`slab` (床組み厚)、`pitch` (範囲宣言のみ) — すべて★。

### zone
`name` (自由)、`use` (★継承元)、`site` (★ 1=敷地の集約 — siteコマンドの対象)、`area` (★ 敷地の宣言面積㎡ — 導出面積と照合される)。幾何を持たない。

### area / seg (数えない分節)
位置 (areaは領域、segはat/w/edge — ★。segのatも通り芯参照可) + 任意の上書き属性 (—)。

## IFCとの対応 (参考)

boundary wall/open ↔ IfcRelSpaceBoundary の PHYSICAL/VIRTUAL。内外の別 ↔ InternalOrExternalBoundary (こちらは宣言でなく導出)。spec:手すり ↔ IfcRailing (要素クラスは語彙の値になる)。opening ↔ IfcOpeningElement + IfcDoor/IfcWindow。asset ↔ IfcDoorType/IfcWindowType (タイプとオカレンス — RevitのFamily)、style ↔ IfcDoorTypeOperationEnum の粗い射影 (SINGLE_SWING/SLIDING…)。zone ↔ IfcZone。stair/shaft/void の垂直境界と slab の既定は、空間一次ゆえにIFCに直接の相当物を持たない。importの合成はIFC4に相当物がなく (単一ファイルが原則)、IFCX/USDのレイヤー合成に対応する。
