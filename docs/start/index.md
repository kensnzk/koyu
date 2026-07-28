---
title: はじめての .muro — 一室から二階建てまで
mode: tutorial
---

# はじめての .muro — 一室から二階建てまで

koyu で二階建ての家を一つ書き、平面図を出し、動線と採光を確かめるまでを通す。所要 30〜45分。

この文書は**レッスン**である。上から順に、書いてあるとおりに進めてほしい。選択肢は出てこない。説明は最小限にとどめ、代わりに引くべき頁への入口を置いてある — 一度通り抜けてから読めばよい。

終わったときに手元にあるもの:

- 30行の `.muro` ファイル一つ
- 各階の平面図 (SVG)
- 「二階の寝室から外まで扉何枚か」「居室の採光は足りているか」への答え

**ツールの出力は英語である。**貼ってあるものは実際に走らせて得たままで、`✔` が成功、`⚠` が警告、`✖` がエラーである。例に書く名前が日本語のままなのは、それが書き手の言葉であってツールの言葉ではないからである。

## 準備

必要なのは Node.js (22以上) だけである。この頁はリポジトリをクローンして進める。npm から入れる道や他の入れ方は [koyu を入れる](install.md)にある。

```sh
git clone https://github.com/kensnzk/koyu.git
cd koyu
npm install
mkdir -p out
```

この先で書くファイルは `out/house.muro` 一つだけである。`out/` は `.gitignore` に入っているので、ここに置くものはリポジトリを汚さない。コマンドはすべてリポジトリのルートから実行する。

各段の到達点は `examples/steps/` に `01-one-room.muro` から `06-finished.muro` まで置いてある。迷ったら突き合わせてほしい。

## 第1段 — 一室

`out/house.muro` を作り、次の4行を書く。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/ldk ldk X1..X2 Y1..Y2
```

4行の中身はこうである。

- `grid X 0 3600 5400` — X軸の**通り芯**を宣言する。左から順に `X1` `X2` `X3` と自動で名が付く。位置は常にこの通り芯の言葉で書く — 座標を直に書く行は (敷地の形を除いて) この記法に無い。
- `grid Y 0 4000` — 同じくY軸。`Y1` `Y2` が生える。
- `level L1 0 h:2400 slab:150` — 高さ0mmに `L1` というレベルを置く。`h:` は基準天井高、`slab:` は床組みの厚みである。
- `space /L1/ldk ldk X1..X2 Y1..Y2` — 空間を一つ置く。`/L1/ldk` がこの空間の**パス** (同一性そのもの)、続く `ldk` が**型**、残りが領域である。

型は第2位置引数で、**省略できない**。パスの先頭が `L1` なので、この空間はレベル `L1` に属する。

`grid` と `level` は、それを使う行より前に書く。行の順序が意味を持つのはここだけで、たとえば `boundary` はまだ書いていない空間を先に参照してもよい。

検査する。

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

平面図を出す。

```sh
npx tsx src/cli.ts plan out/house.muro
```

```text
Generated the plan: out/house-L1.svg
```

`out/house-L1.svg` をブラウザで開く。

![一室だけの平面図。通り芯 X1 X2 Y1 Y2 と、淡い色の矩形が一つ。壁は一本も描かれていない](../img/start-01-one-room.svg)

**壁が一本も描かれていない。**空間はあるが、境界が一つも無いからである。壁は空間に付属する持ち物ではない。

`check` が見るのは「書かれたものが整合しているか」だけである。空のファイルも `✔ Consistent — 0 spaces / 0 boundaries` で通る。緑は「正しい建物」の意味ではない — この点は第5段で正面から扱う。

引くなら [grid](../reference/muro/grid.md)・[level](../reference/muro/level.md)・[space](../reference/muro/space.md)。

## 第2段 — 二室、そして書いていない壁

`space` を1行足す。他は何も変えない。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2
```

検査する。

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**境界が 0 から 1 に増えている。**境界の行は一つも書いていない。

平面図を出し直して開く。

```sh
npx tsx src/cli.ts plan out/house.muro
```

![二室の平面図。X2通り芯の上に黒い帯が一本立ち、ldk と hall を分けている](../img/start-02-two-rooms.svg)

SVGの中身にはこの一行が増えている。

