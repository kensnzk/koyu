---
title: よくある詰まり
mode: howto
---

# よくある詰まり

**十三個ある。**新しく書き始めた人がぶつかるものを、原因と直し方まで通して書く。

出たメッセージから引きたいだけなら[症状から診断を引く](by-symptom.md)が索引である。この頁は、そこから飛んでくる先である。

以下の出力は実際に走らせて得たものである。出所の絶対パスはファイル名だけに縮めてある。

## 1. 通り名が未定義だと言われる

`grid` は**宣言の順序が効く数少ない行**である。`boundary` は空間を前方参照してよいが、`grid` と `level` は使う行より前になければならない。

```muro-bad
level L1 0
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ nogrid.muro:line 2: Undefined grid line name: X1
```

順序だけの誤りでも、文言は同じである。

```muro-bad
space /L1/a room X1..X2 Y1..Y2
grid X 0 3600
grid Y 0 4000
level L1 0
```

```text
✖ order.muro:line 1: Undefined grid line name: X1
```

**直し方。**基盤の宣言をファイルの先頭にまとめる。層を重ねているなら入口 (entry) に置く。

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0
```

`X5` のように存在しない通り名を書いたときも同じ文言になる。`grid X 0 3600 7200` が作る通りは `X1` `X2` `X3` の三本だけである。

## 2. 接していないと言われる

角で触れているだけの二室は接していない。境界の壁芯線分は矩形の**共有辺**として導かれるので、長さのある辺を共有していなければ線分が出てこない。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

```text
✖ corner.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

二つの矩形はこうなっている。

```text
        X1        X2        X3
  Y3     +---------+---------+
         |         |   /L1/b |
  Y2     +---------●---------+
         | /L1/a   |
  Y1     +---------+
```

`●` が唯一の接点で、長さがゼロである。

**直し方。**どちらかの矩形を伸ばして辺を共有させるか、その `boundary` 行を消す。

## 3. 辺を選べと言われる

室の外周のうち、他の空間と接していない残りが外部との境界になる。角の室なら南と西のように**複数の辺に割れる**ので、開口をどこに置くかが決まらない。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living living X1..X2 Y1..Y2 name:居間
space /out name:外部 outside:1
boundary /L1/living /out t:150
  door w:900
```

```text
✖ edge.muro:line 7: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)
```

**直し方。**外壁に開口を置くときは `edge:` で辺を選ぶ。

```muro-part
boundary /L1/living /out t:150
  door w:900 edge:S
```

方角は**最初に書いた空間の矩形から見る。**`N`=+Y (北)・`S`=−Y (南)・`E`=+X (東)・`W`=−X (西)。X は東が正、Y は北が正である。境界行そのものを一つの辺に限定したいときは `boundary` 側に `edge:` を書く。

## 4. 領域の書き方を叱られる

領域は**二つの範囲**である — X 系で一つ、Y 系で一つ。片方しか書かなければこう言われる。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2
```

```text
✖ region.muro:line 4: A region is given as two ranges, X?..X? and Y?..Y?
```

**直し方。**もう一方の軸の範囲を書く。

```muro-part
space /L1/a room X1..X2 Y1..Y2
```

**型を書き忘れたのではない。**型は任意である ([space](../reference/muro/space.md))。`space /L1/a X1..X2 Y1..Y2` は型を持たない空間として通る — 型は自由なラベルであって、ツールはそこを読まない。

## 5. 領域が重なっていると言われる

住戸を室に割るときの定番である。`space` は領域を持つので、領域を持つ親の下に領域を持つ子を置けば必ず重なる。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/home unit X1..X3 Y1..Y2 name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
```

```text
✖ overlap.muro:line 4: Space regions overlap: /L1/home and /L1/home/ldk
```

**直し方。**くくりは `zone` で書く。ゾーンは幾何を持たず、パス接頭辞で配下を束ねるだけなので重ならない。住戸の面積はゾーンが配下から合計する。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

割るか割らないかの判断そのものは[数える分節と数えない分節](uncounted-divisions.md)にある。

## 6. 未定義の空間を参照していると言われる

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/bath t:120
```

```text
✖ ref.muro:line 6: References an undefined space: /L1/bath
```

**直し方。**パスの綴りを直す。層を重ねているときは、**その空間を宣言した層を `import` しているか**も確かめる。エラーは常に出所の層の名つきで返るので、どの層から見えていないのかが読める。

## 7. レベルが特定できないと言われる

**パスの先頭に `/L1/` と書いても、レベルを宣言したことにはならない。**`level` 行が別に要る。

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ nolevel.muro:line 3: /L1/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

メッセージはパスの書き方を指しているが、直すのは足りない `level` 行である。severity は `error` で終了コードは 1 — レベルが決まらなければ z が決まらず、この空間からは立体が一つも生成されない。

**直し方。**`level` 行を足す。ただし**その `level` を使う `space` 行より前に置く。**後ろに置くと同じエラーが出たままである。

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

パスの先頭でレベルを表さない書き方 (`/home/bed1` のように用途で束ねる) をするときは、空間側に `level:L1` を書く。

## 8. plan がスタックトレースを吐く

**`check` が緑でも `plan` は落ちることがある。**描画は `check` の検査対象ではない。

```sh
koyu plan nolevel.muro -o out.svg
```

