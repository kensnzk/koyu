# koyu (戸牖) — 建築を書く

[English](README.md)

> 鑿戸牖以為室、当其無、有室之用 — 老子 第十一章

空間を一次要素とするテキストネイティブな建築記述の探求。壁は物ではなく二つの空間の境界という関係であり、形はソースではなく生成物である。建物一棟を数百行のテキストで書き、git・LLM・都市データと同じ土俵に載せることを狙う。主張の全文は [docs/writing-architecture.md](docs/writing-architecture.md)。

二室一扉はこう書く (全文 [examples/two-rooms.muro](examples/two-rooms.muro)):

```
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000
```

ここから平面図が生成される。壁を描く操作はどこにも無い — 壁は空間の割付から導出される。

![二室一扉の平面図](docs/img/two-rooms.svg)

2フロアのオフィス (廊下・コア・通り芯オフセット壁・階段/EV・高さの整合つき) でも約100行 ([examples/office.muro](examples/office.muro))。解像度は基本計画レベル — 垂れ壁を表現しないのは省略ではなく抽象度の選択で、計画初期にBIMが重すぎたという弱点の裏側がこの記述の主戦場である。高さ方向の一貫性は「天井高+上階slab ≤ 階高」という宣言された不変量の検査で担保する (ADR-0002)。

![オフィス1階平面図](docs/img/office-L1.svg)

10階建て内廊下型集合住宅 (43戸、EV+屋外階段、屋上、Aタイプは間取り込み) は **183行** ([examples/mansion.muro](examples/mansion.muro))。基準階は一度だけ書き、`/L2..L9/A` のスパンが8フロアへ展開される (ADR-0004)。L字のLDKは矩形の合併、住戸は `zone` (数える集約) で間取りに割っても専有面積の言葉を保つ (ADR-0005)。吹抜けは `type:void` の垂直境界 — 床の不在も境界で書く (ADR-0006)。`doors` が「9階のLDKから地上まで扉3枚」に、`light` が住居系居室の1/7採光に即答する。

![集合住宅基準階平面図](docs/img/mansion-L5.svg)

全機能のショーケースが **[examples/tower/](examples/tower/)** — 低層商業+高層住宅の11階建て複合ビル (PH付き、延床約4,786㎡) を8ファイルで合成したもの。敷地は不整形の五角形で、敷地形状はこの記法で唯一「書かれる形」(`polygon`、ADR-0011) — 敷地の形は測量由来の所与であって設計の生成物ではないから。隔離レイヤー (site-geometry.muro) に置かれ、導出面積・建物のはみ出し検査・配置図の敷地境界線がそこから出る。他は記法の全部が一棟に載っている: 2層吹抜け、噛み合うL字住戸、バルコニー、例外階の**差分レイヤー**として書かれた低層部屋根のテラス、自動ドア入りの建具アセット、通り芯基準の明示位置、間取りまで割った住戸タイプ。178空間・542境界が警告ゼロ、居室66室が採光1/7を満たし、「9階のLDKから道路まで扉何枚?」に4枚と答える。

一棟はファイル群としても書ける — USD流の合成 ([examples/house/](examples/house/))。base層が共有の基盤 (通り芯・レベル) を一度だけ宣言し、建具アセット・敷地・各フロアを `import` で重ねる。分担して書かれた層は加算で合成され、衝突 (パスやアセット名の重複、gridの再宣言) は出所 (ファイル:行) つきのビルドエラーになる。`koyu check main.muro` が一棟のビルドの門番。建具の型は `asset` (RevitのFamily、USDのReference) — インスタンスが参照して上書きし (`door SD1 sill:800`)、開口の位置は通り芯の言葉で書けて (`at:Y2+1820`) はみ出し・重なりが検査される (ADR-0010)。

## 使い方

