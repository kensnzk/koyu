# IFCX読解メモ

2026-07-22。buildingSMART/IFC5-development を読んだ記録。乗るためではなく、テキストとcompositionという同じ道具立てで他人がこの問題をどう解いたかを見るため (docs/writing-architecture.md「最初の一手」)。

## ファイルの解剖

.ifcx は素のJSONで、`header` (id・ifcxVersion "ifcx_alpha"・author・timestamp)、`imports` (他レイヤーのURI参照、integrityハッシュ付き)、`schemas` (属性の型定義)、`data` (ノードのフラットな配列) の四部からなる。ノードは `{ path, children?, inherits?, attributes? }` だけの小さな構造で、`children` が名前→UUIDの辞書として階層を張り、`inherits` がUSDのreference相当としてプロトタイプ (例: 窓インスタンス→windowType) を参照する。スキーマは `bsi::ifc::prop::FireRating` のように名前空間で切られた語彙として宣言される。TypeSpecによる形式定義が schema/ifcx.tsp にあり、実装より先に読むならここが最短。

## 合成 (composition) の実際

同じ path のノードを複数書くと重なり合う。hello-wall.ifcx 自身が一つのファイル内でこれをやっており (同じUUIDに三つのエントリが customdata・class・prop を別々に載せる)、ファイル間でも同じ機構で上書きできる。hello-wall-add-specific-fire-rating.ifcx はわずか631バイトのレイヤーで、UUID直指しと `uuid/My_Project/My_Site/My_Building/My_Storey/Wall/Window_001` という深いパス指しの両方で FireRating を足してみせる。**差分レイヤーがこの軽さで書けることが composition の価値のすべてで、ここは借りるべき機構である。**

## 観察 — 何が変わり、何が変わっていないか

hello-wall は壁一枚と窓二つの場面で、.ifcx が43KB、元の .ifc (SPF) が79KB ある。43KBの大半は `usd::usdgeom::mesh` の頂点座標列、つまりビルド成果物がソースに同梱されている分である。My_Space というノードは存在し、Boundary_Wall / Boundary_Window を子に持つ点は面白い (IfcRelSpaceBoundary の系譜) が、その境界自体が Body メッシュを持つ物の記述であり、場面の主語はあくまで IfcWall。**形式はテキストとcompositionに刷新されたが、記述の対象は建築物のままである。空いているのはこちら側、という原稿の見立てはファイルを読んでも変わらなかった。**

規模感の対比として: 壁一枚+窓二つがIFCXで43KB、koyuの二室一扉は22行 (0.7KB) で書けて平面図とグラフ問合せまで出る。場面が同一ではないので厳密な比較ではないが、記述対象を物から空間に替えると桁が変わることの感触には十分。

## 借りるもの / 借りないもの

借りるのは、パス名前空間を背骨にしたレイヤーの非破壊的な重ね合わせ、名前空間つき語彙 (`bsi::ifc::prop::…` の形式)、imports による外部レイヤー参照の発想。借りないのは、UUIDを主キーにした同一性 (koyuは人間可読パス。IFC GUIDは取り込み時に属性レイヤーで後置する)、メッシュの同梱 (形は生成物)、そして建築物のオントロジーそのもの。

## 手元の参照

クローンは作業環境の ~/work/ref/IFC5-development に置いた (Macでクローンする場合は `git clone https://github.com/buildingSMART/IFC5-development ~/Documents/github/IFC5-development`)。閲覧は https://ifc5.technical.buildingsmart.org/viewer/ で、examples/Hello Wall/ の .ifcx を複数枚ドロップするとレイヤー合成が確認できる。仕様の実体は schema/ifcx.tsp、例のFAQは Examples_FAQ.md。