```text
<path d="M 261.5 284 L 261.5 84 L 266.5 84 L 266.5 284 Z" fill="#1f1f1f"/>
```

これが壁である。前の段の図に黒い帯は0本、この段では1本 — 増やした行は `space` 一行だけである。

ここで手を止めてほしい。**この記法には壁を描く操作が無い。**壁は二つの空間の間の境界であり、空間の割付から導出される。接する空間の組に境界の宣言が一つも無ければ、それは「未定義」ではなく「壁」を意味する。垂直方向の「床は書かない、既定は床」と対称の規定である。

導出される既定の中身は[既定の境界](../reference/muro/defaults.md)、共有辺から壁芯線分が起きる規則は[境界の形](../reference/form/boundaries.md)にある。

## 第3段 — 扉

導出された壁は物として立っているので、扉が無ければ通れない。穴をあけるには、その境界を**宣言**する必要がある。末尾に `boundary` と `door` の2行を足す (読みやすいように空行も入れた)。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150

space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000
```

`boundary` は二つの空間パスを結ぶ関係である。線分は書かない — 両空間の割付から導かれる。`t:120` は壁厚mm。

`door` の行は**字下げしてある**。字下げされた行は直前の親行に従属する、というのがこの記法の唯一の入れ子である。`door` には幅 `w` が要る。

検査して図を出す。

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts plan out/house.muro
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
Generated the plan: out/house-L1.svg
```

境界の数は 1 のままである。導出されていた壁が、宣言された壁に置き換わっただけだからである。

![二室の平面図。壁の中央に開口があき、1/4円の軌跡で開き戸が描かれている](../img/start-03-door.svg)

扉が通っているか、モデルに訊く。

```sh
npx tsx src/cli.ts doors out/house.muro /L1/ldk /L1/hall
```

```text
1 door — /L1/ldk → /L1/hall
```

**境界を宣言するのは、その境界について何か言うことがあるときだけである** — 厚み、仕様、開口。言うことが無ければ書かない。書かなくても壁はそこにある。

引くなら [boundary](../reference/muro/boundary.md)・[door](../reference/muro/door.md)・[開口の位置](../reference/muro/positions.md)。

## 第4段 — 外

外部は空間である。`space /out exterior` で宣言し、外皮の境界を自分で書く。

型が `exterior` の空間は領域を持たなくてよい。次のように書き足す。

```muro-bad
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150

space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800
boundary /L1/hall /out t:150
  door w:900 h:2000
```

検査すると落ちる。

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✖ …/out/house.muro:line 13: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/ldk | /out)
✖ …/out/house.muro:line 15: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/hall | /out)
```

(エラーは絶対パスで位置を言う。前半は `…` で省いてある。これは [OPN05](../reference/diagnostics/opn.md#opn05) である。)

これは外部が内部と違うところである。室と室の境界は一本の共有辺だが、室と外部の境界は**外周から他の空間と接する区間を除いた残り**であり、複数の辺に分かれる。`/L1/ldk` は北・南・西の3辺が外に面しているので、窓をどこに置きたいのか記法からは決まらない。

`edge:` で辺を選ぶ。方角は次のとおりである。

| 記号 | 向き | 図の上では |
|---|---|---|
| `N` | +Y | 上 |
| `S` | -Y | 下 |
| `E` | +X | 右 |
| `W` | -X | 左 |

X は東が正、Y は北が正である。`edge` の方角は**先に書いた空間の矩形から見る**。

南面に窓と玄関を置く。13行目と15行目に `edge:S` を足す。合わせて `ldk` に `daylight:1` を書く — これはこの段の終わりで使う。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150

space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S
```

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts plan out/house.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
Generated the plan: out/house-L1.svg
```

![外皮のついた平面図。外周がすべて黒い帯で囲まれ、南面に窓の芯線と玄関の開き戸が描かれている](../img/start-04-exterior.svg)

黒い帯は1本から10本になった。内壁が扉で2つに割れ、外周の6辺のうち南の2辺が窓と玄関でそれぞれ2つに割れた残りである。**内壁は自動、外壁は宣言。**外部との境界は書かなければ存在せず、書かなくても `check` は緑のままである。外皮は自分の目で確かめる持ち場だと憶えてほしい。

窓を入れたので、採光を訊ける。**koyu は「どの室を判定すべきか」を推測しない** — 型を `ldk` と綴ったことも `bedroom` と綴ったことも、判定の根拠にはならない。判定してほしい室に `daylight:1` を書く。5行目に足したのがそれである。

```sh
npx tsx src/cli.ts light out/house.muro
```

```text
✔ /L1/ldk	ldk	window 4.32 m2 / floor 14.40 m2 = 1/3.3 (needs 1/7 ≈ 2.06 m2)
✔ Every room meets 1/7 — 1 room in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

