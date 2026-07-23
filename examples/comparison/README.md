# 同じ二室一扉を三つの世界で書く

examples/two-rooms.muro と同じ場面 — 3.6m×4.5mの室二つ、界壁の扉、玄関 — を、IFC4 (SPF) と IFCX (IFC5 alpha) でも作った。記述の対象を「建築物 (物)」から「建築 (空間)」に取り替えると何が起きるかを、行数とバイト数と答えられる問いで見るための比較である。

| 形式 | 主語 | 行数 | サイズ |
|---|---|---|---|
| koyu DSL (原本) | 空間と境界 | 22 | 0.6 KB |
| koyu 正準JSON (機械形式) | 同上 | 111 | 1.6 KB |
| IFC4 手書き最小 (two-rooms.ifc) | 部材 | 152 | 7.3 KB |
| IFCX alpha (two-rooms.ifcx) | 部材 + メッシュ同梱 | 1,031 | 20 KB |

参考として、IFC5-development の hello-wall は壁1枚+窓2つの場面で .ifc が79KB、.ifcx が43KBある (オーサリングツール経由の現実的な出力)。BLCJ級の実務モデルなら数十MBになる。

## IFC4版で起きること (two-rooms.ifc)

152行は徹底的にごまかした理想化最小である。プロパティセット・材料・スタイル・OwnerHistory・接合処理を全部落とし、形状は矩形押し出しのみ、名前はASCIIのみ。それでもこの量になるのは、壁5枚・開口2・扉2をそれぞれ物として置き、プロファイル→押し出し→形状表現→配置の階段を要素ごとに登る必要があるからだ。空間はIfcSpaceとして2つ入れ、IfcRelSpaceBoundaryを8本手で張ったが、境界の接続ジオメトリは省略した — 実務の書き出しで最も欠落しやすいのがまさにここで、IfcSpace自体が書き出されないことも珍しくない。

「aから外へ扉をいくつ通るか」に答えるには、Space→RelSpaceBoundary→Wall→RelVoids→Opening→RelFills→Door と5段の関係を辿った上で、なお「その扉がどの空間とどの空間を繋ぐか」はデータに無いため幾何から推定することになる。koyuでは `npm run koyu -- doors examples/two-rooms.muro /L1/a /out` が即答する (2枚)。

検証は ThatOpen の web-ifc で行った (`npx tsx examples/comparison/validate-ifc.ts examples/comparison/two-rooms.ifc`)。IfcWall×5 / IfcSpace×2 / IfcDoor×2 / IfcOpeningElement×2 / IfcRelSpaceBoundary×8 が読め、ブーリアン込みで7つのメッシュが組み上がる。

## IFCX版で起きること (two-rooms.ifcx)

hello-wall.ifcx の流儀 (UUIDパス、childrenによる階層、bsi::ifc::classによる分類、usd::usdgeom::meshの同梱) に倣って生成した。1,031行のうち72%がメッシュ座標である。形式はJSONになり、レイヤー合成という強力な機構を得たが (hello-wallでは631バイトの差分レイヤーで耐火性能を足せる)、場面の原本がビルド成果物 (メッシュ) を抱えて肥大する構造は変わらない。主語も依然IfcWallだ。なお開口のブーリアンは省略し扉を壁の子の箱として置いた近似であり、alpha仕様への厳密な準拠は保証しない。https://ifc5.technical.buildingsmart.org/viewer/ にドロップすれば見られるはずである。

## 読み取るべきこと

同じ場面の情報量の桁が 0.6KB / 7.3KB / 20KB と並ぶのは、形式の巧拙ではなく主語の違いによる。IFC4もIFCXも形が原本なので任意の形状を運べるが、構成 (どの空間がどう繋がるか) は関係の網から掘り出すか幾何から推定するしかない。koyuは構成が原本なのでグラフへの問いとdiffと生成が無料になるが、形は直交グリッドの生成規則が届く範囲しか出せない。これは対称なトレードオフではない — 設計の決定は構成の側でなされ、形は決定の帰結だからだ、というのがこの探求の賭けである (docs/writing-architecture.md)。

## 再現

```sh
npx tsx examples/comparison/gen-ifc4.ts > examples/comparison/two-rooms.ifc
npx tsx examples/comparison/gen-ifcx.ts > examples/comparison/two-rooms.ifcx
npx tsx examples/comparison/validate-ifc.ts examples/comparison/two-rooms.ifc
```

UUIDとGUIDは名前から決定的に導いているので、生成し直しても差分は出ない。