```text
Error: No level is defined
```

原因は `level` 行が一つも無いこと。`level L1 0 h:2400 slab:150` を足す。

宣言されたレベルはあるのに落ちるときは、**そのレベルに領域を持つ空間が一つも無い。**

```text
Error: There is no space with a region on level R
```

一方、レベル名そのものを間違えたときは、スタックトレースではなく呼び方の問題として返る。**レベル名は大文字小文字を区別する。**

```text
Undeclared level: l2 (declared: L1 L2 R)
```

終了コードは 2 で、宣言済みのレベル名が併せて印字される。`koyu levels` でも確かめられる。

## 9. 緑なのに外へ出られない

接する空間の間には、宣言が無ければ**扉のない壁**が導かれる。**扉は自動では付かない。**外皮と階段だけ宣言した二階建ては、`check` が緑のまま全室が密閉される。

```muro
koyu 1.0
name 密封された二室
unit mm
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW edge:W
boundary /L1/b /out t:150 spec:EW edge:E
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

```text
Cannot reach /out from /L1/a
```

`graph` を見ると、書いていない壁が見える。

```text
/L1/a (居室A)
  | wall → /out  (spec:EW)
  | wall → /L1/b
/L1/b (居室B)
  | wall → /out  (spec:EW)
  | wall → /L1/a
/out (外部)
  | wall → /L1/a  (spec:EW)
  | wall → /L1/b  (spec:EW)
```

`spec:` の付いていない `| wall` の行が、導出された既定の壁である。

**直し方。**通したい組に `boundary` を書き、字下げで `door` を置く。宣言すると、その組の既定の導出は止まる。

```muro-part
boundary /L1/a /L1/b t:120 spec:LGS
  door w:800
```

「到達できません」は、**起点か終点のパスが存在しないときにも同じ文言で返る。**まず `graph` で綴りを確かめる。

## 10. 緑なのに外皮が無い

既定の壁が導かれるのは、**領域を持つ空間どうし**が接している組だけである。`/out` のような領域を持たない空間との組には導出されない — どの外部に面しているかは名指しが情報だからである。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

境界一本は室の間の既定の壁で、外周には一枚も壁が無い。それでも緑である。

`validate` はこれを見ている。上の 9 の例に対する返りはこうなる。

```text
⚠ [envelope.gap] sealed.muro:line 7: Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
```

**直し方。**外部空間を宣言し、外周の室から一本ずつ境界を書く。外部は方角や性格ごとに割っておくと `edge:` の指定が楽になり、敷地の問いも立てられるようになる。

```muro-part
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

**内壁は自動、外壁は手書き。**この非対称は意図されたものである。

## 11. 属性が効かない

台帳に無い属性キーは、名前空間が無ければ**エラーになる。**黙って通ることはない。

```text
✖ att.muro:line 4: /L1/bath carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:浴室)
```

一方、**型 (`space` の第2位置引数) は開かれた語彙**であり、しかも任意である。koyu はこの位置を一切読まないので、どの語も自由語として運ばれ、検査も警告もされない。

| 型 | 解釈 |
|---|---|
| `exterior` | 外部。領域なしで書ける。床面積に算入しない |
| `void` | 吹抜け。床面積に算入せず、通行もしない |

`hall` も `wet` も `room` も `ldk` も自由語である。**採光の対象になるかどうかも型では決まらない。**`daylight:1` を書いた室だけが判定に入る。

```muro-part
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
```

```text
✖ /L1/bath	浴室	window 0.00 m2 / floor 14.40 m2 = no window (needs 1/7 ≈ 2.06 m2)
✖ Short of 1/7: 1 of 1 room (this is a validation judgement)
```

`daylight:1` を落とすと、型を一字も変えずに判定から外れる。

```text
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

**直し方。**書ける属性の一覧は[属性の三層](../reference/muro/attributes.md)にある。どの層がその値を与えたかは `koyu layers --attrs` が印字する。

## 12. 空のファイルも緑になる

```text
✔ Consistent — 0 spaces / 0 boundaries
```

`check` が見るのは「書かれた構成が成立しているか」だけである。**緑は「書けている」ことの証拠ではない。**

```text
Total 0.00 m2 (indoor floor area)
```

**直し方。**中身は `stats` (面積)・`graph` (隣接)・`doors` (動線)・`light` (採光)・`site` (敷地) で見る。

## 13. 境界の数が二つの場所で違う

```text
✔ Consistent — 2 spaces / 1 boundary
```

```text
  "boundaries": []
```

**同じファイルの結果である。**`check` は導出後のモデルの本数を数え、正準 JSON は**書かれた構成だけ**を保存する。既定境界は正準 JSON に出ない。

食い違いではなく、二つの層の役割の違いである。正準 JSON から意味を読む側は `deriveDefaultBoundaries` を適用してから読む。導出後の姿を見たいときは `graph` が答える。

## 関連

- [症状から診断を引く](by-symptom.md) — 症状の索引
- [診断コード索引](../reference/diagnostics/index.md) — コードから引く 65 件の全目録
- [数える分節と数えない分節](uncounted-divisions.md) — 5 の判断そのもの
- [属性の三層](../reference/muro/attributes.md) — 11 で照合する台帳
- [約束の範囲](../reference/scope.md) — 9・10・12・13 に共通する理由