`hall` が出てこないのは、`daylight:1` を書いたのが `ldk` だけだからである。型は判定に一切関与しない — `hall` を `room` に書き換えても対象にはならず、`hall` のまま `daylight:1` を足せば対象になる。空間の型で構造として解釈されるのは `exterior` と `void` の二語だけで、残りは koyu が解釈しない自由な語である。

引くなら [方角と edge](../reference/muro/orientation.md)・[window](../reference/muro/window.md)・[採光の判定](../reference/validate/daylight.md)。

## 第5段 — 二階、そして緑の罠

二階を載せる。`level` を1行足し、空間2行、階段の境界1行、二階の外皮2つを足す。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/hall hall X2..X3 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2 daylight:1
space /L2/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /out t:150
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150
```

`/L2/…` のパスを持つ空間は `L2` に属する。`level L2 2800` の `2800` は L2 の床の高さで、`slab:400` は L2 の床組みの厚みである。

`boundary /L1/hall /L2/hall type:stair` が階段である。上下階の空間は平面が重なれば自動で隣接し、既定の解釈は「床がある」— 例外だけを境界で宣言する。`stair` は通行可、`shaft` は繋がるが通行不可、`void` は床の不在を意味する。

検査する。

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

高さの積み上がりを見る。

```sh
npx tsx src/cli.ts levels out/house.muro
```

```text
L2	z:2800	h:2400	slab:400
L1	z:0	h:2400	slab:150
  ↑ storey height 2800 = ceiling 2400 + slab 400
```

テキストの矩計である。天井高 + 上階のslab が階高を超えれば `check` がエラーにする。ここでは 2400 + 400 = 2800 でぴたりと収まっている。

二階の平面図を出す。レベルは `-l` で選ぶ。

```sh
npx tsx src/cli.ts plan out/house.muro -l L2
```

```text
Generated the plan: out/house-L2.svg
```

![二階の平面図。寝室と階段ホールが壁で仕切られ、外周は黒い帯で囲まれている。寝室の南面に窓がある](../img/start-05-L2-sealed.svg)

普通の二階の平面に見える。`check` も緑である。ここで動線を訊く。

```sh
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
```

```text
Cannot reach /out from /L2/bed
```

**寝室は完全に密閉されている。**`/L2/bed` と `/L2/hall` は接しているので既定の壁が導出されており、その壁には扉が無い。書き忘れではなく、書かなかったことが「壁」という意味を持ったのである。

直す。寝室と階段ホールの境界を宣言し、扉を切る。`boundary /L1/hall /L2/hall type:stair` の次に2行足す。

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/hall hall X2..X3 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2 daylight:1
space /L2/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /L2/hall t:120
  door w:800 h:2000

boundary /L2/bed /out t:150
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150
```

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
```

```text
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
2 doors — /L2/bed → /L2/hall → /L1/hall → /out
```

寝室から玄関ホールを抜けて外まで扉2枚。階段は扉ではないので数に入らない。

**境界の数は 7 のまま変わっていない。**導出されていた壁が、扉つきの壁に置き換わっただけである。`check` の出力も前後で一字も違わない — 密閉された家と使える家を、`check` は区別しない。

図を出し直すと、壁に扉が現れている。

```sh
npx tsx src/cli.ts plan out/house.muro -l L2
```

![二階の平面図。寝室と階段ホールの間の壁に開口があき、開き戸の軌跡が描かれている](../img/start-05-L2.svg)

ここが koyu を使ううえで一番大事なところである。

> `check` が緑でも建物が使えるとは限らない。動線は `doors` で、採光は `light` で、外皮は自分の目で確かめる。

この一行がなぜそうなっていて、どこまでを信用してよいのかは[緑の check は「使える建物」を意味しない](../why/green-is-not-a-building.md)で扱う。

引くなら [垂直動線](../reference/muro/vertical-circulation.md)・[koyu levels](../reference/cli/levels.md)・[koyu doors](../reference/cli/doors.md)。

## 第6段 — 仕上げ

最後に、これまで省いてきたものを足す。

```muro
koyu 1.0
name 小さな家

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK floor:オーク daylight:1
space /L1/hall hall X2..X3 Y1..Y2 name:玄関ホール floor:タイル
space /L2/bed bedroom X1..X2 Y1..Y2 name:寝室 floor:オーク daylight:1
space /L2/hall hall X2..X3 Y1..Y2 name:階段ホール
space /out exterior name:外部

