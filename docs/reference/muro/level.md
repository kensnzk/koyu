---
title: level — レベル
mode: reference
---

# level — レベル

```muro-part
level L1 0 h:3600 slab:600
level L4..L10 11000 pitch:3000 h:2500 slab:450
level R 30200 slab:500
```

`level <名> <z> [h:] [slab:] [pitch:] [underground:]` は、床の高さに名を与える。**この記法で z を書く場所はここだけ**で、[空間](space.md)は自分の高さを持たず、所属するレベルからそれを受け取る。

## 位置引数

| 位置 | 意味 |
|---|---|
| 名 | レベルの名。空間のパスの先頭セグメントとして使われる (`/L1/hall`) |
| z | 床レベルの高さ mm。負でもよい |

名は自由な語だが、**範囲宣言と単発の宣言は綴りで区別される** — `..` を含む名は範囲として読まれる。

z は[通り芯](grid.md)と同じ座標系の数値で、原点をどこに置くかは自由である。z の順序がレベルの上下であり、名の連番ではない。

## 属性

レベルに書ける鍵は四つだけで、この一覧は閉じている。

| 鍵 | 値 | 意味 |
|---|---|---|
| `h:` | 正の数値 mm | 基準天井高。この階の空間の既定の天井高になる |
| `slab:` | 正の数値 mm | 床組み厚。床版はこの階の FL から下へこの厚さで生成される |
| `pitch:` | 正の数値 mm | 範囲宣言の階高。範囲宣言のときだけ書ける |
| `underground:` | `0` / `1` | 地下の宣言 |

**台帳に無い鍵は診断ではなく構文エラーになる。**レベルは属性の袋を持たない — 四つの鍵はすべて型のついたフィールドへ持ち上げられ、余った鍵の行き場が無い。行き場が無いまま黙って捨てれば、`undergound:1` と綴った階が黙って地上階になる。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150 undergound:1
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ levelkey.muro:line 3: level carries undergound:, which is not in the ledger (level reads h / slab / pitch / underground)
```

他の要素では台帳外の鍵が [ATT03](../diagnostics/att.md) という診断になるが、レベルだけはその手前の parse で止まる。

## h: — 基準天井高

`h:` はこの階の空間の**既定**の天井高である。空間側の `h:` が書かれていればそちらが勝つ。

どちらも無ければ天井高が決まらず、天井も屋根も押し出す高さを失う。これは警告ではなくエラーである。

```text
The ceiling height of /L2/a cannot be determined (neither the space's h: nor level L2's h: is there)
```

天井高の決まらない空間の一覧は [SUF01](../diagnostics/suf.md) が出す。ただし吹抜け (`void`)・外部 (`exterior`)・半屋外の空間は天井を持たないので、この検査の対象にならない。

## slab: — 床組み厚

`slab:` は床版の厚さであり、**床を置く操作は存在しない** — 厚さを宣言することが床を宣言することである。床版は `z - slab` から `z` までに生成される。

書かなければその階に床が一枚も生成されない。形そのものは決まるので警告である。

```text
Level L2 has no slab:, so not one floor is generated on this storey
```

床を持ちうる空間が一つも載っていない階には何も言われない — 生成されなかった床が無いからである。

`slab:` は**上の階の床**として下の階の頭上を食う。次の階までの階高を、下の階の天井高と上の階の床組み厚が食い合う。

```text
$ npx tsx src/cli.ts levels lv.muro
R	z:15000	slab:500
L4	z:11200	h:2700	slab:400
  ↑ storey height 3800 = ceiling 2700 + slab 500 + 600 left over
L3	z:7800	h:2700	slab:400
  ↑ storey height 3400 = ceiling 2700 + slab 400 + 300 left over
L2	z:4400	h:2700	slab:400
  ↑ storey height 3400 = ceiling 2700 + slab 400 + 300 left over
L1	z:0	h:3600	slab:600
  ↑ storey height 4400 = ceiling 3600 + slab 400 + 400 left over
B1	z:-4200	h:3600	slab:600
  ↑ storey height 4200 = ceiling 3600 + slab 600
