---
title: koyu plan
mode: reference
---

# koyu plan

指定したレベルの平面図を SVG で書き出す。**壁を描く操作はどこにも無い** — 壁は境界から導出されて現れる。

## 引数

```text
koyu plan <entry.muro> [-l <レベル>] [-o <出力.svg>]
```

entry のパスを一つ取る。出力はファイルに書かれ、標準出力には書いた先の一行だけが出る。

## 旗

| 旗 | 効果 |
|---|---|
| `-l <レベル>` / `--level <レベル>` | 描くレベル。既定は**最初に宣言されたレベル** |
| `-o <パス>` | 出力先。既定は `<entry のパスから .muro を除いたもの>-<レベル>.svg` |

`-o` に長い形 (`--out`) は無い。縮尺や切断面の高さを渡す旗も無い。

## 出力

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

```text
Generated the plan: out/house-L2.svg
```

出力先のディレクトリは無ければ作られる。

`-o` を省くと入力ファイルの隣に書き出す。`plan examples/two-rooms.muro` は `examples/two-rooms-L1.svg` を作る。リポジトリを汚したくないときは `-o` を付ける。

## 三つの癖

**`-l` の既定は最下階ではない。**`level` 行を**書いた順**の一番目である。`level L2 …` を `level L1 …` より先に書いたファイルでは、既定が L2 になる。意図した階を確実に描くには `-l` を明示する。

**`-l=L2` の形は効かない。**旗と値は空白で区切る (`-l L2`)。`-l=L2` は黙って無視され、既定のレベルが描かれる。未宣言のレベル名は終了コード 2 で止まるのに、`=` で繋いだ書き方は止まらない — 旗そのものが認識されないからである。

**領域を持つ空間が一つも無いレベルは描けない。**空間を持たない屋上レベル (`level R 5800 slab:500`) を `-l` に渡すと、整えられた診断ではなく生の例外が出る。

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l R -o out/house-R.svg
```

```text
<absolute path>/src/draw/plan.ts:39
    throw new Error(`There is no space with a region on level ${level}`);
          ^

Error: There is no space with a region on level R
```

終了コードは 1 である。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 書き出した |
| 1 | 描けなかった (領域を持つ空間が無いレベル)、または構文・合成エラーで読めなかった |
| 2 | `-l` に未宣言のレベル名を渡した / ファイルパスを渡していない |

未宣言のレベル名は呼び方の問題として扱われる。**空の SVG を黙って書いて「生成しました」と言うことはしない。**

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l ZZ9 -o out/x.svg
```

```text
Undeclared level: ZZ9 (declared: L1 L2 R)
```

**`check` が緑でも `plan` は落ちうる。**描画は `check` の検査対象ではない。`-l` に渡した名前の取り違えは `check` の外にある。

## 関連

- [koyu axo](axo.md) — 同じ「生成して見る」手で立体を確かめる
- [koyu levels](levels.md) — 宣言されているレベルの一覧と高さの積み上がり
- [koyu check](check.md) — 描く前に通す門番
- [koyu コマンド](index.md) — 終了コードの共通の約束
