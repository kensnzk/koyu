[English](en/diagnostics.md) · **日本語**

# 診断コード事典

`check` が返す診断の全コードを、**原因**と**直し方**つきで引くための頁である。コードと severity と概要の台帳は [spec/semantics.md §5](../spec/semantics.md) が持つ — ここはその台帳に、specが意図して載せない「なぜそうなるのか」「何を書き換えるのか」「最小の再現」を足す。

## まずコードを手に入れる

**人向けの `check` はコードを表示しない。** 出るのは日本語の本文だけで、`BND04` のようなコードはどこにも現れない。コードが要るときは `--json` を付ける。この頁を引く前に、まずこれを実行する。

```sh
koyu check bad.muro --json
```

たとえば次のファイル (二室が角でしか触れていない) を検査する。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

人向けの出力はこうなる。

```text
✖ <絶対パス>/bad.muro:6行目: 空間が接していないため境界を導けません: /L1/a | /L1/b
```

(先頭の出所は**解決済みの絶対パス**である。ここでは `<絶対パス>` と省略して示した。)

`--json` を付けると同じ診断がコードつきで出る。

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "空間が接していないため境界を導けません: /L1/a | /L1/b",
  "line": 6,
  "file": "<絶対パス>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

`message` は**本文だけ**で、位置接頭辞 (`ファイル:N行目: `) を含まない。位置は `line` / `file` が別に持つ。この頁が各コードに載せるメッセージも、この `message` と同じ本文である。診断の構造 (`code` / `severity` / `message` / `line` / `file` / `path` / `related`) の契約は [spec/semantics.md §5](../spec/semantics.md) と [ADR-0016](../docs/decisions/0016-diagnostic-contract.md) が持つ。

## severity と終了コード

severity は二つしかない。

| severity | 意味 | `check` の終了コード | `check --strict` の終了コード |
|---|---|---|---|
| `error` | 構成が成立していない | 1 | 1 |
| `warning` | 疑わしい (成立はしている) | 0 | 1 |

**警告も落としたいときは `--strict` を付ける。** CI の門番に置くのはこちらである。severity はコードの不変属性で、重さを変えたいときは新しいコードが切られる — 既存コードの severity が黙って変わることはない。

この頁の誤り例のブロックはすべて `koyu check --strict` で終了コード1になり、それぞれ**そのコードちょうど1件**を出す。手元に貼って確かめられる。印は severity で分かれていて、<code>```muro-bad</code> は `check` がエラーで落とすもの、<code>```muro-warn</code> は `check` は通り `--strict` で落ちるものである。この対応は `test/guide.test.ts` が全コードについて実行して検証している。

## 症状から引く

