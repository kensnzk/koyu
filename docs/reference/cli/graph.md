---
title: koyu graph
mode: reference
---

# koyu graph

空間ごとの隣接を、境界の種別と扉数つきで並べる。[`koyu doors`](doors.md) が答えを出す前の地図である。

## 引数

```text
koyu graph <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 出力

空間の宣言順に、その空間とその隣を並べる。

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 1 door → /L1/b  (spec:PW1)
  | wall → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 1 door → /L1/a  (spec:PW1)
  — 1 door → /out  (spec:EW1 fire:60)
/out (外部)
  | wall → /L1/a  (spec:EW1 fire:60)
  — 1 door → /L1/b  (spec:EW1 fire:60)
```

見出しの行はパスと表示名、その下の字下げされた行が隣である。**関係は両側から出る** — `/L1/a` と `/L1/b` の間の扉は二度現れる。

括弧の中は境界の属性である。属性を持たない境界では括弧ごと出ない。

## 記号

| 記号 | 意味 | 通れるか |
|---|---|---|
| `— N doors` | 扉が N 枚ある壁 | 通れる |
| `\| wall` | 扉の無い壁 | 通れない |
| `〰 open` | `open` — 物が無い | 通れる |
| `\| railing etc. (open to the air, not passable)` | `air:1` の壁 (手すり・柵・塀) | 通れない |
| `↕ stair` | `stair` | 通れる |
| `↕ shaft (not passable)` | `shaft` (EV 等) | 通れない |
| `↕ void` | `void` — 床の不在 | 通れない |

扉が一枚のときは `1 door`、それ以外は `N doors` になる。

垂直の関係も同じ一覧に並ぶ。

```sh
npx tsx src/cli.ts graph examples/house/main.muro
```

```text
/home/ldk (LDK)
  — 1 door → /home/hall1  (spec:LGS)
  | wall → /site/garden  (spec:EW)
  | wall → /site/west  (spec:EW)
  | wall → /site/east  (spec:EW)
  | wall → /site/north  (spec:EW)
  ↕ void → /home/void
/home/hall1 (玄関・階段)
  — 1 door → /home/ldk  (spec:LGS)
  — 1 door → /site/east  (spec:EW)
  | wall → /site/north  (spec:EW)
  ↕ stair → /home/hall2
```

(この建物の全出力の一部である。)

## 宣言していない境界も出る

接する空間の既定は壁なので、**書かなかった接触は「扉の無い壁」として現れる。**属性の付いていない `| wall` の行はたいていこれである。

一覧に隣が一つも出ない空間は、どの空間とも接していない。位置の書き間違いか、レベルの取り違えを疑う。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 常に (空間が一つも無くても 0 である) |
| 1 | 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**`graph` は合否を言わない。**通れない壁がいくつあっても 0 を返す。判断が要るなら [`koyu doors`](doors.md) か [`koyu validate`](validate.md) を使う。

## 関連

- [koyu doors](doors.md) — 二点間の最少扉数の経路
- [koyu validate](validate.md) — 到達できない室を建物全体から拾う
- [.muro リファレンス](../muro/index.md) — `boundary` の種別と属性
- [koyu コマンド](index.md) — 終了コードの共通の約束
