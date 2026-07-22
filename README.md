# IFCXS — 建築を書く

空間を一次要素とするテキストネイティブな建築記述の探求。壁は物ではなく二つの空間の境界という関係であり、形はソースではなく生成物である。建物一棟を数百行のテキストで書き、git・LLM・都市データと同じ土俵に載せることを狙う。主張の全文は [docs/writing-architecture.md](docs/writing-architecture.md)。

二室一扉はこう書く (全文 [examples/two-rooms.ifcxs](examples/two-rooms.ifcxs)):

```
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000
```

ここから平面図が生成される。壁を描く操作はどこにも無い — 壁は空間の割付から導出される。

![二室一扉の平面図](docs/img/two-rooms.svg)

## 使い方

```sh
npm install
npm test

npm run ifcxs -- check examples/two-rooms.ifcxs        # 整合チェック
npm run ifcxs -- plan  examples/two-rooms.ifcxs -o out/two-rooms.svg
npm run ifcxs -- doors examples/two-rooms.ifcxs /L1/a /out   # → 2枚
npm run ifcxs -- graph examples/two-rooms.ifcxs        # 空間グラフ
npm run ifcxs -- stats examples/two-rooms.ifcxs        # 面積 (壁芯)
npm run ifcxs -- json  examples/two-rooms.ifcxs        # 正準JSON (機械形式)
```

## 構成

記法の仕様と書き比べは [spec/notation-v0.md](spec/notation-v0.md)、設計判断の記録は [docs/decisions/](docs/decisions/)、行程は [docs/roadmap.md](docs/roadmap.md) (Linear: [IFCXS](https://linear.app/munipersonal/project/ifcxs-2789f588a03a/overview) と対応)、日々の記録は [docs/log/](docs/log/)。実装は src/ に約900行 (パーサ・グラフ・チェック・平面図生成・CLI)、テストは test/。IFCXの読解メモは [docs/ifcx-notes.md](docs/ifcx-notes.md)、同じ二室一扉をIFC4・IFCXで書いた三方比較は [examples/comparison/](examples/comparison/README.md)。

## 技術方針

TypeScriptで書き、実行時依存はゼロに保つ。BIM/IFC系のツールが必要になったらThatOpenのOSS (web-ifc, @thatopen/components) を使う。参照リポジトリをクローンする場合は ~/Documents/github に置く。IFC_samples/ はIFC取り込み (M5) 用のサンプルコーパスでgitの外に置いている。

これは探求である。オーサリングツールは作らず、往復互換は捨て、直交グリッドに絞る。
