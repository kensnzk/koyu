---
title: area — 空間の中の数えない分節
mode: reference
---

# area — 空間の中の数えない分節

```muro-part
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール floor:オーク
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
```

`area <領域> [属性...]` は[空間](space.md)の直下に字下げして書く、**数えない分節**である。室の中で床仕上げが変わる、たたきの範囲がある、家具の置き場が決まっている — そういう「室を割らずに範囲を持つ」情報がここに来る。

## 隔離則 — 何にも影響しない

`area` は室ではない。**面積にも室数にもグラフにも一切現れない。**

- 延床面積は親の空間の領域から出る。`area` を何枚重ねても増えも減りもしない。
- 隣接も通行も親の空間のものである。`area` は[境界](boundary.md)を持てず、扉も窓も置けない。
- ゾーンの集計にも `use` の集計にも出ない。

書けるのは**領域と上書き属性だけ**で、それが `area` の全部である。ここを割って数えたくなったら、それは `area` ではなく `space` を二つ書く場面である — 親を[ゾーン](zone.md)にして、その下に領域つきの空間を並べる。

## 領域

領域の書き方は[空間](space.md)と同じで、`X?..X? Y?..Y?` の二トークンである。ただし `+` による合併は書けない — 一枚の `area` は一つの矩形である。複数の範囲が要るなら `area` を複数行書く。

親の領域からはみ出せば [SEG02](../diagnostics/seg.md) の警告になる。判定は宣言した割付ではなく**導出された領域**に対して行われるので、[描かれた線](line.md)で切り落とされた側に置いた床材はここで捕まる。

領域を持たない空間 (`exterior` など) に `area` は書けない。こちらはエラーである。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/hall hall X1..X2 Y1..Y2
  area X1..X2 Y1-2000..Y2 name:はみ出し
space /out exterior
  area X1..X2 Y1..Y2 name:無理
```

```text
$ npx tsx src/cli.ts check a2.muro --json
  "code": "SEG02",
  "severity": "warning",
  "message": "The area spills outside the region of /L1/hall",
  "code": "SEG01",
  "severity": "error",
  "message": "An area cannot be written on /out, which has no region",
```

## 属性

`area` に書ける鍵は三つと、ドットを含む名前空間つきの鍵だけである。台帳に無い鍵で名前空間も無いものは [ATT03](../diagnostics/att.md) のエラーになる。

| 鍵 | 層 | 意味 |
|---|---|---|
| `name:` | 解釈 | この分節の名。**同じ空間の中で一意でなければならない** |
| `floor:` | 運搬 | 床仕上げ。親の空間の `floor:` をこの範囲だけ上書きする |
| `spec:` | 運搬 | 物の名。ツールは解釈せず運ぶだけ |
| `<名前空間>.<鍵>:` | 運搬 | ドットを含む鍵は誰でも書けて、core は中身に一切の意味を与えない |

`use:` も `h:` も `daylight:` も書けない。`area` は室ではないので、室の属性を持たない。

```text
✖ ar.muro:line 5: area (/L1/a) carries use:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.use:common)
```

### 名は同一性である

`area` に名を書くとき、その名は**含む空間の中でその分節を指す唯一の手段**になる。合成の集合編集がその名で分節を引くからである。したがって同じ空間の中で名が重複すれば [UID04](../diagnostics/uid.md) のエラーになる。

```text
✖ s4.muro:line 6: Duplicate area name within space /L1/a: 同名 (s4.muro:line 5, s4.muro:line 6) — the name is what identifies it inside its container
```

名を書かない `area` は同一性を主張していないので、この検査の母集団に入らない。

## 字下げの規律

- **字下げは一段だけで、入れ子は無い。**`area` の下にさらに何かを字下げすることはできない。
- `area` は直前の `space` 行に従属する。間に別の非字下げ行が入れば、その `space` の分節ではなくなる。
- レベルスパンで展開された `space` の下に書いた `area` は、展開されたすべての空間に付く。
- [帯](band.md)の要素には書けない。帯の要素の領域は導出されるものであり、その中の範囲を先に書くことはできない。

```text
✖ b9.muro:line 6: area may not be written on a band member (its region is derived — write a room that needs area by position)
```

範囲を持つ分節が要る室は、帯ではなく位置で書く。

## 正準JSON

`area` は親の空間の下に `areas` として、書かれた通り参照の綴りのまま出る。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール floor:オーク
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
```

```text
$ npx tsx src/cli.ts json a1.muro
  "spaces": {
    "/L1/hall": {
      "type": "hall",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "floor": "オーク",
        "name": "エントランスホール"
      },
      "areas": [
        {
          "at": [
            "X1",
            "Y1",
            "X1+1800",
            "Y2"
          ],
          "attrs": {
            "floor": "モルタル",
            "name": "土間"
          }
        }
      ]
    }
  },
```

## 境界の上の分節

境界の上で仕上げが変わるときの対応物は `seg` である。壁の途中でガラスに変わる、腰壁だけ材が違う、といった区間を運ぶ。書ける場所と規律は [seg](seg.md) にある。`area` が室内の範囲を、`seg` が境界上の区間を担当する。