```sh
npm install
npm test

npm run koyu -- check examples/two-rooms.muro        # 整合チェック
npm run koyu -- plan  examples/two-rooms.muro -o out/two-rooms.svg
npm run koyu -- doors examples/two-rooms.muro /L1/a /out   # → 2枚
npm run koyu -- graph examples/two-rooms.muro        # 空間グラフ
npm run koyu -- stats examples/two-rooms.muro        # 面積 (壁芯)
npm run koyu -- json  examples/two-rooms.muro        # 正準JSON (機械形式)

npm run koyu -- plan   examples/office.muro -l L2    # レベル別の平面図
npm run koyu -- levels examples/office.muro          # テキストの矩計 (高さの積み上がり)
npm run koyu -- doors  examples/office.muro /L2/office /out   # → 4枚 (階段経由)
npm run koyu -- stats  examples/mansion.muro         # 面積・ゾーン集計・専有率
npm run koyu -- light  examples/mansion.muro         # 採光 1/7 の粗い判定
npm run koyu -- site   examples/house.muro           # 敷地面積・接道・建蔽率・容積率
npm run koyu -- check  examples/house/main.muro      # 複数ファイル合成のビルド門番
npm run koyu -- site   examples/tower/main.muro      # ショーケース: polygon敷地・2道路・容積率
```

## LLM接続

`koyu-mcp` は依存ゼロのMCPサーバー (stdio、ADR-0012)。LLMエージェントが建物を読み (`layers`)、編集し (`write_layer`)、`check` がビルドの門番になる — エラーは出所レイヤー:行つき。`doors` / `light` / `site` は同じ記述への異なる問い。延床4,786㎡のショーケース一棟が原本8,099トークン (実測 — IFC4は14倍、IFCXは25倍: [examples/comparison/](examples/comparison/README.md)) なので、一棟がコンテキストに余裕で載る。三軸の構想 (デジタルツイン・W3C BOTへのオントロジー整列・都市接続) は [docs/horizon.md](docs/horizon.md)。

## 構成

記法の仕様と書き比べは [spec/notation-v0.md](spec/notation-v0.md)、属性の付け方の契約は [spec/vocabulary.md](spec/vocabulary.md)、IFC4とのカバレッジ照合は [docs/ifc-coverage.md](docs/ifc-coverage.md)、設計判断の記録は [docs/decisions/](docs/decisions/)、行程は [docs/roadmap.md](docs/roadmap.md) (Linear: [koyu](https://linear.app/munipersonal/project/koyu-2789f588a03a/overview) と対応)、日々の記録は [docs/log/](docs/log/)。実装は src/ に約900行 (パーサ・グラフ・チェック・平面図生成・CLI)、テストは test/。IFCXの読解メモは [docs/ifcx-notes.md](docs/ifcx-notes.md)、同じ二室一扉をIFC4・IFCXで書いた三方比較は [examples/comparison/](examples/comparison/README.md)。

## 技術方針

TypeScriptで書き、実行時依存はゼロに保つ。BIM/IFC系のツールが必要になったらThatOpenのOSS (web-ifc, @thatopen/components) を使う。IFC_samples/ はIFC取り込み (M5) 用のサンプルコーパスでgitの外に置いている (第三者提供のファイルのため再配布しない)。

これは探求である。事業化を目的とせず、オーサリングツールは作らず、往復互換は捨て、直交グリッドに絞る。

## 名について

戸牖 (こゆう) は戸と窓 — 開口。老子第十一章は「戸牖を鑿ちて以て室と為す。其の無に当たりて、室の用有り」と言う。開口を鑿ってはじめて室になり、室の用は壁ではなく無 (空間) の側にある。空間を一次要素とし、壁を境界という関係、開口を境界に開いた接続として書くこの記法の、これが最古の出典である。同音の「固有」も掛かっている — 各空間は人間可読な固有名 (階層パス) で名指される。

ファイル拡張子は `.muro` (室)。ファイルが保持する単位は部材ではなく室である。

## ライセンス

コード (src/, test/, examples/ ほか) は [Apache License 2.0](LICENSE)。文書 (docs/, spec/, 原稿「[建築を書く](docs/writing-architecture.md)」) は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)。引用情報は [CITATION.cff](CITATION.cff)。