| 症状 | 見るコード |
|---|---|
| 境界を書いたのに「接していない」と言われる | [BND04](#bnd04) |
| 扉や窓を置いたら「線分が複数あります」と言われる | [OPN05](#opn05) |
| 階段や吹抜けを書いたのに叱られる | [VRT01](#vrt01) [VRT02](#vrt02) [VRT03](#vrt03) |
| 空間を並べたら「領域が重なっています」と言われる | [GEO02](#geo02) |
| レベルを書いたつもりが「レベルが特定できません」と言われる | [HGT05](#hgt05) |
| 階高の検算が通らない | [HGT01](#hgt01) [HGT02](#hgt02) |
| 検査が「できません」とだけ言う | [HGT03](#hgt03) [HGT04](#hgt04) |
| 敷地の数字が合わない | [SIT03](#sit03) [SIT05](#sit05) |
| ファイルが1行も読まれずに落ちる | [SYN01](#syn01) |

## 境界 — BND

<a id="bnd01"></a>
### BND01 — 同じ空間同士の境界は書けません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /out /out
```

`同じ空間同士の境界は書けません: /out`

**原因** — 境界は二つの**異なる**空間を結ぶ関係である。同じパスを二度書いた。コピーして片方だけ直し忘れた、というのがほぼ全部である。

**直し方** — 二つめのパスを本来の相手に直す。

<a id="bnd02"></a>
### BND02 — 境界が重複しています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

`境界が重複しています: /L1/a | /L1/b (既出: <絶対パス>/bad.muro:6行目)`

**原因** — 同じ空間対 (`edge` 限定まで同一) に境界が二本ある。並び順に意味は無いから、どちらが勝つとも決められない。この例のように `wall` と `open` が食い違っていても、黙って後勝ちにはしない。`related` に既出側の位置が入る。

**直し方** — 一本に統合する。辺ごとに違う仕様を与えたいなら、両方に `edge:` を付けて別の辺に限定する (`edge` が異なれば重複ではない)。

<a id="bnd03"></a>
### BND03 — 異なるレベルの空間に壁境界は書けません

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a t:120
```

`異なるレベルの空間に壁境界は書けません (垂直は type:stair/shaft/void): /L1/a | /L2/a`

**原因** — 階を跨いで壁は立たない。上下階を繋ぐつもりで `boundary` を書いたが、`type:` を省いたため既定の `wall` になった。

**直し方** — 上下階の関係を書くなら `type:stair` (階段) / `type:shaft` (EV等) / `type:void` (吹抜け) のいずれかを付ける。**床は書かない** — 上下階の隣接は平面の重なりから自動的に導かれ、既定は床である。

<a id="bnd04"></a>
### BND04 — 空間が接していないため境界を導けません

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

`空間が接していないため境界を導けません: /L1/a | /L1/b`

**原因** — 壁芯線分は両空間の割付から導出される。導出できる形で接していなければ、境界という関係が成立しない。もっとも多いのは**角でしか触れていない**場合である。上の例の `/L1/a` は `X1..X2 Y1..Y2`、`/L1/b` は `X2..X3 Y2..Y3` で、点 (X2, Y2) を共有するだけで長さを持つ辺を共有していない。**長さのある辺を共有していなければ「接している」ことにならない。** 座標が単にずれている (`Y2..Y3` と書くべきところを `Y3..Y4` と書いた) 場合も同じ症状になる。

**直し方** — 二室の矩形を紙に描いて、共有する辺があるか確かめる。無ければ割付を直す。本当に離れている二室を繋ぎたいのなら、間の空間 (廊下・ホール) を宣言して二本の境界に分ける。

**関連** — 接している空間の境界は既定で `wall` が導出されるので、そもそも書かなくてよい ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。`boundary` を書くのは、例外 (`open`・`air:1`) と属性・開口を載せるときである。

<a id="bnd05"></a>
### BND05 — 同じ空間対に edge 限定つきと無しの境界が併存しています

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b edge:E t:150
```

`同じ空間対に edge 限定つきと無しの境界が併存しています (線分が重なります): /L1/a | /L1/b`

**原因** — `edge` 無しの境界はその対の**全線分**を指す。`edge:E` の境界はそのうちの E 辺を指す。両方書くと、E 辺には二本の境界が重なって載る。壁厚 (`t`) も仕様も二重になる。BND02 (重複エラー) をすり抜けるが、意図した状態ではまずない。

**直し方** — 全辺に共通の指定なら `edge` 無しの一本に寄せる。辺ごとに変えたいなら、**すべて** `edge:` 付きに書き分ける。

<a id="bnd06"></a>
### BND06 — 外周に残る辺が無く、境界線分がゼロです

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:E t:150
```

`外周に残る辺が無く、境界線分がゼロです: /L1/a | /out`

**原因** — 領域を持たない空間 (`exterior` など) との境界は、部屋の外周から**他の空間と接する区間を除いた残り**である。上の例の `/L1/a` の E 辺は `/L1/b` が丸ごと占めているので、`/out` に面する残りが無い。書いた境界は何も指していない。

**直し方** — 辺の取り違えである。`edge:` の方角は**先に書いた空間 (a側) の矩形から見た向き**で、**N=+Y (北)・S=−Y (南)・E=+X (東)・W=−X (西)** である。X は東が正、Y は北が正。この例なら `edge:W` が正しい。方角を消して `edge` 無しにすると、残る三辺すべてを指す境界になる。

## 参照 — REF

<a id="ref01"></a>
### REF01 — 未定義の空間を参照しています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /L1/zzz
```

`未定義の空間を参照しています: /L1/zzz`

**原因** — `boundary` の書いたパスに対応する `space` が無い。パスのtypoか、`space` を書き忘れたか、合成 (`import`) でそのレイヤーが読み込まれていない。

**直し方** — パスの綴りを確かめる。別ファイルにあるはずの空間なら、base層に `import` があるかを見る。`koyu check <entry> --json` の `file` は合成に参加したレイヤーを言うので、意図したレイヤーが実際に読まれているかはそこで分かる。

**注** — `boundary` は空間より**前に**書いてよい (前方参照できる)。順序の問題ではない。前後を入れ替えても直らないのはそのためである。

## 空間と領域 — GEO・SEG (area)

<a id="geo01"></a>
### GEO01 — 領域同士が重なっています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X3 Y1..Y2 + X2..X3 Y1..Y2
```

`/L1/a の領域同士が重なっています`

**原因** — 一つの空間が `+` で束ねた矩形同士が重なっている。L字を書こうとして二つめの矩形の始点を間違えた場合に出る。重なった分は面積が二重に数えられてしまうので、通さない。

**直し方** — `+` で足す矩形は**互いに重ならない**ように割る。L字なら、縦長の一枚と、その横に足りない分だけの一枚に分ける。

<a id="geo02"></a>
### GEO02 — 空間の領域が重なっています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

`空間の領域が重なっています: /L1/a と /L1/b`

**原因** — 同じレベルの二つの空間が同じ場所を占めている。`related` に後から書いた側の位置が入る。

**直し方** — 割付を直す。ただし、**住戸を室に割ろうとしてこれが出たのなら、直し方は割付ではない。** 大きいほう (住戸・部門) を `space` ではなく `zone` にする。`zone` は幾何を持たず、パス接頭辞で配下の空間を束ねて面積を合計する集約であり、これが「全体と部分」を書く道具である。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

`zone` の定義は [spec/language.md §5](../spec/language.md) にある。

<a id="seg01"></a>
### SEG01 — 領域を持たない空間に area は書けません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /out exterior
  area X1..X2 Y1..Y2 floor:タイル
```

`領域を持たない空間 /out に area は書けません`

**原因** — `area` は室の内側の「数えない分節」であり、親の領域の一部を指す。親が領域を持たなければ指す先が無い。字下げの掛かる先を間違えて、意図した `space` の一つ下に落ちている場合が多い。

**直し方** — `area` を、領域を持つ `space` の直下に移す。

<a id="seg02"></a>
### SEG02 — area が領域からはみ出しています

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:タイル
```

`area が /L1/a の領域からはみ出しています`

**原因** — `area` の矩形が親の矩形に収まっていない。`area` は面積にも室数にもグラフにも影響しないため、エラーではなく警告である。

**直し方** — `area` の通り参照を親の範囲内に収める。`+` で複数矩形を持つ親では、`area` は**いずれか一枚の矩形**に収まっていなければならない。二枚にまたがる分節は、二本の `area` に分ける。

## 開口 — OPN

`door` は通行、`window` は採光を担う。位置の流儀 (比率 `at:0.5` / 通り参照 `at:X2+450`) は [spec/language.md §4](../spec/language.md) が定義する。

<a id="opn01"></a>
### OPN01 — hinge の軸違い

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 hinge:E
```

`hinge:E は垂直線分 (N/S)で指定します`

**原因** — `hinge` は吊元がどちら**端**かを言う。線分の向きに沿った方角でなければ意味が無い。上の例の二室は東西に並ぶので、共有する辺は**南北に走る垂直線分**であり、その両端は N と S である。

**直し方** — 線分が垂直 (南北に走る) なら `hinge:N` か `hinge:S`、水平 (東西に走る) なら `hinge:W` か `hinge:E`。省略すれば線分の始端側になる。

<a id="opn02"></a>
### OPN02 — 開口同士が重なっています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:2000 at:0.4
  door w:2000 at:0.6
```

`開口同士が重なっています (doorとdoor — 中心間 800mm < 必要 2000mm)`

**原因** — 同じ線分上の二つの開口が食い込んでいる。必要な中心間距離は `(w₁ + w₂) / 2` で、メッセージが実測値と必要値の両方を出す。

**直し方** — メッセージの数値を見て `at` を離すか、幅を詰める。比率 `at` は線分長に対する割合なので、線分が短いほど同じ比率差でも実距離は小さくなる。確実に置きたいときは通り参照 (`at:X2+900`) で絶対位置を書く。

<a id="opn03"></a>
### OPN03 — open境界の開口は通行に影響しません

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  door w:800
```

`open境界の開口は通行に影響しません (常に通れます)`

**原因** — `open` は「そこに物が無い」という宣言である。もともと常に通れるので、扉を足しても通行可能性は変わらない。`doors` の扉数にも算入されない。

**直し方** — 扉を数えたい (=建具が実在する) なら、境界を `wall` (既定 — `type:` を書かない) にして扉を載せる。開口部として開いているだけなら `door` の行を消す。

<a id="opn04"></a>
### OPN04 — 開口を置ける境界線分がありません

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 edge:N
```

`door を置ける境界線分がありません (/L1/a | /L1/b)`

**原因** — 開口の `edge:` で絞った先に線分が無い。上の例の二室は東西に並ぶので共有辺は E (a側から見て) にあり、N には何も無い。境界そのものに線分が無い場合 (BND04 / BND06 と同時に出る) も同じコードになる。

**直し方** — `edge:` の方角を直す (**N=+Y・S=−Y・E=+X・W=−X**、先に書いた空間から見る)。線分が一本しかない境界では `edge:` は不要である。

<a id="opn05"></a>
### OPN05 — 境界線分が複数あります

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  door w:800
```

`境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)`

**原因** — 外部 (`/out` など、領域を持たない空間) との境界は、部屋の外周のうち他室に接していない**残り全部**であり、ふつう複数の辺に分かれる。「その境界のどこに扉を置くのか」が決まらない。**外壁に開口を置くときは必ず `edge:` が要る**、と覚えてよい。

**直し方** — `edge:` で辺を選ぶ。方角は**先に書いた空間 (この例なら `/L1/a`) の矩形から見て、N=+Y・S=−Y・E=+X・W=−X**。X は東が正、Y は北が正である。玄関を南に置くなら `door w:900 edge:S`。

<a id="opn06"></a>
### OPN06 — 開口の幅が境界線分の長さを超えています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:5000
```

`doorの幅 5000 が境界線分の長さ 4000 を超えています`

**原因** — 幅が壁より長い。メッセージが線分の実長を出すので、割付との突き合わせはそこでできる。アセット参照 (`door SD1`) を使っている場合、幅はアセット側から来ていることがある。

**直し方** — `w` を縮めるか、割付を広げる。アセットの幅を個別に上書きするなら、インスタンス側に `w:` を書く (インスタンスがアセットに勝つ)。

<a id="opn07"></a>
### OPN07 — 開口の明示位置の軸違い

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  door w:800 at:Y1+2000
```

`door の位置 Y1+2000 は水平線分なのでX系の通りで指定します`

**原因** — 通り参照で位置を書くとき、線分に沿った軸の通りでなければ位置にならない。上の例の二室は南北に並ぶので共有辺は**東西に走る水平線分**であり、その上の位置は X 系の通りで測る。

**直し方** — 水平線分 (東西に走る) には `at:X…`、垂直線分 (南北に走る) には `at:Y…`。どちらか分からないときは、二室が東西に並ぶなら垂直線分 (Y系)、南北に並ぶなら水平線分 (X系) と考える。

<a id="opn08"></a>
### OPN08 — 開口の明示位置のはみ出し

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
```

`位置 Y1+200 では door (幅900) が境界線分からはみ出します (線分 0〜4000mm、中心の許容 450〜3550mm)`

**原因** — `at` が通り参照のときは**クランプしない**。比率 (`at:0.5` など) は線分に収まるよう自動で押し戻されるが、通り参照は「そこに置け」という明示なので、収まらなければ黙って動かさずエラーにする。`at` は開口の**中心**を指すので、端から `w/2` 以上内側でなければならない。

**直し方** — メッセージの「中心の許容」の範囲に `at` を収める。上の例なら `at:Y1+450` 以上。端に寄せたいだけなら比率で `at:0` と書けば、クランプされて端いっぱいに収まる。

## 境界上の分節 — SEG

`seg` は境界上の「数えない分節」— 壁材が途中から変わる区間などを表す。位置の流儀は開口と同じで、診断も SEG04〜SEG08 が OPN04〜OPN08 と一対一に対応する。通行・接続には一切影響しない。

<a id="seg03"></a>
### SEG03 — open境界の seg は解釈されません

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:800 spec:X
```

`open境界 (壁が無い) の seg は解釈されません`

**原因** — `seg` は壁の一部の仕様を切り替えるものである。`open` には壁が無いので、切り替える対象が無い。

**直し方** — 壁があるなら `type:open` を外す (既定が `wall`)。無いなら `seg` の行を消す。

<a id="seg04"></a>
### SEG04 — seg を置ける境界線分がありません

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:800 edge:N spec:X
```

`seg を置ける境界線分がありません (/L1/a | /L1/b)`

**原因・直し方** — [OPN04](#opn04) と同じ。`edge:` の方角が線分の無い辺を指している。

<a id="seg05"></a>
### SEG05 — seg の境界線分が複数で曖昧

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  seg w:800 spec:X
```

`境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)`

**原因・直し方** — [OPN05](#opn05) と同じ。外壁の `seg` には `edge:` が要る。

<a id="seg06"></a>
### SEG06 — seg の幅が境界線分の長さを超えています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:5000 spec:X
```

`segの幅 5000 が境界線分の長さ 4000 を超えています`

**原因・直し方** — [OPN06](#opn06) と同じ。壁の全長にわたる分節を書きたいのなら、`seg` ではなく境界そのものの属性にする。

<a id="seg07"></a>
### SEG07 — seg の明示位置の軸違い

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  seg w:800 at:Y1+2000 spec:X
```

`seg の位置 Y1+2000 は水平線分なのでX系の通りで指定します`

**原因・直し方** — [OPN07](#opn07) と同じ。

<a id="seg08"></a>
### SEG08 — seg の明示位置のはみ出し

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:900 at:Y1+200 spec:X
```

`位置 Y1+200 では seg (幅900) が境界線分からはみ出します (線分 0〜4000mm、中心の許容 450〜3550mm)`

**原因・直し方** — [OPN08](#opn08) と同じ。通り参照はクランプしない。

## 垂直 — VRT

上下階の隣接は宣言しない — 平面の重なりから導かれ、既定は床である。書くのは例外だけ: `stair` (通行可) / `shaft` (連続するが通行不可) / `void` (床の不在)。

<a id="vrt01"></a>
### VRT01 — 垂直境界は領域とレベルを持つ空間同士に書きます

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out type:stair
```

`stair 境界は領域とレベルを持つ空間同士に書きます`

**原因** — 垂直の関係は「平面のここが上下で繋がる」という話なので、両側が領域とレベルを持っていなければ位置が定まらない。相手が `exterior` (領域なし) だったり、レベルが特定できていない空間だったりする。

**直し方** — 両側を、領域とレベルを持つ実在の空間にする。屋外階段を書きたいのなら、各階に階段室の空間 (半屋外なら `exterior` に `open` / `air:1` で面する空間) を立て、その間に `type:stair` を張る。

<a id="vrt02"></a>
### VRT02 — 垂直境界は隣り合うレベルの間に書きます

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L3/a room X1..X2 Y1..Y2
boundary /L1/a /L3/a type:stair
```

`stair 境界は隣り合うレベルの間に書きます: /L1/a | /L3/a`

**原因** — 一本の垂直境界が跨げるのは、z順で**隣り合う**レベルの一段だけである。上の例は L1 と L3 で、間の L2 を飛ばしている。

**直し方** — 段ごとに一本ずつ書く (`/L1/a | /L2/a` と `/L2/a | /L3/a`)。全階を貫くシャフトや階段室は `stack` の一行で一括宣言できる。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/ev shaft X1..X2 Y1..Y2
space /L2/ev shaft X1..X2 Y1..Y2
space /L3/ev shaft X1..X2 Y1..Y2
stack ev L1..L3 type:shaft
```

<a id="vrt03"></a>
### VRT03 — 垂直境界の空間が平面上で重なっていません

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
```

`stair 境界の空間が平面上で重なっていません: /L1/a | /L2/b`

**原因** — 上下に繋ぐには、平面上で重なっていなければならない。階段室・シャフトの上下階の割付が食い違っている。

**直し方** — 両階の矩形を揃える。階段の位置を階ごとにずらす設計なら、重なる範囲に踊り場の空間を挟む。

<a id="vrt04"></a>
### VRT04 — void境界の上側が type:void ではありません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
```

`void境界の上側は type:void の空間を想定しています: /L2/a`

**原因** — `type:void` の境界は「ここに床が無い」と言っている。その上に載っている空間が普通の室のままだと、床が無いのに床面積として数えられてしまう。

**直し方** — 上側の空間の型を `void` にする (`space /L2/a void X1..X2 Y1..Y2 name:リビング上部`)。`void` の空間は床面積に算入されず、`stats` に「吹抜け (床面積不算入)」と出る。

<a id="vrt05"></a>
### VRT05 — 垂直境界の開口は解釈されません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  door w:800
```

`垂直境界の開口は解釈されません`

**原因** — 開口は壁芯線分の上に載るもので、垂直境界に線分は無い。書いても採光にも通行にも図面にも効かない。`stair` は扉なしで通行可であり、扉を足しても `doors` の枚数は増えない。

**直し方** — 開口の行を消す。階段の入口に建具があるのなら、それは階段室と隣室の**水平**境界に載る扉である。

<a id="vrt06"></a>
### VRT06 — 垂直境界の seg は解釈されません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  seg w:800 spec:X
```

`垂直境界の seg は解釈されません`

**原因・直し方** — [VRT05](#vrt05) と同じ。垂直境界に線分は無い。

## 高さ — HGT

高さは宣言された不変量として検査される: **その空間の天井高 + 上階の `slab` ≤ 階高 (次のレベルの z までの差)**。積み上がりは `koyu levels` がテキストの矩計として見せる。

<a id="hgt01"></a>
### HGT01 — 上階に食い込みます

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

`/L1/a が上階に食い込みます: 天井高2800 + L2のslab400 = 3200 > 階高3000`

**原因** — 天井高と床組み厚の合計が階高を超えている。メッセージが三つの数字を全部出すので、どれを動かすかはそこで決まる。

**直し方** — 天井高を下げる (`level L1 0 h:2400`)、床組みを薄くする (`slab:200`)、階高を上げる (`level L2 3400 …`) のいずれか。その室だけ天井を下げたいなら空間側に `h:` を書く (`space /L1/a room X1..X2 Y1..Y2 h:2400` — 空間の `h` がレベルの `h` に勝つ)。吹抜けとして意図的に階を貫きたいなら [HGT02](#hgt02) を見よ。

<a id="hgt02"></a>
### HGT02 — 部分吹抜けの被覆不足

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:5400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

`/L1/a の天井高5400は階高3000を超えますが、吹抜けの被覆は50%です。部分吹抜けでは天井高を階高内に収めます (吹抜け部分の高さは導出)`

**原因** — 吹抜け (`type:void` 境界) は高さの不変量の**宣言的な免除**だが、免除が効くのは吹抜けが下階の平面を覆う範囲までである。上の例は下階の半分しか吹抜けていないのに、下階の天井高を階を貫く 5400 と宣言している。残り半分の上には床があるので、そこは 5400 にできない。免除が効くのは被覆率 99% 以上 (全面吹抜け) のときだけである。

**直し方** — 下階の天井高を階高内に収める (`level L1 0 h:2400`)。吹抜け部分の高さは `void` の関係から導出されるので、宣言する必要は無い。全面を吹抜けにしたいなら、`void` 空間の領域を下階の領域と同じにする。

<a id="hgt03"></a>
### HGT03 — 上階に slab が未宣言で高さ検査ができません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
level L2 3000 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

`レベル L2 に slab が未宣言のため、L1 との高さ検査ができません`

**原因** — 高さの不変量は上階の `slab` (床組み厚: スラブ+懐+仕上) が無いと立式できない。「間違っている」ではなく「**検査ができていない**」という報せである。緑のまま放置すると、高さの矛盾は誰も見ない。

**直し方** — 上のレベルに `slab:` を書く (`level L2 3000 h:2400 slab:500`)。最上階の上に空間の無い屋上レベル (`level R 5800 slab:500`) を足しておくと、最上階も検査の対象になる。

<a id="hgt04"></a>
### HGT04 — 天井高が不明で高さ検査ができません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0
level L2 3000 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

`/L1/a の天井高が不明で、L2 との高さ検査ができません`

**原因** — [HGT03](#hgt03) の裏返しで、今度は下階側の天井高が無い。空間に `h:` が無く、そのレベルにも `h:` が無い。

**直し方** — レベルに基準天井高を書く (`level L1 0 h:2400`)。個別に違う室だけ空間側に `h:` を書く。

<a id="hgt05"></a>
### HGT05 — レベルが特定できません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0
space /house/a room X1..X2 Y1..Y2
```

`/house/a は領域を持ちますが、レベルが特定できません (パス先頭か level: で指定します)`

**原因** — **これはパスの書き方の問題ではなく、`level` 宣言の問題であることが多い。** 空間は、パスの先頭セグメントが宣言済みのレベル名と一致するか、`level:` 属性を持つときにレベルに載る。上の例は `/house/…` という集計の階層でパスを切っているので、先頭セグメント `house` はレベル名ではない。逆に `/L1/a` と書いていてこの警告が出るなら、**`level L1 0` の行が無い** — パスに `/L1/` と書いただけではレベルは宣言されない。

**直し方** — 二つのどちらかである。

- パスを集計の階層で切りたい (`/home/ldk` など) → 空間に `level:` を書く: `space /house/a room X1..X2 Y1..Y2 level:L1`
- パスの先頭でレベルを言いたい (`/L1/a`) → `level L1 0` の行を base層に足す

**なぜ警告どまりか** — 領域はあるので構成としては成立している。ただし**レベルに載らない空間は平面図に現れない。** `check` が緑でも `koyu plan` が「レベル … に領域を持つ空間がありません」で落ちるのはこの状態である。

## レベル — LVL

<a id="lvl01"></a>
### LVL01 — レベルのzが同じです

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
level L2 0
```

`レベル L1 と L2 のzが同じです`

**原因** — 二つのレベルが同じ高さにある。z順の並びが決まらないので、上下関係も階高も定まらない。`level` の**範囲宣言** (`level L4..L10 11000 pitch:3000`) と個別宣言が同じ z にぶつかったときにも出る。

**直し方** — z を直す。同じ階に別名を与えたいだけなら、レベルではなく `zone` で束ねる。

## ゾーン — ZON

<a id="zon01"></a>
### ZON01 — ゾーンの下に空間がありません

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
zone /wing name:西棟
```

`ゾーン /wing の下に空間がありません`

**原因** — ゾーンはパス接頭辞で配下の空間を束ねる。束ねる先が一つも無いので、面積は 0 になり集計に何も現れない。ゾーンのパスと空間のパスがずれている (`/wing` と `/L1/wing/…`) のがほぼ全部である。

**直し方** — ゾーンのパスを、配下の空間の**共通接頭辞**に合わせる。`/L1/wing/a` を束ねるなら `zone /L1/wing`。まだ空間を書いていないだけなら、書けば消える。

<a id="zon02"></a>
### ZON02 — ゾーンと同じパスの空間があります

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/a/x room X2..X3 Y1..Y2
zone /L1/a name:重なった名
```

`ゾーンと同じパスの空間があります (どちらかに寄せます): /L1/a`

**原因** — パスが同一性であるのに、同じパスに空間 (幾何を持つ実体) とゾーン (集約) の両方がある。面積が二重に数えられる読み方ができてしまう。

**直し方** — どちらかに寄せる。全体を割って室にするなら、`space /L1/a` の領域を消して `zone /L1/a` にする。割らないなら `zone` の行を消す。**住戸を室に割るときの正しい形は「親を `zone` にして、子を `space` にする」** である ([GEO02](#geo02) を見よ)。

## 敷地 — SIT

敷地の検査は `site:1` を持つゾーンと、それに対応する `polygon` (測量に由来する所与の形) を対象にする。

<a id="sit01"></a>
### SIT01 — 敷地形状に重複する頂点があります

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1
polygon /site 0,0 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地形状に重複する頂点があります (0,0)`

**原因** — 連続する二頂点が同じ点 (1mm以内) にある。測量データの貼り付けで最終点が始点と重複した、というのが典型である。長さゼロの辺があると面積計算も交差判定も信用できない。

**直し方** — 重複した頂点を消す。多角形は閉じているものとして扱われるので、**始点を末尾にもう一度書く必要は無い。**

<a id="sit02"></a>
### SIT02 — 敷地形状が自己交差しています

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 0,10000 10000,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地形状が自己交差しています (5000,5000 付近)`

**原因** — 辺が互いに交差している (蝶ネクタイ形)。頂点の**並び順**が間違っている。面積も内外の判定も定義できないので、以降の敷地検査は打ち切られる。

**直し方** — 頂点を外周に沿った順 (時計回り・反時計回りのどちらでもよい) に並べ直す。メッセージが交点の座標を出すので、その付近の二辺を見る。

<a id="sit03"></a>
### SIT03 — 敷地形状からはみ出しています

`error`

```muro-bad
grid X 0 10000 14000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

`/L1/a が敷地形状からはみ出しています (14000,0 付近)`

**原因** — 領域を持つ空間が敷地の外に出ている。四隅の内包だけでなく多角形の頂点の入り込みと辺の交差も見るので、凹んだ敷地でも正しく捕まる。境界上は内側扱い (許容1mm)。敷地ゾーン配下の空間 (`/site/…`) と `exterior` は検査の対象外である。

**直し方** — 割付を敷地内に収めるか、`polygon` の測量値を直す。メッセージが最初に見つけたはみ出し点の座標を出す。

<a id="sit04"></a>
### SIT04 — polygon に対応するゾーンがありません

`warning`

```muro-warn
grid X 0 10000
grid Y 0 10000
level L1 0
polygon /site 0,0 10000,0 10000,10000 0,10000
space /L1/a room X1..X2 Y1..Y2
```

`polygon /site に対応するゾーンがありません`

**原因** — `polygon` はゾーンのパスに対応させて書く。対応するゾーンが無いので、この形は敷地として使われない — 面積も接道もはみ出し検査も動かない。`zone` を書き忘れたか、パスの綴りが違う。

**直し方** — 同じパスのゾーンを宣言する: `zone /site name:敷地 site:1`。`site:1` が無いと `site` の問いの対象にならないので、忘れずに付ける。

<a id="sit05"></a>
### SIT05 — 敷地面積の宣言と導出が食い違います

`warning`

```muro-warn
grid X 0 10000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地面積の宣言と導出が食い違います: 宣言 120㎡ / 導出 100.00㎡`

**原因** — ゾーンの `area:` (測量値) と `polygon` から計算した面積が 0.05㎡ を超えてずれている。頂点の打ち間違いか、`area:` の転記ミスか、測量図の更新が片方にしか反映されていない。

**直し方** — どちらが正しいかを決めて片方を直す。`area:` は測量成果の転記なので、ふつう疑うべきは `polygon` の頂点である。`koyu site <file>` が両方の数字を並べて出す。

## 同一性 — UID

`uid` は不透明トークンで、`space` と `zone` を跨いでモデル全体に一意である。パスを変えても同じものだと言うために使い、`diff` の改名検出がこれを読む ([ADR-0015](../docs/decisions/0015-identity-uid.md))。

<a id="uid01"></a>
### UID01 — uid は数字だけのトークンにできません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:0123
```

`uid は数字だけのトークンにできません: uid:123 (sp-123 のような形にします)`

**原因** — 数値の形をした属性値は数値として保持される。`0123` と書いても `123` になり、書いたトークンの区別が失われる (メッセージが `uid:123` と言っているのがまさにそれである)。同一性を担うトークンでこれは許されない。

**直し方** — 数字以外を混ぜる。`uid:sp-0123` のように接頭辞を付けるのが簡単である。

<a id="uid02"></a>
### UID02 — uid に空白は使えません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:"sp 1"
```

`uid に空白は使えません: "sp 1"`

**原因** — 引用符で囲めば空白を含む値は書けるが、`uid` は不透明トークンなので空白を許さない。空の値も同じく通らない。

**直し方** — 空白をハイフンかアンダースコアに置き換える (`uid:sp-1`)。

<a id="uid03"></a>
### UID03 — uid が重複しています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:sp-1
space /L1/b room X2..X3 Y1..Y2 uid:sp-1
```

`uid が重複しています: sp-1 (space /L1/a — <絶対パス>/bad.muro:4行目, space /L1/b — <絶対パス>/bad.muro:5行目)`

**原因** — 同じ `uid` が二箇所にある。`space` と `zone` を跨いで一意でなければならない。行をコピーして `uid` を直し忘れた場合に出る。メッセージと `related` が全ての出所を並べる。

**直し方** — 片方を別のトークンに変える。合成 (`import`) で別レイヤーと衝突している場合は、レイヤーごとに接頭辞を決めておくと事故が減る。

## 採光 — DAY

<a id="day01"></a>
### DAY01 — daylight は 1 (採光判定の対象) か 0 (対象外) です

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 daylight:yes
```

`daylight は 1 (採光判定の対象) か 0 (対象外) です: /L1/a に daylight:yes`

**原因** — `daylight` は「この室に採光の 1/7 判定を掛けるか」の二値の宣言であり、`light` の**唯一の入口**である ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md))。`daylight:yes` `daylight:true` のような綴りは自由属性として通ってしまい、その室は黙って対象外に落ちる — 判定の全損になるので、値を0/1に限って弾く。

**直し方** — `daylight:1` (判定する) か `daylight:0` (しない) にする。型は何であってもよい — `wet` に `daylight:1` を書けば対象に入り、`bedroom` に何も書かなければ対象外である。

## 版 — VER

<a id="ver01"></a>
### VER01 — koyu 0.1 のファイルに境界が宣言されていない接触ペアがあります

`error`

```muro-bad
koyu 0.1
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a hall X1..X2 Y1..Y2
space /L1/b hall X2..X3 Y1..Y2
```

`koyu 0.1 のファイルに境界が宣言されていない接触ペアがあります: /L1/a | /L1/b — 0.2では既定の壁が導出され意味が変わります。境界を宣言するか、koyu 0.2 へ上げます`

**原因** — 0.1 では「接しているのに境界が無い」は警告どまりで、境界は生えなかった。0.2 では既定の壁が導出される ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。同じファイルが版によって違う意味を持つので、黙って新しい意味で読むことはしない。旧版は**意味が保存される場合にだけ**受理される ([ADR-0017](../docs/decisions/0017-language-versioning.md))。

**直し方** — メッセージが示す二択のどちらかを選ぶ。

- 新しい意味で読ませる → 一行目を `koyu 0.2` にする
- 0.1 の意味を保つ → 指摘された対に `boundary` を明示的に書く

**注** — 版宣言を省略したファイルは常に最新版 (`0.4`) の意味論で読まれるので、このコードは出ない。意味を固定したいファイルには版を書く。(メッセージ本文が `0.2` を挙げるのは、このコードが `0.1` と `0.2` の境目の規定だからである。)

<a id="ver02"></a>
### VER02 — koyu 0.3 のファイルに daylight の無い room があります

`error`

```muro-bad
koyu 0.3
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
```

`koyu 0.3 のファイルに daylight の無い room があります: /L1/a — 0.4では型から採光の対象を推定しないので判定から外れます。daylight:1 (対象) か daylight:0 (対象外) を書いてから koyu 0.4 へ上げます`

**原因** — 0.3 以前は五つの型 (`unit` `room` `ldk` `bedroom` `living`) を採光の対象と推定して判定に載せていた。0.4 は型から対象を推定しない ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md))。`daylight` を書かないまま版を上げると、この室は**黙って採光の対象から外れ、`light` は「全室合格」と区別の付かない出力を返す**。旧版は意味が保存される場合にだけ受理されるので ([ADR-0017](../docs/decisions/0017-language-versioning.md))、ここで止める。

**直し方** — 指摘された室を判定するかどうかを書き、そのうえで版を上げる。

- 採光を判定する室である → `daylight:1` を足す
- 判定しない (納戸・物置・非居室として書いていた) → `daylight:0` を足す
- どちらの場合も、書き終えたら一行目を `koyu 0.4` にする

**注** — `daylight` が既に書かれている室は新旧で意味が同じなので、このコードは出ない。版宣言を省略したファイルも最新版で読まれるので出ない。

## 構文 — SYN

<a id="syn01"></a>
### SYN01 — 構文・合成エラー

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X9 Y1..Y2
```

`未定義の通り名です: X9`

**原因** — SYN01 は個別のコードではなく、**parse が投げた例外をひとまとめに写したもの**である。ファイルがモデルにならなかったのだから、意味の検査は一件も走っていない。構文エラーが一つでもあると `check` の結果は「SYN01 が1件」だけになる。

**注意** — このコードが出るのは `koyu check <file> --json` のときだけである。`--json` を付けない `check` や他のコマンドは、例外をそのまま `✖ <出所>:<行>行目: <本文>` として出して終了コード1で終わる。`--json` を付けたときだけ、有効なJSONを返すために SYN01 の1件に写される。

**よく出る本文と直し方**

| 本文 | 原因 | 直し方 |
|---|---|---|
| `未定義の通り名です: X1` | `grid X` がまだ書かれていない | `grid X` / `grid Y` を、通りを使う行より**前**に書く。`grid` と `level` は前方参照できない (`boundary` はできる) |
| `未定義の通り名です: X9` | その通りが grid の本数を超えている | `grid X 0 3600 7200` なら使えるのは X1〜X3。増やすか参照を直す |
| `領域は X?..X? と Y?..Y? の2つで指定します` | **型 (第2位置引数) を書き忘れた** — `space /L1/a X1..X2 Y1..Y2` | 型を足す: `space /L1/a room X1..X2 Y1..Y2`。メッセージは領域の話をするが、原因は型の欠落であることが多い |
| `space /L1/a に型(語彙)が要ります` | 型も領域も無い | 型を足す |
| `door には幅 w:(mm) が要ります (アセット側でも可)` | 開口に `w:` が無い | `door w:800` と書くか、幅を持つアセットを参照する (`door SD1`) |
| `未知のキーワードです: door` | 開口・`seg`・`area` の**字下げが無い** | 行頭に空白を入れて親行 (`boundary` / `space`) に従属させる |
| `未知のキーワードです: wall` | そのキーワードは存在しない | 壁は物ではなく関係である。`boundary` を使う |
| `未宣言のレベルです: level:L9` | `level:` の指す先が無い | `level L9 …` を宣言するか、綴りを直す |
| `属性キーが重複しています: name` | 同じ行に同じキーが二度 | 一つに寄せる。後勝ちの黙認はしない |
| `引用符が閉じていません` | `"` が奇数個 | 閉じる |
| `属性は key:value で書きます: …` | `:` の無いトークンが属性の位置にある | `key:value` にする。値に空白を含めるなら `"…"` で囲む |
| `レベルが重複しています: L2` | 同じレベル名を二度宣言した (範囲宣言との衝突を含む) | どちらかを消す |
| `grid X は一度だけ宣言します (合成時はbase層で)` | 複数レイヤーに `grid` がある | base層 (entry) に一本化する |
| `ファイルが読めません: ./assets.muro` | `import` の相対パスが違う | パスは**書かれたファイルからの相対**で解決される |

**注** — 属性キーの**綴り間違いは検出されない。** `nmae:居室A` と書いても、解釈されない自由な属性としてそのまま運ばれ、`check` は緑になる。解釈される属性の台帳は [spec/vocabulary.md](../spec/vocabulary.md) にある。同じく、型 (第2位置引数) は開かれた語彙なので、`bedroom` を `bedrom` と書いてもエラーにならない — 採光の対象から静かに外れるだけである。

<a id="bnd07"></a>
## 欠番 — BND07

`BND07` は**欠番**である。かつて「接しているのに境界が宣言されていません」という警告だったが、[ADR-0014](../docs/decisions/0014-default-boundaries.md) で廃止された。未宣言の接触は「未定義」ではなく「壁」を意味するようになり、警告が促していた宣言は既定の導出に置き換わった。台帳 (`DIAGNOSTIC_CODES`) にこのコードは無い。

## check が緑でも見ていないこと

**`check` は構成の整合を見るだけで、建物として使えるかは見ない。** 特に次の二つは、緑のまま通り抜ける。

**閉じた建物。** 接する空間の既定は壁であり、壁は扉が無ければ通れない。だから扉を一枚も書かなくても `check` は緑になる。二階建ての家を書いて、`check` が通ったから正しいと思ったら、寝室から外へ出られない — ということが起こりうる。

```sh
koyu doors <file> /L2/bed /out/road
```

これが「到達できません」と答えたら、動線が繋がっていない。`check` の後に必ず一度は通す。

**採光。** 窓を一枚も書かなくても `check` は緑になる。`koyu light <file>` が居室ごとの 1/7 判定を出す (終了コード 1 = 不足している室がある)。

コマンドの詳細は [cli.md](cli.md) を見よ。

## 関連

- [spec/semantics.md](../spec/semantics.md) §5 — コード・severity・概要の台帳 (規範)
- [spec/language.md](../spec/language.md) — 文法と既定値 (規範)
- [spec/vocabulary.md](../spec/vocabulary.md) — 解釈される属性の台帳 (規範)
- [cli.md](cli.md) — `check` の呼び方とフラグ、他のコマンド
- [api.md](api.md) — `checkDiagnostics` / `DIAGNOSTIC_CODES` をプログラムから使う
- [ADR-0016](../docs/decisions/0016-diagnostic-contract.md) — 診断契約が今の形になった理由
