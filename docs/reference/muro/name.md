---
title: name / unit — 建物名と単位
mode: reference
---

# name / unit — 建物名と単位

どちらも任意である。一行も書かなくても `check` は緑になる。書くなら**一度だけ**で、二度目の意見は黙って上書きされずエラーになる。

## name — 建物名

```muro-part
name 街角の複合ビル
```

`name` はキーワードのあとの**行の残り全体**を値にとる。位置引数にも `key:value` にも割らないので、空白を含む名をそのまま書ける。`name 3F改修 h:2600` と書けば `h:2600` まで建物名の一部になる — この行に属性は無い。

行の読まれ方は他の行と同じで、`#` 以降はコメントとして落ち、引用符 `"` は取り除かれ、連続する空白は一つにつぶれる。

```muro
name  街角の  複合ビル # 仮称
unit mm
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

このファイルの建物名は `街角の 複合ビル` である。

```text
$ npx tsx src/cli.ts json nm.muro
{
  "format": "koyu-canonical/1.0",
  "name": "街角の 複合ビル",
  "unit": "mm",
```

値が空ならエラーになる。

```text
✖ nm.muro:line 1: name takes a value
```

### 一度だけ

建物名はモデルに一つである。**同じ文字列の再宣言は通り、違う文字列はエラーになる** — 後勝ちを黙認すると、どちらが建物の名だったのかが読めなくなる。

```muro-bad
name A
name B
grid X 0 3600
grid Y 0 4000
```

```text
✖ n2.muro:line 2: name is declared once (already "A" — in the base layer when composing)
```

合成しているときも規律は同じで、**層を跨いで一度**である。entry に書いても `import` した層に書いてもよいが、二つの層が違う名を主張すればエラーになり、後から読まれた側の出所が指される。基盤の宣言 (`koyu` / `name` / `unit` / [grid](grid.md) / [level](level.md)) は entry にまとめておくのが読みやすい。

### 属性の `name:` とは別物である

宣言の `name` は**建物**の名で、モデルに一つ。属性の `name:` は[空間](space.md)・[ゾーン](zone.md)・[分節](area.md)・開口などの**表示名**で、要素ごとに持つ。綴りが似ているだけで、書ける場所も数も違う。

```muro-part
name 街角の複合ビル                      # 建物の名 — 行の残り全体
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール   # 空間の表示名 — 属性
```

正準JSONでは前者はトップレベルの `"name"`、後者は要素の `attrs.name` に出る。書かなければどちらも鍵ごと出ない。

## unit — 単位

```muro-part
unit mm
```

単位は mm だけである。他の語を書けばエラーになる。

```text
✖ n3.muro:line 1: The only unit in v0 is mm: m
```

この行は宣言というより**表明**であって、書いても書かなくてもモデルは変わらない。正準JSONは `unit` 行の有無にかかわらず `"unit": "mm"` を出す。

単位の規約はこの一つに集約されている。

| 量 | 単位 |
|---|---|
| 長さ (座標・寸法・壁厚・天井高・開口幅) | mm |
| 線分上の位置 | 0..1 の比率 |
| 面積の出力 | ㎡ (壁芯) |
| 角度 | 書けない — 方向は[通り芯](grid.md)と辺の名 (N/E/S/W) が持つ |

`0.1` のような小数を長さに書くことはできるが、[通り参照](positions.md)のオフセットは整数のみである (`X2+600.5` は未定義の通り名として弾かれる)。

## 書く場所

どちらの行も字下げしない。`name` と `unit` は他の宣言の前後どこに置いてもよいが、`grid` と `level` は**使用より前**に置かなければ効かないので、実務上は次の順に並べることになる。

```muro-part
koyu 1.0
name 街角の複合ビル
unit mm
grid X 0 6400 12800
grid Y 0 5600
level L1 0 h:3600 slab:600
```

版の行については [koyu &lt;版&gt;](version.md) を見る。
