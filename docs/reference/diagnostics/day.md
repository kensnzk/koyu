---
title: DAY — 採光の対象
mode: reference
---

# DAY — 採光の対象

DAY は一つだけである。

| コード | severity | 何を言うか |
|---|---|---|
| DAY01 | error | `daylight` の値が 0 でも 1 でもない |

`daylight` は「この空間に採光の判定を掛けるか」という**二値の宣言**であり、`koyu light` の**唯一の入口**である。型からは推定しない — `bedroom` と書いても `room` と書いても、`daylight:1` が無ければ判定の対象にならない。

だから値の綴りが揺れると**判定が全損する**。`daylight:yes` を自由な属性として通してしまえば、その空間は黙って対象外に落ち、`light` は「全室合格」と区別の付かない出力を返す。DAY01 はその一点だけのために在る。

## DAY01 — daylight は 1 か 0 です

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:yes
```

```text
daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes
```

**原因** — `daylight` に `1` でも `0` でもない値が書かれている。`yes` `true` `on` はいずれも通らない。

見るのは綴りではなく値である。数として読める綴りは数になるので、`1.0` `01` `1.00` は `daylight:1` と同じに扱われ、診断は出ない。`0.0` も同じく `0` である。

**直し方** — `daylight:1` (判定する) か `daylight:0` (しない) にする。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:1
```

**書かないという選択もある。**`daylight` を書かなければ、その空間は対象外である。DAY01 は書かれた値だけを見るので、書かなければ出ない。`daylight:0` を明示するのは、「検討したうえで対象外にした」と読ませたいときである。

## 型は関係しない

**採光の対象は宣言であって推定ではない。**

- `wet` に `daylight:1` を書けば、洗面所も判定に載る。
- `bedroom` に何も書かなければ、寝室でも判定には載らない。

これは書き手に granularity を渡すためでもある。住戸をまるごと一空間として書いたなら住戸に `daylight:1` を書き、室に割ったなら室ごとに書く。**判定の分母をどの粒度に置くかは、`daylight:1` を書く位置として書き手が決める。**

## 対象になると何が起きるか

`koyu light` が、その空間ごとに有効窓面積と床面積の比を出す。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2 daylight:1
space /out exterior
boundary /L1/a /out t:150
  window w:1800 h:1500 edge:S
boundary /L1/b /out t:150
  window w:400 h:400 edge:S
```

```sh
koyu light house.muro
```

```text
✔ /L1/a	a	window 2.70 m2 / floor 14.40 m2 = 1/5.3 (needs 1/7 ≈ 2.06 m2)
✖ /L1/b	b	window 0.16 m2 / floor 14.40 m2 = 1/90.0 (needs 1/7 ≈ 2.06 m2)
✖ Short of 1/7: 1 of 2 rooms (this is a validation judgement)
```

窓面積は、その空間の境界の上にある `h:` を持つ `window` の `w × h` の合計である。**`h:` を書かない窓は数えられない** — 数え切れていないことは `koyu validate` が `daylight.unknown` として言う。窓の先が半屋外で、その半屋外の上に空間が重なっていれば (バルコニー下・庇下) 係数 0.7 が掛かる。上が開いていれば 1.0 である。

判定そのもの (1/7 に足りているか) は建築の側の判断なので、`check` ではなく `koyu validate` の `daylight.ratio` が持つ。`check` が言うのは「宣言が読めるか」までである。

## 関連

- [ATT — 属性](./att.md) — `daylight` 以外の属性の値と鍵の検査
- [VER — 言語の版](./ver.md) — 0.3 以前は型から採光の対象を推定していた (VER02)
- [koyu validate](../cli/validate.md) — `daylight.ratio` / `daylight.unknown`
- [koyu check](../cli/check.md)
