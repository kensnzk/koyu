# IFCカバレッジ — IFC4建築系コアとの照合表

IFC4のスキーマを鏡にして、IFCXSが何を書けるか・何をまだ書けないか・何を方針として書かないかを管理する台帳。原本はこのファイルで、未対応 (○) と部分対応 (◐) はLinearの別プロジェクト [IFCXS × IFC カバレッジ] のIssueと対応する。更新の作法: 実装や決定が動いたらこの表を先に直し、対応Issueを閉じる。

記号: **●** 対応 (書ける・解釈される) / **◐** 部分対応 (書けるが解釈が浅い) / **○** 未対応 (計画 — Issueあり) / **—** 方針として対象外 (理由を明記)

## 規模の見取り図 (概算)

web-ifc同梱スキーマ (IFC2x3/4/4x3統合) のエンティティ約1,140のうち、幾何・形状表現系が約250、構造解析系が約45、設備系が約150、土木系 (4x3) が約50、関係 (IfcRel*) が約60。**幾何表現の層 — IFCの物量の中核 — を「形は生成物」の方針が丸ごと原本から追放している**ことが、IFCXSが小さい理由の骨格である。残る建築系コア (空間構造・建築要素・属性・数量) がこの表の主戦場になる。

## A. 空間構造 (Spatial Structure)

| IFC | 状態 | IFCXSでの対応 |
|---|---|---|
| IfcProject / IfcBuilding / IfcBuildingStorey | ● | name宣言・パス階層・level宣言 (z/h/slab、範囲宣言)。矩計は`levels` |
| IfcSpace | ● | space — 二次的存在から一次要素への格上げが主題そのもの |
| IfcSpatialZone / IfcZone | ● | zone (数える集約 — ADR-0005)。階を跨ぐくくりはlevel:属性 (ADR-0008) |
| IfcSite (敷地) | ◐ | zone site:1 + 地上の外部空間 (庭・通路) がL1上で建物をタイル (ADR-0009)。敷地面積は宣言/導出を照合、接道・建蔽率・容積率は `site` が導出。残: GL/FL段差・測量座標 (MUN-159)、建築面積の算入細則 (MUN-158) |
| IfcExternalSpatialElement (外部空間) | ● | /outは方角・性格ごとの複数exterior空間に割れる (道路は road:幅員)。粒度自由・一枚岩も有効。延焼ラインの実計算は距離幾何が要るため残 (MUN-157系) |
| IfcRelAggregates (空間分解) | ● | パス階層そのもの |

## B. 空間境界 (Space Boundaries)

| IFC | 状態 | IFCXSでの対応 |
|---|---|---|
| IfcRelSpaceBoundary (PHYSICAL/VIRTUAL) | ● | boundary kind wall/open。IFCでは付随的な関係が、ここでは一次のグラフの辺 |
| 同 (INTERNAL/EXTERNAL) | ● | 宣言でなく導出 (相手がexteriorか)。半屋外もopen/air:1から導出 (ADR-0007) |
| 2nd Level境界 (熱計算粒度) | — | 省エネ計算の粒度は当面対象外。必要になったら生成物側で導出 |

## C. 建築要素 (Shared Building Elements)

| IFC | 状態 | IFCXSでの対応 |
|---|---|---|
| IfcWall / IfcWallStandardCase | ● | 壁=境界の属性 (t/spec/fire/sound)。壁を置く操作は存在しない |
| IfcRailing | ● | spec語彙 + air:1 (ADR-0007 — kindに物の名を入れない) |
| IfcSlab (床) | ● | 書かない — levelのslabが既定。不在はvoid境界 (ADR-0006) |
| IfcSlab.ROOF / IfcRoof (屋根) | ○ | Rレベル (上限面) のみ。庇・勾配・パラペット、半屋外の屋根有無 (庇下/吹きさらし)。→ Issue「屋根」 |
| IfcDoor / IfcWindow | ◐ | opening (w/h/at/sill) + 開き勝手hinge/swing。建具の型 (開き戸/引戸/折戸)・防火設備の別・建具表は未。→ Issue「建具語彙」 |
| IfcOpeningElement / RelVoids / RelFills | ● | 開口は境界の字下げ。ブーリアンは存在しない (形が無いので) |
| IfcStair / IfcStairFlight / IfcRamp | ◐ | 空間 (type:stair) + 垂直境界 (type:stair) として動線は書ける。段数・蹴上げ・踏面が階高から成立するかの検査、スロープ勾配は未。→ Issue「階段・スロープの成立検査」 |
| IfcColumn / IfcBeam / IfcMember | ○ | 方針は「構造は物の別レイヤー」だが、柱型の室内への出っ張りは基本計画に効く。最小記述を検討。→ Issue「柱・梁の最小記述」 |
| IfcCurtainWall | ◐ | spec語彙で書ける (解釈なし)。大開口はwindow/segでも書ける |
| IfcCovering (床仕上げ) | ◐ | floor属性 + area (数えない分節)。天井 (下がり天井マップ・仕上表) は未。→ Issue「天井と仕上げ」 |
| IfcBuildingElementProxy | ◐ | 自由語彙 (type/spec) で運べる |

