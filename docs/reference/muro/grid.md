---
title: grid — 通り芯
mode: reference
---

# grid — 通り芯

```muro-part
grid X 0 6400 12800 19200
grid Y 0 5600 7600 13200
```

`grid <軸> <座標mm> <座標mm> ...` は、軸上の通り芯の座標を並べる。**この記法に座標の直書きは無い** — 位置は常に通り芯の言葉で書かれるので、通り芯が無ければ領域も線も開口の位置も書けない。

軸は `X` と `Y` の二つだけである。X は東が正、Y は北が正で、高さ方向 (z) は軸ではなく [level](level.md) が持つ。

## 通り名は自動でつく

書くのは座標だけで、名は付けられない。`grid X` に並べた座標が西から順に `X1` `X2` `X3` …、`grid Y` の座標が南から順に `Y1` `Y2` `Y3` … になる。

```muro-part
grid X 0 6400 12800 19200
#      X1 X2   X3    X4
```

したがって通り名は**軸と序数**であって、図面の「通り符号」(A通り・1通り) ではない。符号を運びたいなら空間や境界の属性に書く。

`X` で始まる名は X 軸、`Y` で始まる名は Y 軸と読まれるので、参照に軸を書き添える必要は無い。序数は 1 から始まり、`X0` は存在しない。

## 使用より前に宣言する

**`grid` は、その通り名を使う行より前になければ効かない。**通り参照はその行を読む時点で座標に解決されるので、後ろに置かれた `grid` は間に合わない。

```muro-bad
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
grid X 0 3600
grid Y 0 4000
```

```text
✖ gridlate.muro:line 2: Undefined grid line name: X1
```

[boundary](boundary.md) が空間を前方参照できるのとは対照的である。境界が結ぶのはパスという名前だが、通り参照が指すのは座標そのものだからである。

## 軸ごとに一度だけ

`grid X` と `grid Y` はそれぞれ一度しか宣言できない。合成しているときも層を跨いで一度で、二本目は同じ座標列でもエラーになる — 通り芯は建物全体で一つの座標系であり、後から足したり差し替えたりする対象ではない。

```text
✖ n5.muro:line 2: grid X is declared once (in the base layer when composing)
```

## 座標の規則

| 規則 | エラー |
|---|---|
| 軸は `X` / `Y` | `A grid axis is X or Y: Z` |
| 座標は 2 つ以上 | `grid takes two or more coordinates` |
| 昇順で書く | `grid coordinates are written in ascending order` (等値も不可) |

座標は mm の数値で、負でもよい。原点をどこに置くかは自由で、[polygon](polygon.md) の頂点も[柱](column.md)の位置もこの同じ座標系で読まれる。

## 通り参照 — 位置の綴り方

宣言した通り名は、そのまま位置の語になる。

| 綴り | 意味 |
|---|---|
| `X2` | X2 通りの座標 |
| `X2+600` | X2 通りから東へ 600mm |
| `Y3-150` | Y3 通りから南へ 150mm |
| `X1..X2+3200` | 範囲 (両端とも通り参照) |

オフセットは**整数のみ**である。`X2+600.5` は通り名として読めずエラーになる。

```text
✖ g1.muro:line 4: Undefined grid line name: X2+600.5
```

宣言していない通りを参照してもエラーになる (`Undefined grid line name: Y3`)。範囲・領域・線の端点・開口の絶対位置での使い方は [位置と領域](positions.md) にまとめてある。

## 通り芯は描かれる線ではない

`grid` が置くのは座標であって、長さも端点も持たない。通り芯そのものが何かを分けることも無い — 空間を分けるのは[空間](space.md)の領域と[境界](boundary.md)である。

通り芯が形を生むのは一箇所だけで、[柱](column.md)がその交点に立つ。`column` の `x:` / `y:` は通り名 (`x:X2,X3`) で書く。

## 正準JSON

通り芯は座標の配列として出る。名は序数から決まるので保存されない。

```text
$ npx tsx src/cli.ts json lv.muro
  "grid": {
    "X": [
      0,
      6000
    ],
    "Y": [
      0,
      8000
    ]
  },
```

## 最小の例

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

```text
$ npx tsx src/cli.ts check min.muro
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```
