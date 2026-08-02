---
title: 階を足す
mode: howto
---

# 階を足す

一階建ての記述に上階を足し、階高が矛盾していないことと、上階から外へ出られることを確かめる。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 一階分の `.muro` が [`koyu check`](../reference/cli/check.md) エラー0で通っていること。
- `grid` と `level` を宣言しているファイルがどれか分かっていること。複数ファイルに割っているなら [層に割る](split-into-layers.md) を先に読む。

## 1. レベルを足す

`level` は建物全体の一貫性であり、複数ファイルに割っていても **entry (base層) が一度だけ**宣言する。位置引数の `z` は基準面からの mm、`h:` は基準天井高、`slab:` はその階の床組み厚である。

```muro-part
level L1 0    h:2400 slab:150
level L2 2900 h:2400 slab:500
level R  5800 slab:500
```

**空間を持たない最上位のレベルも宣言する。**上の `R` がそれで、L2 の階高 (= R の z − L2 の z) はこの行があってはじめて決まる。無ければ最上階には上限が無く、天井が階をまたいで伸びていても何も言われない。

宣言の順は使用より前でなければならない。`level` を書く前に `/L2/…` の空間を書けば、その空間のレベルは決まらない。文法と属性の一覧は [level](../reference/muro/level.md) にある。

## 2. 上階の空間を書く

**パスの先頭セグメントが宣言済みのレベル名なら、その空間はそのレベルに属する。**

```muro-part
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
```

パスにレベル名を使わない流儀 — `/home/bed1` のように住戸を根に置く書き方 — のときは `level:` で明示する。

```muro-part
space /home/bed1 bedroom X1..X2 Y1..Y3 level:L2 name:主寝室
```

どちらも書かなければ、領域を持つ空間のレベルが決まらず **SUF02 のエラー**になる。

```text
✖ nolevel.muro:line 10: /home/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

`/L2/…` というパスを書くこと自体はレベルの宣言ではない — `level L2 2900` の行が別に要る。

## 3. 上下をつなぐ

上下に重なる空間のあいだの既定は**床**である。書かなければ階段も吹抜けも無く、上階は宙に浮いたまま `check` を通る。階段・シャフト・吹抜けの書き方は [階をつなぐ](connect-storeys.md) にある。ここでは一行だけ足しておく。

```muro-part
boundary /L1/hall /L2/hall type:stair
```

階を跨ぐ関係は特定の階の層に属さない。複数ファイルに割っているなら base層に置く。

## 4. 上階の室から階段室へ扉を書く

接する空間の既定は**扉のない壁**である。上階に部屋を足しただけでは、その部屋はどこにもつながっていない。

```muro-part
boundary /L2/bed /L2/hall t:120
  door w:800
```

## 確かめる

ここまでを一つのファイルにまとめると次になる。

```muro
koyu 1.0
name 二階建ての稽古
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400 slab:150
level L2 2900 h:2400 slab:500
level R  5800 slab:500

space /L1/ldk  ldk     X1..X2 Y1..Y3 + X2..X3 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y2..Y3 name:玄関・階段
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
space /L2/void         X2..X3 Y1..Y2 name:リビング上部 void:1
space /out name:外部 outside:1

boundary /L1/ldk /L1/hall t:120
  door w:800 edge:E
boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:玄関
boundary /L2/bed /L2/hall t:120
  door w:800

boundary /L1/hall /L2/hall type:stair
boundary /L1/ldk /L2/void type:void
```

```sh
npx tsx src/cli.ts check two.muro
```

```text
✔ Consistent — 6 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

[`koyu levels`](../reference/cli/levels.md) が階高の積み上がりをテキストの矩計として返す。天井高と床組み厚の和が階高に収まっているかは、この行を読めば分かる。

```text
$ npx tsx src/cli.ts levels two.muro
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:150
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

上階まで通れることは [`koyu doors`](../reference/cli/doors.md) が答える。上階の部屋から外部までの最少扉数と経路が出る。

```text
$ npx tsx src/cli.ts doors two.muro /L2/bed /out
2 doors — /L2/bed → /L2/hall → /L1/hall → /out
```

## check が緑でも上階に行けないことがある

`check` が言うのは「書かれたものがデータとして矛盾していない」までである。垂直境界を宣言し忘れると、上階は宙に浮いたまま緑で通る。次は手順3の一行だけを抜いた同じファイルの出力である。

```text
$ npx tsx src/cli.ts check two-sealed.muro
✔ Consistent — 6 spaces / 6 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ npx tsx src/cli.ts doors two-sealed.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

**階を足したら必ず `doors` か [`koyu validate`](../reference/cli/validate.md) を通すこと。**閉じ込められた空間を機械的に洗い出す手順は [到達できない空間を見つける](find-unreachable.md) にある。

## 落ちるところ

### 上階に食い込む — HGT01 (error)

天井高と上階の床組み厚の合計が階高を超えると、高さの不変量に触れる。たとえば玄関ホールの天井だけを上げると、

```muro-part
space /L1/hall hall X2..X3 Y2..Y3 name:玄関・階段 h:2600
```

```text
✖ two.muro:line 13: /L1/hall collides into the floor above: ceiling height 2600 + L2's slab 500 = 3100 > storey height 2900
```

天井高を下げるか、`level L2` の `z` を上げて階高を確保するか、`slab:` を薄くする。ほぼ全面が吹抜けの下階だけは、例外として階をまたぐ天井高を宣言できる。

### 床も天井も生まれない — SUF03 (warning) / SUF01 (error)

上階レベルの `slab:` を書き忘れるとその階に床が一枚も生成されず、`h:` も落とすと天井高が決まらない。**値の無いところに既定値は捏造されない** — 痩せた形が黙って出ないよう、充足性の検査が言う。

```muro-bad
koyu 1.0
name 段の欠け
unit mm

grid X 0 3640
grid Y 0 3640
level L1 0 h:2400 slab:400
level L2 2900

space /L1/a room X1..X2 Y1..Y2 name:一階
space /L2/b room X1..X2 Y1..Y2 name:二階
space /out name:外部 outside:1
boundary /L1/a /out edge:S t:150
  door w:900
```

```text
⚠ thin.muro:line 8: Level L2 has no slab:, so not one floor is generated on this storey
✖ thin.muro:line 11: The ceiling height of /L2/b cannot be determined (neither the space's h: nor level L2's h: is there)
```

診断コードは `check --json` に出る。コードから原因を引く表は [診断リファレンス](../reference/diagnostics/index.md) にある。

## 次に

- [階をつなぐ](connect-storeys.md) — 階段・シャフト・吹抜けの書き分け
- [基準階を一度だけ書く](typical-floors.md) — 同じ階が何層も続くとき
- [到達できない空間を見つける](find-unreachable.md) — 足した階が閉じていないことの確認