boundary /L1/ldk /L1/hall t:120 spec:PW1
  door w:800 h:2000 name:LDK扉

boundary /L1/ldk /out t:150 spec:EW1
  window w:2400 h:1800 edge:S name:掃き出し窓
boundary /L1/hall /out t:150 spec:EW1
  door w:900 h:2000 edge:S name:玄関

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /L2/hall t:120 spec:PW1
  door w:800 h:2000

boundary /L2/bed /out t:150 spec:EW1
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150 spec:EW1
```

足したものは三種類である。

- **`koyu 1.0`** — 言語版の宣言。省いたファイルは常に最新版の意味論で読まれるので、ツールの版が上がると意味が動きうる。**新しく作るファイルには書く。**
- **`name`** — 建物名 (図面のタイトルになる) と、空間・境界・開口それぞれの名前。
- **`floor:` `spec:`** — koyu が解釈せず、そのまま運ぶ属性。物の名 (RC・LGS・EW1…) は `spec` の値として書く、というのがこの記法の構えである。

書けるキーは決まっている。**台帳に無いキーは、`acme.sensor` のように名前空間を持たなければ書けない** — 「見ていない」と「見て問題がない」を区別するための境界で、`floor` も `spec` も台帳に載っている語である。一覧は[属性](../reference/muro/attributes.md)にある。

同梱の例に見える `unit mm` は書かなくてよい。長さは mm しかない。

検査して、面積を出す。

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts stats out/house.muro
```

```text
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
L1
  /L1/ldk	LDK	ldk	14.40 m2
  /L1/hall	玄関ホール	hall	7.20 m2
  Subtotal 21.60 m2
L2
  /L2/bed	寝室	bedroom	14.40 m2
  /L2/hall	階段ホール	hall	7.20 m2
  Subtotal 21.60 m2
Total 43.20 m2 (indoor floor area)
  ldk: 14.40 m2
  hall: 14.40 m2
  bedroom: 14.40 m2
```

面積は壁芯である。両階の図を出す。

```sh
npx tsx src/cli.ts plan out/house.muro -l L1
npx tsx src/cli.ts plan out/house.muro -l L2
```

![一階の平面図。LDK と玄関ホール、南面に掃き出し窓と玄関](../img/start-06-L1.svg)

![二階の平面図。寝室と階段ホール、その間に扉](../img/start-06-L2.svg)

最後に、第5段の言いつけどおり動線と採光を確かめる。

```sh
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
npx tsx src/cli.ts light out/house.muro
```

```text
2 doors — /L2/bed → /L2/hall → /L1/hall → /out
✔ /L1/ldk	LDK	window 4.32 m2 / floor 14.40 m2 = 1/3.3 (needs 1/7 ≈ 2.06 m2)
✔ /L2/bed	寝室	window 2.16 m2 / floor 14.40 m2 = 1/6.7 (needs 1/7 ≈ 2.06 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

30行のテキストから、二階建ての家と、その平面図と、動線と採光の答えが出た。

## ここまでで使った語

この記法で行頭に来る語は16種類、字下げに置ける行は9種類しかない。ここまでで使ったのは `grid` `level` `space` `boundary` と、字下げの `door` `window`、それに `koyu` と `name` — 家一軒はそれで足りる。

残る `unit` `zone` `band` `stack` `asset` `polygon` `column` `import` `over` `drop` と、字下げの `seg` `line` `area`、帯の要素として字下げされる `space`、`over` の下に置く `+` `-` `=` は、規模が大きくなったとき・建物をファイルに割ったときの語である。全部の一覧は [.muro の全構文](../reference/muro/index.md)にある。

次にどこへ行くかは[次に読むもの](next.md)に、読者ごとに一枚ずつ並べてある。
