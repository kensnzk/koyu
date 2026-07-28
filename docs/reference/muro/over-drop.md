---
title: over / drop — 上書きと削除
mode: reference
---

# over / drop — 上書きと削除

`over` は既にあるものの属性を差し替え、`drop` は既にあるものを消す。`over` の直下に字下げして書く `+` / `-` / `=` は、開口や `area` のような**集合**を編集する。

三つとも muro 1.0 の語である。`koyu 0.5` 以前を宣言したファイルに書けば `check` が **VER04** (error) で止める。

## 対象の種別は、行の形で読む

`over` にも `drop` にも「これは空間だ」と言う語は無い。**行の形が種別を決める。**

| 書き方 | 対象 |
|---|---|
| `over /path …` | 空間。その名の空間が無ければ**ゾーン** |
| `over /pathA /pathB …` | 境界 (二つの空間パスを結ぶ関係) |
| `over level <名> …` | レベル |
| `over asset <名> …` | 建具アセット |
| `drop /path` | 空間。その名の空間が無ければゾーン |
| `drop /pathA /pathB` | 境界 |
| `drop column <名>` | 柱の宣言 |

パスは先頭が `/` かどうかで見分けられ、`level` と `asset` は行頭の語で見分けられる。パスが三つ以上並べばエラーである。

```text
✖ x.muro:line 1: Too many paths on the over target: /L1/a /L1/b /out
✖ x.muro:line 1: over takes the form over /path … / over /pathA /pathB … / over level <name> … / over asset <name> …
```

## over — 属性を差し替える

```muro-part
over /L1/a h:2400 spec:実測          # 空間
over /site area:1097.80              # ゾーン (同名の空間が無いので)
over /L1/a /L1/b t:150 type:open     # 境界
over level L3 h:2600                 # レベル
over asset SD1 w:900 style:hinged    # アセット
```

**`over` は定義ではない。**対象が既に合成されていなければエラーになる。

```text
✖ e1.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

存在しないものに意見だけを足すのは、たいてい綴り違いか、層の順序の思い違いである。

`over` は自由属性だけでなく、parse が持ち上げる典型化された値にも届く — 境界の `type` `t` `air` `edge`、レベルの `h` `slab` `underground` はいずれも上書きできる。

**レベルに書けるのは三語だけである。**

```text
✖ x.muro:line 1: Only h / slab / underground may be overridden on a level: spec
```

### 同じ空間対に境界が複数あるとき

`edge:` で辺を限定した境界を同じ空間対に複数書くことがある。`over /L1/a /L1/b t:250` は**その対の境界すべて**に届く。一枚だけを狙う言葉は無い。

### 既定の壁は上書きできない

接する空間の間には、宣言が無くても `wall` の境界が導かれる。この既定の境界は**すべての層を合成し終えてから**作られるので、合成の途中である `over` からは見えない。

```text
✖ o.muro:line 1: No such boundary for over: /L1/a | /L1/b
```

厚みや仕様を与えたい壁は、既定に頼らず `boundary` として宣言する。

### 強度

どの層の `over` が勝つかは、層の並びが決める。**後の層ほど強い。**同じ層が同じ属性に二度意見を持てばエラーである。規則は [合成の六規則](composition.md) にある。

## 集合の編集 — `+` / `-` / `=`

同じ座に複数の層が意見を持ちうるもの — 開口・`seg`・`area` — は、暗黙にマージされない。`over` の直下に字下げして、**明示された編集**を書く。

```muro-part
over /L1/a /L1/b
  - door D2                              # 削除
  = door D1 w:1000                       # 置換
  + window w:600 h:1200 at:0.9 name:W1   # 追加
