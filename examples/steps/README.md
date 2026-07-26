# steps — チュートリアルの各段

[guide/start.md](../../guide/start.md) の六つの段の到達点を、そのまま動くファイルにしたものである。文書に貼られた出力と図は、このファイル群を実際に走らせて得たものであり、`npm run check:examples` がこの六つを検査するので、記法が変わればここが落ちる。

| ファイル | 段 | 加わる考え |
|---|---|---|
| `01-one-room.muro` | 第1段 一室 | 通り芯・レベル・空間 — 通る最小のファイル |
| `02-two-rooms.muro` | 第2段 二室 | 接する空間の間に壁が導出される |
| `03-door.muro` | 第3段 扉 | 境界を宣言して開口を切る |
| `04-exterior.muro` | 第4段 外 | 外部空間・外皮・`edge:`・採光 |
| `05-two-storeys.muro` | 第5段 二階 | レベルの積み上がり・垂直境界 (階段)・`doors` |
| `06-finished.muro` | 第6段 仕上げ | 版宣言・名前・属性・面積集計 |

文書の第5段は、階段は繋がっているが寝室に扉が無い「密封された状態」を経由する。その状態は `05-two-storeys.muro` から次の2行を消せば再現できる — `check` は緑のまま通り、`doors /L2/bed /out` だけが到達不能と答える。

```
boundary /L2/bed /L2/hall t:120
  door w:800 h:2000
```

各段の平面図は [guide/img/](../../guide/img/) に `start-*.svg` として置いてある。作り直すときは次のようにする。

```sh
npx tsx src/cli.ts plan examples/steps/06-finished.muro -l L1 -o guide/img/start-06-L1.svg
```
