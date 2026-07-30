---
title: asset — 建具アセット
mode: reference
---

# asset — 建具アセット

```text
asset <名> door|window [key:value...]
```

`asset` は**参照される既定値の束**である。第四の要素ではない — 空間・境界・ゾーンに並ぶ何かではなく、[開口](door.md)の属性の出所を一箇所にまとめるだけの仕掛けである。

```muro-part
asset SD1 door   w:800  h:2000 style:sliding name:片引き戸
asset W1  window w:2600 h:2200 sill:0        name:掃き出し窓
```

第一位置引数が名、第二位置引数が `door` か `window` の別である。残りは属性で、そのまま参照側の既定値になる。

## 参照は開口の先頭トークン

開口の行の**先頭にある `key:value` でないトークン**がアセット名として読まれる。

```muro-part
boundary /home/ldk /home/hall1 t:120 spec:LGS
  door SD1 edge:E hinge:S swing:b
```

アセットの属性が既定になり、**インスタンスの属性が上書きする**。

```muro
koyu 1.0
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
asset D1 door w:900 h:2100 style:hinged name:玄関ドア
space /L1/a room X1..X2 Y1..Y2 name:室
space /out exterior name:外部
boundary /L1/a /out t:150
  door D1 w:1200 edge:S name:大扉
```

合成後の開口はこうなる。`h` と `style` はアセットから流れ込み、`w` と `name` はインスタンスが差し替えている。

```json
{
  "kind": "door",
  "ref": "D1",
  "w": 1200,
  "h": 2100,
  "at": 0.5,
  "edge": "S",
  "attrs": {
    "name": "大扉",
    "style": "hinged"
  }
}
```

参照そのもの (`ref`) は正準JSONに残る。アセットの定義も `assets` として残る。**アセットは合成で消えない** — 開口の属性へ焼き込まれたうえで、出所も保たれる。

## 書ける属性は開口と同じ

アセットは[開口の台帳](door.md)をそのまま使う。「アセットには書けるが開口には書けない属性」も、その逆も無い。

| 属性 | 層 |
|---|---|
| `w` `h` `at` `edge` `hinge` `swing` | 構造 |
| `style` `name` | 解釈 |
| `sill` `spec` `fire` | 運搬 |

台帳に無いキーはドットを含む名前空間を持たなければ書けない。

```text
✖ asset D1 carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:塗装)
```

## 三つのエラー

**kind が食い違えば止まる。**窓のアセットを扉として使うことはできない。

```text
✖ The asset W1 is a window (it cannot be used as a door)
```

**未定義の参照は止まる。**綴りの間違いが「アセット名でない先頭トークン」として黙って通ることはない。

```text
✖ Undefined opening asset: SD9
```

**名の重複は止まる。**同じファイルの中でも、`import` で重ねた層のあいだでも同じである。メッセージは `Duplicate asset name: D1` に続けて、既出の側の出所 (ファイルと行) を必ず示す。

## アセットの name は型の名である

`asset W1 window … name:掃き出し窓` の `name` は**建具の型の名**であって、個体の名ではない。だから同じアセットを一枚の壁に二枚並べても衝突しない。

```muro
koyu 1.0
unit mm
grid X 0 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
asset D1 door w:900 h:2100 name:片開き戸
space /L1/a room X1..X2 Y1..Y2 name:室
space /out exterior name:外部
boundary /L1/a /out t:150 edge:S
  door D1 at:0.25
  door D1 at:0.75
```

`check` は緑である。開口の同一性は「境界の中で一意な `name`」から来るが、**主張として数えるのはその開口の行に書かれた名だけ**で、参照したアセットから継いだ同じ値は主張ではない。両方に `name:D9` と書けば、そこではじめて衝突になる。

```text
✖ Duplicate opening name within boundary /L1/a | /out: D9 — the name is what identifies it inside its container
```

## 別ファイルに置く

アセット集は独立した層に置き、`import` で重ねるのが標準の運用である。

```muro-part
import ./assets.muro
```

同じ層は一度だけ合成されるので、二重の `import` も循環も冪等である。

## 隣り合う頁

- [door](door.md) / [window](window.md) — アセットを参照する側
- [boundary](boundary.md) — 開口が載る関係
- [koyu check](../cli/check.md)