```

**`over` の直下に置けるのはこの三つだけである。**

```text
✖ x.muro:line 2: Only + (add) / - (remove) / = (replace) may sit directly under over: door
```

対象によって、編集できる集合が違う。

| `over` の対象 | 編集できるもの |
|---|---|
| 境界 | `door` / `window` / `seg` |
| 空間 | `area` |
| ゾーン・レベル・アセット | 無い |

```text
✖ x.muro:line 2: over on a space edits area: door
```

### 同一性は「容れ物 + その中で一意な名」

`-` と `=` は要素を**名で指す**。`name:` を持たない要素は編集の対象にできない — 指す言葉が無いからである。

```muro-part
boundary /L1/a /L1/b t:120
  door w:900 name:D1     # 名がある — 後から編集できる
  door w:800 at:0.8      # 名が無い — 後から指せない
```

`+` で足す要素には `name:` が要る。同じ容れ物の中で名が重複すればエラー、`-` や `=` の指す名が一意でなければエラーである。

```text
✖ e2.muro:line 2: A door added with + requires name: (it is the name later statements point to)
✖ x.muro:line 2: Duplicate door name: D1
✖ x.muro:line 2: No such door: D9
✖ x.muro:line 2: The door name D9 is not unique
```

### `=` が差し替えるもの

`=` は**全置換ではない** — 名は残り、書いた属性だけが差し替わる。寸法として届くのは `w:` と `h:` の二つである。

```muro-part
over /L1/a /L1/b
  = door D1 w:1000        # 幅が 1000 になる
```

**位置 (`at:`) や辺 (`edge:`) は `=` では動かない。**書けば要素の属性としては残るが、開口はその場から移動しない。位置を変えたいときは消して書き直す。

```muro-part
over /L1/a /L1/b
  - door D1
  + door w:900 at:0.2 name:D1
```

## drop — 消す

**消えるのは、消すと書いたものだけである。**

```muro-part
drop /L1/store        # 空間
drop /L1/a /L1/b      # 境界
drop column C1        # 柱の宣言
```

対象が無ければエラーになる。黙って何もしないということはない。

```text
✖ x.muro:line 1: No such target for drop: /L1/nowhere
✖ x.muro:line 1: No such column: C9
```

`drop` が取れるのは空間・ゾーン・境界・柱の四つだけである。アセットとレベルは消せない。

```text
✖ y.muro:line 1: drop takes the form drop /path / drop /pathA /pathB / drop column <name>
```

### 空間を消せば、その関係も消える

境界は二つの空間の**間**にしか存在しない。だから空間が消えれば、その空間を端に持つ境界も一緒に消える。他の境界は無傷である。

### 境界を消しても、壁は戻ってくることがある

`drop /L1/a /L1/b` が消すのは**宣言**である。二つの空間が平面で接しているなら、合成の後に既定の `wall` が導かれ、そこに壁が立つ。消えるのは厚み・仕様・そして**その境界が持っていた開口**である。

扉を含んだ壁を `drop` すると、扉の無い既定の壁が残る — 通れなくなる。

### drop column は同名が複数なら拒む

柱の同一性も「名」である。同じ名の柱の宣言が二つあれば、どちらを消すのかが書かれていないので、`drop` は**黙って両方消さずに拒む**。

```muro-part
column 700 L1 x:X1,X2 name:C1
column 600 L1 x:X3 name:C1
drop column C1
```

```text
✖ dropcol.muro:line 1: The column name C1 is not unique
```

名を分ければ通る。開口や `seg` の集合編集と同じ規律である。

## 上書きの跡は残らない

**`over` も `drop` も、合成後のモデルにも正準JSONにも残らない。**`over` で `h:2400` にした建物と、最初から `h:2400` と書いた建物は、同じ正準JSONを与える。`drop` した空間は、最初から書かれていなかったのと区別がつかない。

正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。

どの層が最終値を与えたかを知りたいときは、合成の途中を記録した出所を引く。

```text
$ koyu layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
  space:/L1/a:spec	← 2 as-built.muro
```

## 関連

- [合成の六規則](composition.md) — 強度・定義と上書きの区別・決定性・出所
- [import](import.md) — 層を読む一語と、層の並びの作られ方
- [boundary](boundary.md) — 境界の宣言と開口
- [space](space.md) — 空間の宣言と `area`
- [koyu layers](../cli/layers.md) — どの層が最終値を与えたかを印字する
