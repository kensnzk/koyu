---
title: koyu light
mode: reference
---

# koyu light

**`daylight:1` と宣言された空間**について、有効窓面積が床面積の 1/7 以上かを一覧で確かめる。

## 引数

```text
koyu light <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 出力

対象の室が一行ずつ並び、最後に総括が出る。

```sh
npx tsx src/cli.ts light examples/house/main.muro
```

```text
✔ /home/ldk	LDK	window 7.54 m2 / floor 39.75 m2 = 1/5.3 (needs 1/7 ≈ 5.68 m2)
✔ /home/bed1	主寝室	window 5.72 m2 / floor 26.50 m2 = 1/4.6 (needs 1/7 ≈ 3.79 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

列はタブ区切りの `印 / パス / 名前 / 数字` である。`1/5.3` は窓面積に対する床面積の比で、これが `1/7` より大きい分母を持てば不足になる。

不足している室があれば `✖` が付き、総括が件数を言う。

```sh
npx tsx src/cli.ts light dark.muro
```

```text
✖ /L1/a	居室A	window 0.36 m2 / floor 16.20 m2 = 1/45.0 (needs 1/7 ≈ 2.31 m2)
✖ /L1/b	居室B	window 0.00 m2 / floor 16.20 m2 = no window (needs 1/7 ≈ 2.31 m2) ⚠ windows without h: are not counted
✖ Short of 1/7: 2 of 2 rooms (this is a validation judgement)
```

窓が一枚も数えられなかった室は `no window` と出る。

## h を持たない窓

**`h` を書いていない `window` は面積を数えられない。**その室の行末に `⚠ windows without h: are not counted` が付く。上の `/L1/b` は `window w:2600 edge:E` と書いてあるのに 0.00 m2 になっている — 幅はあっても高さが無いからである。

この警告が付いた行の数字は下限であって、実際の窓面積ではない。

## 対象は型から推定しない

**判定されるのは `daylight:1` を書いた空間だけである。**型は見ない。どの室に 1/7 が掛かるかは法の判断であって型からは導けないからで、共同住宅の居室は対象、ホテルの客室は対象外、という区別を `room` という一語では表せない。

対象が一つも無ければ、判定そのものが行われない。

```sh
npx tsx src/cli.ts light examples/office.muro
```

```text
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

**これを「合格」と読まないこと。**`daylight:1` を書き忘れても同じ出力になる。

## 粗い判定である

補正係数を掛けない。開口部の位置も、隣地境界線までの距離も、庇の出も見ない。基本計画の解像度に合わせた早期警報であって、確認申請の採光計算ではない。

そして**これは判定であって、`check` の保証ではない。**`light` が緑でも `check` が赤なら構成が壊れているし、`check` が緑でも `light` が赤なら窓が足りない。二つは別のことを見ている。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 対象の全室が 1/7 を満たす、**または対象が一つも無い** |
| 1 | 不足している室がある、または構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**対象が無いときの終了コードは 0 である。**`daylight:1` を一つも書いていないモデルで `light` を CI に置くと、何も見ていないまま緑が返る。

## validate との関係

`light` が出す `✖` は、[`koyu validate`](validate.md) の `daylight.ratio` (violation) と同じ判定である。`light` はその判定の**入力の数**まで見せる面で、`validate` は判定だけを返す面である。CI で落とすなら `validate` を使うほうが、他の 14 規則も同時に見られる。

## 関連

- [koyu validate](validate.md) — `daylight.ratio` と `daylight.unknown`
- [koyu stats](stats.md) — 床面積の内訳
- [.muro リファレンス](../muro/index.md) — `daylight:` と `window` の書き方
- [koyu コマンド](index.md) — 終了コードの共通の約束
