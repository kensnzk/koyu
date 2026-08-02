---
title: window — 採光する開口
mode: reference
---

# window — 採光する開口

```text
boundary /pathA /pathB …
  window [アセット名] w:1650 h:1100 [at:…] [edge:…] [name:…] [sill:…]
```

`window` は [境界](boundary.md)の直下に**字下げ一段**で書く。位置の書き方 (`at` の比率と通り参照、`edge` による辺の選択) は[扉](door.md)とまったく同じ規則に従う。

違うのは二つである。**窓は通行しない**ので、`koyu doors` のグラフに辺を張らない — 窓だけの壁は通れない壁のままである。そして**窓は採光を数える**。

## w と h の両方を書く

| 属性 | 要否 | 意味 |
|---|---|---|
| `w` | **必須** | 線分に沿った幅mm。参照した[アセット](asset.md)が与えてもよい |
| `h` | 形の上では任意 / 採光には**必須** | 高さmm |

`w` が無ければ parse が止める。`h` は書かなくても `check` は緑になる — だが**採光の数え上げから丸ごと落ちる**。窓面積は `h` を持つ窓の `w × h` の合計だからである。

```muro
koyu 1.1
name 窓の書き方
unit mm

grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:居室 daylight:1
space /out name:外部 outside:1

boundary /L1/a /out t:150 edge:S
  window w:1650 h:1100 sill:900 name:腰窓
boundary /L1/a /out t:150 edge:N
  window w:2600 h:2200 name:掃き出し窓
boundary /L1/a /out t:150 edge:E
  door w:900 h:2100 name:出口
boundary /L1/a /out t:150 edge:W
```

```text
✔ /L1/a	居室	window 7.54 m2 / floor 24.00 m2 = 1/3.2 (needs 1/7 ≈ 3.43 m2)
```

腰窓から `h:1100` を落とすだけで、数は 7.54 から 5.72 に落ちる。

```text
✔ /L1/a	居室	window 5.72 m2 / floor 24.00 m2 = 1/4.2 (needs 1/7 ≈ 3.43 m2) ⚠ windows without h: are not counted
```

`koyu check` は緑のままである。言葉にするのは検証の側で、規則の名は **`daylight.unknown`** (caution) である。

```text
⚠ [daylight.unknown] win.muro:line 9: Window area is not fully counted: /L1/a has a window without h: (write h: on it)
```

**「窓が足りない」ではなく「数え切れていない」と言う。**足りているかどうかを言えるだけの情報が原本に無い、という報告である。

## 腰高は書かれない — まぐさを揃えた結果である

**開口の頭はまぐさ高 2000mm に揃う。**扉は床から立ち上がってそこに達し、扉以外の開口はそこから高さのぶん下がる。

| 書いたもの | 開口の z 範囲 (FL からの高さ) |
|---|---|
| `window w:1650 h:1100` | 900 … 2000 |
| `window w:2600 h:2200` | −200 … 2000 |
| `window w:1650` (`h` 無し) | 800 … 2000 (既定の高さ 1200) |

一行目の腰高 900mm は、どこにも書かれていない。**2000 − 1100 の結果である。**そして二行目のように `h` をまぐさ高より大きく取れば、開口の下端は床より下へ落ちる。掃き出し窓を書きたいなら、まぐさ高との差が意味を持つことを承知のうえで `h` を選ぶ。

`sill:` は**運搬層**である — 台帳には載っているが、core は一度も読まない。書けば正準JSONに運ばれ、外部のツールが使える。だが形は動かない。上の例で `sill:900` を `sill:400` に書き換えても、窓は 900 … 2000 のままである。

## 採光の係数

`light` の対象は **`daylight:1` を書いた領域つき空間だけ**である。型からは推定しない — `room` と書いても `bedroom` と書いても、宣言が無ければ対象外である。

有効窓面積は、窓の**先に何があるか**で割り引かれる。

| 窓の相手 | 係数 |
|---|---|
| 外部 (`outside:1`) | 1.0 |
| 半屋外で、上に空間が重なっている (バルコニー下・庇下) | 0.7 |
| 半屋外で、上が開いている (庭・最上階のバルコニー) | 1.0 |
| それ以外 (屋内同士) | 0 — 数えない |

半屋外かどうかも、上が覆われているかどうかも、宣言ではなく導出である。外部に対して `open` か `air:1` の境界を持つ領域つき空間が半屋外になる。

判定 (有効窓面積 ≥ 床面積 ÷ 7) を下すのは `koyu validate` の **`daylight.ratio`** (violation) であって、`check` ではない。採光補正係数を掛けない粗い早期警報であり、用途別の割合も適用建築物の別も見ない。1/7 を掛ける先は `daylight:1` を書く位置として書き手が決める。

## 属性の層

| 属性 | 層 |
|---|---|
| `w` `h` `at` `edge` `hinge` `swing` | 構造 |
| `style` `name` | 解釈 |
| `sill` `spec` `fire` | 運搬 |

窓は扉と同じ台帳を使う。`hinge` も `swing` も `style` も書けるが、通行しないので軌跡は描かれない。台帳に無いキーはドットを含む名前空間 (`acme.glazing:Low-E`) を持たなければ ATT03 である。

## 診断

診断は扉と共通である — OPN01 から OPN08、VRT05、UID04。ただし OPN03 (`open` 境界の上の開口) は扉と同じく「通行に影響しない」と言うだけで、窓にとってはもとより無関係である。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [boundary](boundary.md) — 窓が載る関係
- [door](door.md) — 位置の書き方は共通、通行するのはこちらだけ
- [asset](asset.md) — 窓の既定値を一箇所に置く
- [koyu light](../cli/light.md) — 採光の数を返す
- [koyu validate](../cli/validate.md) — 1/7 の判定を下す