## D. バルコニー・立ち上がり (問い: 床の延長か?)

IFC4にバルコニー専用エンティティは無い (実務はIfcSlab+IfcRailing+外部IfcSpaceの組合せ)。IFCXSの答え: **バルコニーは床の延長ではなく空間である** — そもそも床は原本に書かれないので、「床の延長か」という問いは物の言語に属する。空間として書き (半屋外は導出)、床は生成物。手すり・立ち上がりの高さは境界のh属性が持つ (`spec:手すり air:1 h:1100`)。ただし「RC立ち上がり1200+笠木手摺」のような**鉛直方向の複合プロファイル**は未対応 — windowのsill/h、腰壁、立ち上がりを統一する語彙が要る。→ Issue「立ち上がり・パラペット (境界の鉛直プロファイル)」

## E. 属性・分類・材料・数量

| IFC | 状態 | IFCXSでの対応 |
|---|---|---|
| IfcPropertySet / IfcProperty | ● | 開かれたk:v属性 + 語彙の台帳が契約 (ADR-0008) |
| IfcElementQuantity (数量) | ◐ | 数量は宣言せず導出 (stats/light)。壁芯固定 — 内法・容積対象・区画面積の規約は未。→ Issue「面積規約」 |
| IfcClassification (外部分類) | ○ | 台帳と外部辞書 (bSDD/Uniclass/日本の室用途コード) の橋。→ Issue「外部分類への参照」 |
| IfcMaterial / IfcMaterialLayerSet | ◐ | specは名前だけ。層構成は実施の情報 — 後段レイヤー (composition) の最初の実験台候補。→ Issue「材料の層構成」 |
| IfcGrid | ● | grid宣言 (通り芯+オフセット) |
| IfcOwnerHistory | ● | 持たない — gitが履歴 (原稿の主張どおり) |

## F. 敷地の外・都市

| IFC | 状態 | IFCXSでの対応 |
|---|---|---|
| IfcGeographicElement (外構) | ○ | アプローチ・駐車場・植栽・舗装。外部空間の分節+外構語彙。→ Issue「外構」 |
| IfcMapConversion / IfcProjectedCRS (測地) | ○ | 真北・測地座標。採光/日影の方位、CityGML/PLATEAU接続の前提。→ Issue「測地座標と真北」 |
| IFC4x3土木 (道路・鉄道・橋梁・トンネル 約50) | — | 対象外 (建築に絞る) |

## G. 方針として対象外 (原稿「扱わないこと」の帰結)

| IFC領域 | 理由 |
|---|---|
| 幾何・形状表現 (約250エンティティ) | 形は生成物。原本に形を持たないことが主題 |
| 構造解析系 (IfcStructural* 約45) | 構造は物の別レイヤー (柱・梁の最小記述のみ検討 — C参照) |
| 設備系 (約150) | 当面対象外。PS/EV/機械室は空間として既に書ける。EVかご寸法等の語彙は Issue「昇降機の語彙」に軽く積む |
| プロセス・コスト (IfcTask/IfcCostItem等) | 探求の範囲外 |
| 資産管理・センサ (IfcAsset/IfcSensor等) | 地平 (デジタルツイン) — 実測レイヤーの設計時に再訪 |
| スタイル・表示 (IfcStyledItem等) | 描画はツールの仕事。原本は構成 |

## 対応の思想 (要約)

IFCの「エンティティ」は、IFCXSでは三つのどれかに落ちる: **構造として解釈される少数の語** (kind/解釈属性 — 台帳の★)、**開かれた語彙の値** (spec/type — IfcRailingやIfcCurtainWallはここ)、**導出される生成物** (数量・幾何・内外の別)。エンティティを増やさずにカバレッジを広げるのがこの設計の賭けであり、この表はその検算である。
