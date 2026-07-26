[English](../en/howto/unit-layout.md) · **日本語**

# 住戸を間取りに割る

一室として書いてある住戸を、LDK・洋室・水回りといった室に割る。割ったあとも住戸単位の面積が壊れないようにする。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 住戸が一つの `space` として書けていて、`check` がエラー0で通っていること。
- その住戸の領域 (`X?..X? Y?..Y?` の合併) が分かっていること。

## 領域を持つ親の下に、領域を持つ子は置けない

これが最初に踏む罠である。住戸の `space` を残したまま子の `space` を足すと、親の領域と子の領域が重なる。

```muro-bad
koyu 0.4
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450

space /L3/A unit X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2400 name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
```

```text
✖ 空間の領域が重なっています: /L3/A と /L3/A/ldk
✖ 空間の領域が重なっています: /L3/A と /L3/A/bed1
```

パスの親子関係は面積の二重算入を免除しない。`/L3/A` と `/L3/A/ldk` は、パスの上で親子であっても、平面の上では重なった二つの空間である。

## 手順

### 1. 親を `zone` に置き換える

住戸の行を `space` から `zone` に変える。`zone` は幾何を持たず、パス接頭辞で配下の空間を束ねる集約である。領域・型は書かない。

```muro-part
zone /L3/A name:Aタイプ use:exclusive
```

`space` の行を消し忘れると、ゾーンと同じパスの空間が残って警告になる。

```text
⚠ unit.muro:9行目: ゾーンと同じパスの空間があります (どちらかに寄せます): /L3/A
```

### 2. 子の空間で住戸の領域を敷き詰める

子の領域の合併が、もとの住戸の領域と一致するように書く。壁芯で敷き詰めれば、ゾーンの導出面積はもとの住戸の面積に一致する。

```muro-part
space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
```

L字の室は矩形の合併 (`+`) で書く ([ADR-0005](../../docs/decisions/0005-zones-and-unions.md))。

### 3. 室のあいだに扉を書く

接する空間の既定は壁である。間仕切りそのものは書かなくてよいが、扉は書かないと通れない。

```muro-part
boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
```

同じ二室が L 字で二辺に接するときは、`edge:` で辺を選ぶ。

### 4. 玄関で外側につなぐ

住戸を割ると、外側 (内廊下・外部) と接するのは住戸ではなく個々の室になる。玄関の扉は玄関ホールと廊下のあいだの境界に移す。

```muro-part
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

## 確かめる

```muro
koyu 0.4
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450

zone /L3/A name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
space /L3/corridor corridor X1..X3 Y2..Y3 name:内廊下 use:common

boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/bed2 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/hall t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

```text
$ npx tsx src/cli.ts check unit.muro
✔ 整合 — 空間 6 / 境界 10
```

宣言した境界は 5 本だが、`境界 10` と出る。接して宣言の無い組 (洋室1と洋室2、水回りと内廊下 …) に既定の壁が導出されているからである ([ADR-0014](../../docs/decisions/0014-default-boundaries.md))。

`stats` が、間取りに割ったあとも住戸の言葉で面積を返すことを確かめる。

```text
$ npx tsx src/cli.ts stats unit.muro
L3
  /L3/A/ldk	LDK	ldk	33.28㎡
  /L3/A/bed1	洋室1	bedroom	10.24㎡
  /L3/A/bed2	洋室2	bedroom	7.68㎡
  /L3/A/wet	水回り	wet	7.68㎡
  /L3/A/hall	玄関	hall	2.56㎡
  /L3/corridor	内廊下	corridor	25.60㎡
  小計 87.04㎡
合計 87.04㎡ (屋内床面積)
ゾーン別 (数える集約):
  /L3/A	Aタイプ	61.44㎡
  ldk: 33.28㎡
  bedroom: 17.92㎡
  wet: 7.68㎡
  hall: 2.56㎡
  corridor: 25.60㎡
use別: exclusive 61.44㎡ (70.6%) / common 25.60㎡ (29.4%)
```

`ゾーン別` の行が住戸の面積であり、`use別` の専有・共用比も一行も書き足さずに出る。`use:exclusive` はゾーンから配下の室へ継承される。

玄関から各室へ通れることは `doors` が答える。

```text
$ npx tsx src/cli.ts doors unit.muro /L3/A/bed1 /L3/corridor
3枚 — /L3/A/bed1 → /L3/A/ldk → /L3/A/hall → /L3/corridor
```

## 割ると変わること

- **`light` の対象は型では動かない。** 採光の対象は `daylight:1` の宣言だけが決める ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md))。割る前に住戸へ `daylight:1` を書いていたなら、割ったあとは**その宣言を室の側へ書き直す** — 書き直さなければ、割った瞬間に採光の判定が消える。どの室を対象にするかは設計者の判断であって、`ldk` や `bedroom` という綴りからは決まらない。
- **`stats` の型別が細かくなる。** 住戸一つが `unit` として計上されていたところが、`ldk` `bedroom` `wet` `hall` に分かれる。ゾーン別の行だけが粒度の変化を吸収する。
- **粒度は混在してよい。** 一部の住戸だけ割り、残りは一室のままにできる。`examples/tower/typical.muro` は A タイプだけを間取りまで割り、B〜F は `unit` 一室のまま置いている。

## 基準階でまとめて割るとき

同じ間取りが複数階に載るなら、パスの先頭セグメントをスパンで書く。宣言済みレベルの z 順に展開される。ゾーンも同じ書き方をとる。

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
space /L3..L10/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK
```

実例は `examples/tower/typical.muro` にある — L3..L10 の 8 層分の住戸と間取りを一度だけ書いている。

## 寸法と並びで割るとき

室の位置ではなく**寸法と並び**が決まっているなら、領域の代わりに `band` で書ける。帯は parse 時に通常の空間へ展開されるので、以降の手順 (`zone` の親・境界・開口・確かめ方) は何も変わらない。

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

`examples/tower/typical.muro` の水回りと玄関はこの書き方である。全要素に寸法を書けば、合計が帯幅と一致することを parse が照合する。文法は [チートシート band](../cheatsheet.md)、規範は [spec/language.md §3 帯](../../spec/language.md)。

## 関連

- [how-to 一覧](README.md)
- [窓を開けて採光判定を通す](daylight.md) — 割った室に窓を開ける
- [動線と避難を問う](doors-and-escape.md) — 玄関から各室まで通れるかを数える
- [六つの考え](../concepts.md) — パスが同一性であること、既定が壁であること
- [診断コード一覧](../diagnostics.md) — GEO01 / GEO02 / ZON01 / ZON02 の原因と直し方
- [spec/language.md](../../spec/language.md) §3 space・§5 zone — 領域の合併とゾーンの文法
- [spec/semantics.md](../../spec/semantics.md) §6 stats — 面積の集計軸の定義
- [ADR-0005](../../docs/decisions/0005-zones-and-unions.md) — 粒度の混在を許した理由
