# 階を足す

一階建ての記述に上階を足し、階段でつなぎ、矩計と到達性で確かめる。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 一階分の `.muro` が `check` エラー0で通っていること。
- `grid` と `level` を宣言している base層 (entry) がどのファイルか分かっていること。複数ファイルに割っているなら [split-into-files.md](split-into-files.md) を見よ。

## 手順

### 1. base層に `level` を足す

`level` は建物全体の一貫性であり、base層 (entryファイル) が一度だけ宣言する。位置引数の `z` は基準面からの mm、`h:` は基準天井高、`slab:` はその階の床組み厚である。

```muro-part
level L1 0    h:2400
level L2 2900 h:2400 slab:500
level R  5800 slab:500
```

最上階も高さ検査にかけるときは、空間を持たない最上位のレベル (`R` など) も宣言する。これが無いと最上階には上限が無く、エラーも警告も出ないまま素通りする。

正確な定義は [spec/language.md §2](../../spec/language.md) を見よ。

### 2. 上階の空間を書く

パスの先頭セグメントがレベル名なら、その空間はそのレベルに属する。

```muro-part
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
```

パスにレベル名を使わない流儀 (`/home/bed1` のように住戸を根に置く書き方) のときは、`level:` で明示する。

```muro-part
space /home/bed1 bedroom X1..X2 Y1..Y3 level:L2 name:主寝室
```

`level:` も書かず、パスの先頭もレベル名でないときは警告になる。

```text
⚠ nolevel.muro:6行目: /home/a は領域を持ちますが、レベルが特定できません (パス先頭か level: で指定します)
```

この警告を残したままでも `check` は緑 (終了コード 0) で通るが、`plan` はその階を描けず Node のスタックトレースで落ちる。警告のうちに直すこと。`/L1/…` のようなパスを書くこと自体はレベルの宣言ではない — `level L1 0` の行が別に要る。

### 3. 吹抜けは `void` で書く

下階の天井が抜けているときは、上階側に `void` 型の空間を置き、下階の空間との間に `type:void` の垂直境界を書く。

```muro-part
space /L2/void void X2..X3 Y1..Y2 name:リビング上部

boundary /L1/ldk /L2/void type:void
```

`void` は床面積に算入されず、通行もできない。

### 4. 階段を垂直境界で宣言する

垂直の隣接は平面の重なりから導出され、既定は「床がある」である。階段はその例外だから宣言する — 上下の階に空間を置き、`type:stair` の境界で結ぶ。

```muro-part
boundary /L1/hall /L2/hall type:stair
```

階数が多いときは `stack` で一括宣言する。連続するレベル対にまとめて垂直境界を張る。

```muro-part
stack hall L1..L2 type:stair
```

階を跨ぐ関係は特定の階の層に属さない。複数ファイルに割っているなら base層に置く ([split-into-files.md](split-into-files.md))。

### 5. 上階の各室から階段室へ扉を書く

接する空間の既定は壁であり、既定の壁は扉を持たないから通れない ([ADR-0014](../../docs/decisions/0014-default-boundaries.md))。上階に部屋を足しただけでは、その部屋はどこにもつながっていない。

```muro-part
boundary /L2/bed /L2/hall t:120
  door w:800
```

## 確かめる

次のファイルが、ここまでの手順をすべて含んだ二階建てである。

```muro
koyu 0.3
name 二階建ての稽古
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R  5800 slab:500

space /L1/ldk  ldk     X1..X2 Y1..Y3 + X2..X3 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y2..Y3 name:玄関・階段
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
space /L2/void void    X2..X3 Y1..Y2 name:リビング上部
space /out exterior name:外部

boundary /L1/ldk /L1/hall t:120
  door w:800 edge:E
boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:玄関
boundary /L2/bed /L2/hall t:120
  door w:800

boundary /L1/hall /L2/hall type:stair
boundary /L1/ldk /L2/void type:void
```

`levels` が階高の積み上がりをテキストの矩計として返す。

```text
$ npx tsx src/cli.ts levels two.muro
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ 階高 2900 = 天井2400 + slab500
L1	z:0	h:2400
  ↑ 階高 2900 = 天井2400 + slab500
```

上階まで通れることは `doors` が答える。上階の部屋から外部までの最少扉数と経路が出る。

```text
$ npx tsx src/cli.ts doors two.muro /L2/bed /out
2枚 — /L2/bed → /L2/hall → /L1/hall → /out
```

## check が緑でも上階に行けないことがある

垂直境界を宣言し忘れると、上階は宙に浮いたまま `check` を通る。次は手順4の一行だけを抜いた同じファイルの出力である。

```text
$ npx tsx src/cli.ts check two-sealed.muro
✔ 整合 — 空間 6 / 境界 6

$ npx tsx src/cli.ts doors two-sealed.muro /L2/bed /out
/L2/bed から /out へは到達できません
```

`check` は構成が成立しているかを見るのであって、建物が使えるかは見ない。階を足したら必ず `doors` を通すこと。

なお `doors` は終点のパスが存在しないときも同じ文言を返す。パスの綴りを先に疑うとよい。

## 上階に食い込んだとき

天井高と上階の床組み厚の合計が階高を超えると、高さの不変量 (HGT01) に触れる。たとえば玄関ホールの天井だけを上げると、

```muro-part
space /L1/hall hall X2..X3 Y2..Y3 name:玄関・階段 h:2600
```

`check` はこう言う。

```text
✖ /L1/hall が上階に食い込みます: 天井高2600 + L2のslab500 = 3100 > 階高2900
```

天井高を下げるか、`level L2` の `z` を上げて階高を確保するか、`slab:` を薄くする。全面吹抜け (被覆率99%以上) の下階だけが階をまたぐ天井高を宣言できる。

上階レベルの `slab:` を書き忘れると検査そのものが働かず、警告になる。

```text
⚠ レベル L2 に slab が未宣言のため、L1 との高さ検査ができません
⚠ /L2/bed の天井高が不明で、R との高さ検査ができません
```

## 関連

- [how-to 一覧](README.md)
- [動線と避難を問う](doors-and-escape.md) — 階を足したあとに必ず通す検査
- [六つの考え](../concepts.md) — 垂直の既定が床であること、既定が壁であること
- [診断コード一覧](../diagnostics.md) — HGT01–HGT05 の原因と直し方
- [spec/semantics.md](../../spec/semantics.md) §3 垂直の導出と高さの不変量 — 規範の定義
- [spec/language.md](../../spec/language.md) §2 基盤の宣言・§4 boundary — `level` / `stack` / 垂直境界の文法
- 二階建ての実例 — `examples/house/` ([実例集](../gallery.md))
