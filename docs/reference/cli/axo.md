---
title: koyu axo
mode: reference
---

# koyu axo

軸測図を SVG で書き出す。床・屋根・壁・柱・縦動線がそのまま投影される。**実行環境も WebGL も要らない** — 出るのは SVG なので、平面と同じ「生成して見る」手で立体を確かめられる。

## 引数

```text
koyu axo <entry.muro> [-o <出力.svg>] [-d NE|NW|SE|SW] [-l <レベル指定>] [-s <縮尺>] [--no-walls] [--ceilings]
```

entry のパスを一つ取る。出力はファイルに書かれ、標準出力には書いた先の一行だけが出る。

## 旗

| 旗 | 既定 | 効果 |
|---|---|---|
| `-o <パス>` / `--out <パス>` | `out/axo.svg` | 出力先。ディレクトリは無ければ作られる |
| `-d <向き>` / `--dir <向き>` | `SE` | 見る向き。`NE` `NW` `SE` `SW` の四つだけ |
| `-l <指定>` / `--levels <指定>` | 全レベル | 描くレベル。`L1..L5` の範囲か `L1,L3` の列挙 |
| `-s <数>` / `--scale <数>` | `0.02` | px per mm。正の数だけ |
| `--no-walls` | 壁を描く | 壁を落とす |
| `--ceilings` | 天井を描かない | 天井も描く (描くと中が見えなくなる) |

`-l` の範囲指定は端点に数字を要求しない。`R` のような名前も端点に取れて、二つの端点の `z` に挟まれたレベルがすべて選ばれる。

## 出力

```sh
npx tsx src/cli.ts axo examples/basement/main.muro -o out/axo.svg
```

```text
Generated the axonometric: out/axo.svg
```

旗を重ねても出力の形は変わらない。

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -l L1..L3 -d NE -s 0.5 --ceilings -o out/axo2.svg
```

```text
Generated the axonometric: out/axo2.svg
```

## 呼び方の問題は、呼び方の問題として返す

三つの旗はすべて値を検査する。**空の SVG も `NaN` の SVG も黙って書かない。**

未宣言のレベル名は、宣言されている名前の一覧を添えて止まる。

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -l ZZ9
```

```text
Undeclared level: ZZ9 (declared: B2 B1 L1 L2 L3 L4 L5 L6 L7 L8 L9 L10 L11 L12 L13 L14 L15 L16 L17 L18 L19 R)
```

数として読めない縮尺、あるいは 0 以下の縮尺は止まる。

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -s abc
```

```text
-s takes a positive number: abc
```

四つ以外の向きも止まる。

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -d UP
```

```text
-d is one of NE / NW / SE / SW: UP
```

どれも終了コードは 2 である。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 書き出した |
| 1 | 構文・合成エラーで読めなかった |
| 2 | 未宣言のレベル名 / 読めない縮尺 / 未知の向き / ファイルパスを渡していない |

## 関連

- [koyu plan](plan.md) — 同じ SVG で平面を出す
- [koyu levels](levels.md) — `-l` に渡せるレベル名の一覧
- [koyu runs](runs.md) — 投影されている縦動線が何から導かれたか
- [koyu コマンド](index.md) — 終了コードの共通の約束
