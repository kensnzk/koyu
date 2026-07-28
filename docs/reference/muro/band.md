---
title: band — 寸法と並びで空間を割る
mode: reference
---

# band — 寸法と並びで空間を割る

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

`band <軸> <X?..X?> <Y?..Y?>` と、その直下に字下げした `space` 行。**帯は位置ではなく寸法と並びを書く記法である。**位置はそこから導出される。

[レベル](level.md)の積み上げが垂直の矩計であるのと同じことを、水平で行うものだと考えるとよい。`level L1 0` `level L2 3400` と書くかわりに階高を積み上げるように、`X1..X2` `X2..X3` と書くかわりに幅を並べる。

領域で書く書き方と併存し、どちらで書くかは強制されない。上の 6 行は、次の書き方と**同じモデル**を与える。

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/hall hall X2..X3 Y1..Y2 name:玄関
```

## 帯の行

| 位置 | 意味 |
|---|---|
| 第1位置引数 | 割る向き。`X` = 西→東 / `Y` = 南→北。`grid X 0 6400 …` と同じ綴り方である |
| 第2・第3位置引数 | 帯の範囲。`X?..X?` と `Y?..Y?` を一つずつ。[空間](space.md)の領域と同じ字句で、順不同 |

**この行に `key:value` は書けない。**帯はモデルに残らないので、属性の運び先が無い。属性は要素の `space` 行に書く。

```text
✖ b4.muro:line 4: Only the axis and the extent may be written on a band line (attributes go on the member space lines): name:帯
```

`+` による領域の合併も書けない。帯は一つの矩形を一方向へ割るものである。

### 範囲は昇順で書く

空間の領域では `X2..X1` は同じ矩形の別綴りとして昇順に正規化されるが、**帯では逆順が拒まれる**。要素の並びが意味を持つ — 先に書いた要素が低座標の側に来る — ので、綴りの向きを黙って直せば並びが黙って逆になるからである。

```text
✖ b1.muro:line 4: A band range is written in ascending order (members run west to east / south to north): X3..X1
```

## 要素

字下げした `space` 行が帯の要素である。領域の代わりに幅 `w:` を持つほかは、通常の `space` 行と同じで、パス・型・属性・レベルスパンをそのまま書ける。

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

- `w:` は**帯の向きの寸法 mm** である。軸相対であって、常に幅でも常に奥行でもない。値は正の整数か `rest` で、小数は書けない。
- 要素に `level:` は書けない。帯は一つのレベルの上の一続きだからである。
- 要素に [area](area.md) は書けない。要素の領域は導出されるものなので、その中の範囲を先に書くことはできない。
- レベルスパンを書くときは、**帯の中で同じレベルに展開されなければならない**。

```text
✖ b8.muro:line 5: level: may not be written on a band member (a band is a run on one level): level:L1
✖ b9.muro:line 6: area may not be written on a band member (its region is derived — write a room that needs area by position)
```

帯の外の `space` に `w:` は書けない。字下げを落とした要素が「領域を持たない空間」として黙って通るのを防ぐためである。

```text
✖ b5.muro:line 4: w: may not be written on space (a space written by width sits indented under band)
```

## 閉じた帯が既定である

**全要素に寸法を書き、合計が帯の幅と一致することを parse が照合する。**図面の「部分寸法の合計 = 総寸法」と同じ検算であり、寸法の打ち間違いをその場で捕まえる唯一の防御である。

合計が足りなければエラーになる。

```muro-bad
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600
  space /L1/hall hall w:1000
```

```text
✖ b2.muro:line 4: The dimensions sum to 4600mm against a band width of 5400mm, 800mm short (fix a dimension, or make one of them w:rest)
  /L1/ldk w:3600
  /L1/hall w:1000
```

超えてもエラーになる。

```text
✖ b3.muro:line 4: The dimensions sum to 6000mm against a band width of 5400mm, 600mm over
  /L1/ldk w:4000
  /L1/hall w:2000
```

**ソルバーは無い。**足し算と一回の引き算だけで、順序は宣言順、向きは常に低座標から高座標へである。

### w:rest — 残りを吸収する

残りが設計判断でないときに限って、`w:rest` を書ける。帯に高々一つで、位置は問わない。

```muro-part
band X X1..X3 Y1..Y2
  space /L1/a room w:8000
  space /L1/b room w:rest
```

二つ書けばエラーになる。

```text
✖ b6.muro:line 7: Only one member per band absorbs the remainder (w:rest): /L1/b, /L1/c
```

他の寸法が帯を使い切っていて `rest` に残りが無いときもエラーになる — 幅ゼロの空間は形にならないからである。

```text
The other dimensions use up the band width of 5400mm, leaving zero for /L1/b (w:rest)
```

## 破れはすべて parse のエラーである

帯が壊れていれば矩形が一つも作れない。形の問題なので、帯の破れに専用の診断コードは無く、すべて parse のエラーとして止まる。`check --json` では [SYN01](../diagnostics/syn.md) として現れる。

## 帯はモデルに残らない

帯は parse のときに通常の空間へ展開され、**モデルにも正準JSONにも残らない**。帯で書いた版と位置で書いた版は同じ正準JSONを与えるので、書き方を変えただけの差分は差分として出ない。

```text
$ npx tsx src/cli.ts json band.muro
  "spaces": {
    "/L1/hall": {
      "type": "hall",
      "at": [
        "X2",
        "Y1",
        "X3",
        "Y2"
      ],
      "attrs": {
        "name": "玄関"
      }
    },
    "/L1/ldk": {
      "type": "ldk",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "name": "LDK"
      }
    }
  },
```

## 導出される切り位置の綴り — 床規則

展開された空間は通り参照で綴られる。**帯の両端と直交方向の両端は書かれた綴りがそのまま使われ、内側の切り位置だけが綴られる。**

内側の綴りの規則は一つで、「その座標**以下**で最も大きい通り芯からのオフセット」である。オフセットが 0 なら通り名だけになり、先頭の通り芯より手前なら負のオフセットになる。

```muro
grid X 0 6400 12800
grid Y 0 5600
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/a room w:8000
  space /L1/b room w:rest
```

切り位置 8000 は `X2+1600` と綴られる。

```text
$ npx tsx src/cli.ts json b7.muro
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2+1600",
        "Y2"
      ]
    },
    "/L1/b": {
      "type": "room",
      "at": [
        "X2+1600",
        "Y1",
        "X3",
        "Y2"
      ]
    }
  },
```

**上の通り芯から引く綴り (`Y2-1800`) は導出では生じない。**その流儀で領域を書いていたファイルを帯に書き直すと、幾何は同一でも綴りが変わり、意味の差分に現れる。

導かれた切り位置が mm の整数にならない場合もエラーになる — 通り参照で綴れない位置は書けないからである。
