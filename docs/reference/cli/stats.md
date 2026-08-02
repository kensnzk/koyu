---
title: koyu stats
mode: reference
---

# koyu stats

レベル別の床面積、半屋外と屋外の別掲、ゾーン別・型別・use 別の集計を出す。

## 引数

```text
koyu stats <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 出力

```sh
npx tsx src/cli.ts stats examples/house/main.muro
```

```text
L1
  /site/garden	南庭	garden	41.12 m2 (semi-outdoor, reported separately)
  /site/west	西側通路	yard	12.42 m2 (semi-outdoor, reported separately)
  /site/east	東側通路	yard	12.42 m2 (semi-outdoor, reported separately)
  /site/north	北側通路	yard	7.28 m2 (semi-outdoor, reported separately)
  /home/ldk	LDK	ldk	39.75 m2
  /home/hall1	玄関・階段	hall	13.25 m2
  Subtotal 53.00 m2
L2
  /home/bed1	主寝室	bedroom	26.50 m2
  /home/void	リビング上部	void (not counted as floor area)
  /home/hall2	2階ホール	hall	13.25 m2
  Subtotal 39.75 m2
Total 92.75 m2 (indoor floor area)
Semi-outdoor 73.24 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By zone (counted aggregation):
  /home	住戸	92.75 m2
  ldk: 39.75 m2
  hall: 26.50 m2
  bedroom: 26.50 m2
By use: exclusive 92.75 m2 (100.0%)
```

## 読み方

レベルは `z` の昇順に並ぶ。領域を持つ空間が一つも無いレベルは節ごと出ない。

空間の行はタブ区切りの `パス / 名前 / 型 / 面積` である。**面積は壁芯で数える。**

四つの扱いが分かれる。

| 種類 | 扱い |
|---|---|
| 屋内の空間 | `Subtotal` と `Total` に算入 |
| `void:1` (吹抜け) | 面積を出さず `void (not counted as floor area)` と出る。算入しない |
| `outside:1` | `(outdoor, not counted)` と出て、末尾に `Outdoor` として別掲 |
| 半屋外 | `(semi-outdoor, reported separately)` と出て、末尾に `Semi-outdoor` として別掲 |

**半屋外は宣言ではなく導出である。**`exterior` に `open` か `air:1` の境界で接する空間が半屋外になる。バルコニーや外階段が床面積に入るかは法規の細目なので、算入せずに別掲する。

`Outdoor` の行は屋外の空間があるときだけ出る。

```sh
npx tsx src/cli.ts stats examples/complex/main.muro
```

```text
Total 31606.24 m2 (indoor floor area)
Outdoor 736.00 m2 (plazas, open ground and the like — not counted as floor area)
```

(この建物の全出力の末尾の一部である。)

## 三つの集計軸

`By zone` はゾーンごとの合計である。**`site:1` を持つゾーンはここに出ない** — 敷地は床面積の集計対象ではないからで、敷地の数字は [`koyu site`](site.md) が別に答える。

続く `<型>: <面積>` の行は、`space` の第2位置引数 (型) ごとの合計である。**型は開かれた語彙なので、綴りを間違えても静かに別の型として数えられる。**`bedroom` を `bedrom` と書いた行は、エラーにならず新しい型として一行増える。それでよいのは、型に意味が置かれていないからである — 構成の事実は `outside:` `void:` の宣言の側にあり、そちらは台帳が綴りを守る。型を書かなかった空間は `(untyped)` にまとまる。

`By use` はゾーンから継承した実効 `use` ごとの合計と、屋内床面積に対する百分率である。`use` を一つも書いていない建物ではこの行が出ない。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 常に (空間が一つも無くても 0 である) |
| 1 | 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**`stats` は合否を言わない。**面積が過大でも過小でも 0 を返す。容積率の判断は [`koyu site`](site.md) が数字として出し、判定は [`koyu validate`](validate.md) が言う。

## 関連

- [koyu site](site.md) — 敷地面積・建蔽率・容積率
- [koyu levels](levels.md) — 高さの積み上がり
- [.muro リファレンス](../muro/index.md) — `space` の型と `zone` の `use`
- [koyu コマンド](index.md) — 終了コードの共通の約束