```

天井高と上階の床組み厚の合計が階高を超えれば、[HGT01](../diagnostics/hgt.md) がエラーになる。

## 範囲宣言 — level L4..L10

```muro-part
level L2..L4 4400 pitch:3400 h:2700 slab:400
```

名が `<接頭辞><数字>..<接頭辞><数字>` の形なら、等差の連番として展開される。z は `z + pitch × k` になる。

| 規則 | エラー |
|---|---|
| 接頭辞は前後で同じ | `Cannot read the level range: L1..M3` |
| 番号は昇順 | `Cannot read the level range: L3..L1` |
| `pitch:` は必須 | `A level range requires pitch: (the storey height in mm): L1..L3` |
| `pitch:` は範囲宣言だけ | `pitch is available only on a level range declaration (L?..L?)` |

`h:` と `slab:` と `underground:` は展開された全レベルに同じ値で付く。基準階の階高が揃っていない部分は、範囲を切って複数行に書く。

## 重複と同じ z

同じ名のレベルを二度宣言すればエラーになる。

```text
✖ lvdup.muro:line 4: Duplicate level: L1
```

名が違っても z が同じ二つのレベルは [LVL01](../diagnostics/lvl.md) のエラーになる — どちらが上でどちらが下かが決まらず、階高が 0 になる。

## underground: — 地下は宣言である

```muro-part
level B1 -4200 h:3600 slab:600 underground:1
```

`underground:1` はその階が地下にあるという宣言で、値は `0` か `1` だけである。

**z の符号からは推定しない。**地盤面は敷地の事実であり、z が負であることは座標系の原点をどこに置いたかの事実にすぎない。原点を地下2階の床に置けば地下階の z は正になるし、造成前の地盤に置けば地上階が負になることもある。二つは別の事実なので、別に書く。

土に接する壁は境界の型でも属性でもなく、[境界](boundary.md)の `spec:` が運ぶ (`spec:RC土圧壁`)。境界のトポロジーは地上でも地下でも同じである。

`underground` は正準JSONに真のときだけ `1` として出る。

```text
$ npx tsx src/cli.ts json lv.muro
  "levels": {
    "B1": {
      "z": -4200,
      "h": 3600,
      "slab": 600,
      "underground": 1
    },
    "L1": {
      "z": 0,
      "h": 3600,
      "slab": 600
    },
```

## 空間のないレベル

空間を一つも載せないレベルを宣言してよい。屋上がその代表で、**最上階の高さ検査の上限**になる。

```muro-bad
grid X 0 6000
grid Y 0 8000
level L1 0 h:3600 slab:600
level R 3800 slab:500
space /L1/hall hall X1..X2 Y1..Y2
```

```text
✖ roof.muro:line 5: /L1/hall collides into the floor above: ceiling height 3600 + R's slab 500 = 4100 > storey height 3800
```

`level R` を消せば同じファイルが緑になる — 上に何も無い階の天井高は、何とも突き合わせようがないからである。**屋上を宣言することは、最上階の高さを検算に載せることである。**

## 使用より前に宣言する

レベルは、その名を使う行より前になければ効かない。空間のパスの先頭セグメントは、その行を読む時点で宣言済みのレベル名と照合される — 後ろに置かれた `level` は間に合わず、空間はレベルを持たないまま残る。

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/a room X1..X2 Y1..Y2
level L1 0 h:2400 slab:150
```

```text
$ npx tsx src/cli.ts check levellate.muro --json
[
 {
  "code": "SUF02",
  "severity": "error",
  "message": "/L1/a has a region, but its level cannot be determined (give it at the head of the path or with level:)",
```

`level:` 属性・[柱](column.md)の階範囲・[stack](stack.md)・パスのレベルスパンも同じで、宣言済みのレベルだけを指せる。未宣言なら `Undeclared level: level:L9` で止まる。

## 並びは z 順である

レベルの上下はすべて z で決まり、名の綴りは関わらない。パスのレベルスパン `/B1..M2/a` は、両端の z の間にある**宣言済みレベルを z の昇順**に並べて展開する — 接頭辞が違っていても構わない。

```muro
grid X 0 3600
grid Y 0 4000
level B1 -3000 h:2400 slab:150
level L1 0 h:2400 slab:150
level M2 3000 h:2400 slab:150
space /B1..M2/a room X1..X2 Y1..Y2
```

```text
$ npx tsx src/cli.ts stats sp2.muro
B1
  /B1/a	a	room	14.40 m2
  Subtotal 14.40 m2
L1
  /L1/a	a	room	14.40 m2
  Subtotal 14.40 m2
M2
  /M2/a	a	room	14.40 m2
  Subtotal 14.40 m2
Total 43.20 m2 (indoor floor area)
  room: 43.20 m2
```

## 合成での上書き

レベルの定義は層を跨いで一度である。既に宣言されたレベルの値を別の層から変えるのは `over level` で、書き換えられるのは `h` / `slab` / `underground` の三つに限られる (`pitch` は展開のための入力なので、展開後には対象が無い)。強度の規則は [over / drop](over-drop.md) にある。

## 面はレベルから導かれる

床・天井・屋根に専用の語彙は無い。`slab:` が床を、`h:` が天井を**既に宣言している**からである。

- **床** — `slab:` を持つ階の、吹抜けでも外部でもない空間の下に生成される。
- **天井** — `h:` から決まる高さに張られる。吹抜け・外部・半屋外・縦動線の空間には張られない。
- **屋根** — 「上にどのレベルの空間も重なっていない範囲」に架かる。基壇の上に塔屋が載れば、基壇屋上が書かずに現れる。

天井を張らない室 (現し天井) は空間側の `ceiling:0` で宣言する。詳しくは [space](space.md) を見る。
