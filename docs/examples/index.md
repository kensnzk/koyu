---
title: 同梱の建物
mode: explanation
---

# 同梱の建物

リポジトリには八棟入っている。二室の最小例から、延床141,449㎡の双塔再開発まで、**どれも `koyu check` が緑になる実物**である。図が読めれば書けたことになる記法なので、実例は付録ではなく入口である。

八棟はおおむね難度順に並び、前の例の上に積み上がる。各頁は「この例が**初めて**示すもの」「代表的な抜粋」「投げる価値のある問いと、実際に返ってきた答え」からなる。

## 規模

| 例 | 原本 | レベル | 空間 | 境界 | 屋内床面積 | 半屋外 |
|---|---|---:|---:|---:|---:|---:|
| [two-rooms](two-rooms.md) | 26行 / 1ファイル | 1 | 3 | 3 | 32.40㎡ | — |
| [office](office.md) | 110行 / 1ファイル | 3 | 17 | 43 | 419.84㎡ | — |
| [house](house.md) | 89行 / 1ファイル (合成版 102行 / 5ファイル) | 3 | 13 | 31 | 92.75㎡ | 73.24㎡ |
| [basement](basement.md) | 86行 / 1ファイル | 4 | 15 | 49 | 1,242.08㎡ | — |
| [mansion](mansion.md) | 192行 / 1ファイル | 11 | 122 | 332 | 2,366.40㎡ | 162.16㎡ |
| [tower](tower.md) | 453行 / 9ファイル | 12 | 178 | 543 | 4,785.92㎡ | 941.16㎡ |
| [complex](complex.md) | 646行 / 10ファイル | 22 | 425 | 1,364 | 31,606.24㎡ | — |
| [twin](twin.md) | 1,220行 / 11ファイル | 39 | 1,808 | 5,973 | 141,448.56㎡ | 6,534.08㎡ |

空間数と境界数は `koyu check` が印字する合成後の数、床面積は `koyu stats` の合計、レベル数は `koyu levels` の行数である。**この表の数字はすべて実際に走らせて得た。**

```sh
npx tsx src/cli.ts check examples/twin/main.muro
```

```text
✔ Consistent — 1808 spaces / 5973 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## 大きさは行数に比例しない

**延床が4,300倍になっても、原本は47倍にしかならない。**two-rooms の 32.40㎡ / 26行 と twin の 141,448.56㎡ / 1,220行を比べればそうなる。complex と tower の間ではもっと極端で、床面積 6.6 倍に対して原本は 1.43 倍である。

理由は記法の圧縮率ではない。**複合建築は繰り返しでできている**からで、レベルスパン (`/B2..L19/`) と[帯](../reference/muro/band.md)と [`stack`](../reference/muro/stack.md) が繰り返しを丸ごと畳む。complex のコアは地下2階から19階までの21レベル分が9行、ホテルの客室は帯13行から78室に展開される。

したがって**原本の大きさは建物の大きさではなく設計判断の数に比例する**。これは記法の性能ではなく、建築そのものの性質を写している。

LLMのコンテキストに載るかどうかも、そこで決まる。o200k_base で測ると two-rooms が 359トークン、tower の9ファイル合計が 8,574トークン、complex の10ファイル合計が 12,685トークン、twin の11ファイル合計が 26,630トークン。**延床31,606㎡の一棟が、どのモデルの文脈にも丸ごと載る。**同じ場面を IFC4 / IFCX で書いたときの実測は [koyu と IFC の実測比較](vs-ifc.md)にある。

## 走らせる

八棟すべての整合を一度に確かめる。

```sh
npm run check:examples
```

一棟だけを見るなら、まず `check`、次に問いを投げる。

```sh
npx tsx src/cli.ts check  examples/office.muro
npx tsx src/cli.ts stats  examples/office.muro
npx tsx src/cli.ts doors  examples/office.muro /L2/office /out
npx tsx src/cli.ts plan   examples/office.muro -l L2 -o out/office-L2.svg
```

**`check` が緑でも建物が使えるとは限らない。**`check` が言うのは「書かれたものがデータとして矛盾していない」までである。建築的な判定は [`koyu validate`](../reference/cli/validate.md) が別に言う — 同梱の八棟はどれも `validate` も通る。

## 何から読むか

- **記法をまだ知らない** — [two-rooms](two-rooms.md) から [office](office.md)、[house](house.md) の順。
- **書きたいものが決まっている** — [書きたいものから引く](by-pattern.md)が、機能から例の行へ直接飛ばす。
- **規模に耐えるか知りたい** — [complex](complex.md) と [twin](twin.md)。
- **IFC と比べたい** — [koyu と IFC の実測比較](vs-ifc.md)。

## 段階を追う例

[examples/steps/](../../examples/steps/) には、一室から二階建てまでを6段に分けた到達点が入っている。こちらは実例集ではなくチュートリアルの伴走ファイルなので、[はじめの一歩](../start/first-program.md)から辿るのがよい。
