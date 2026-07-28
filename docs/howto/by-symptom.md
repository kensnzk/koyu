---
title: 症状から診断を引く
mode: howto
---

# 症状から診断を引く

**人向けの `check` の出力に診断コードは出ない。**出るのは `ファイル:行: 本文` だけである。手元にあるのが本文か、あるいは「なんとなくおかしい」という感触だけのとき、この頁から引く。

コードを持っているなら、ここではなく[診断コード索引](../reference/diagnostics/index.md)が速い。

## コードを手に入れる

`--json` を付けると同じ診断がコード付きで出る。

```sh
koyu check bad.muro --json
```

```text
[
 {
  "code": "SUF01",
  "severity": "error",
  "message": "The ceiling height of /L1/a cannot be determined (neither the space's h: nor level L1's h: is there)",
  "line": 4,
  "file": "<absolute path>/noh.muro",
  "path": [
   "/L1/a"
  ]
 }
]
```

`message` は**本文だけ**で、位置接頭辞を含まない。位置は `line` と `file` が別に持つ。読み方の詳しい手順は[診断を読む](../reference/diagnostics/reading.md)にある。

**severity は二つしかない。**`error` は構成が成立していない (終了コード 1)、`warning` は疑わしいが成立している (終了コード 0、`--strict` なら 1)。severity はコードの不変属性で、場合によって変わらない。

## 1. check がエラーで止まる

本文は完全一致で検索できる。以下は本文の一部である。

| 見えているもの | 原因 | 直し方 | コード |
|---|---|---|---|
| `Undefined grid line name: X1` | `grid` が無い、または通り参照を使う行より**後**にある | `grid X` と `grid Y` を、使う最初の行より前に書く → [よくある詰まり](troubleshooting.md#1-通り名が未定義だと言われる) | 合成エラー |
| `A region is given as two ranges, X?..X? and Y?..Y?` | ほとんどは**型 (第2位置引数) の書き忘れ**。領域の一つ目が型として読まれている | `space <パス> <型> X?..X? Y?..Y?` の順に書く → [よくある詰まり](troubleshooting.md#4-領域の書き方を叱られる) | 合成エラー |
| `has a region, but its level cannot be determined` | `level` 行が無い。**パスに `/L1/` と書いてもレベルの宣言にはならない** | `level L1 0 h:2400 slab:150` を、使う行より前に書く | [SUF02](../reference/diagnostics/suf.md) |
| `The ceiling height of … cannot be determined` | 空間の `h:` もレベルの `h:` も無い | どちらかに `h:` を書く | [SUF01](../reference/diagnostics/suf.md) |
| `The spaces do not touch, so no boundary can be derived` | 角だけで触れている。接触には**長さのある共有辺**が要る | 矩形を重ねて辺を共有させるか、その `boundary` 行を消す → [よくある詰まり](troubleshooting.md#2-接していないと言われる) | [BND04](../reference/diagnostics/bnd.md#bnd04) |
| `There is more than one boundary segment; pick an edge with edge:N/E/S/W` | 外部との境界が室の外周の複数の辺に割れている | 開口に `edge:` で辺を選ぶ。`N`=+Y / `S`=−Y / `E`=+X / `W`=−X | [OPN05](../reference/diagnostics/opn.md#opn05) / `seg` は [SEG05](../reference/diagnostics/seg.md) |
| `No boundary segment can hold the door` | その空間対に境界線分が一本も無い | 相手の空間と本当に接しているかを `koyu graph` で確かめる | [OPN04](../reference/diagnostics/opn.md#opn04) |
| `Space regions overlap:` | 領域を持つ空間の下に、領域を持つ子空間を置いている | 親を `zone` にする → [数える分節と数えない分節](uncounted-divisions.md) | [GEO02](../reference/diagnostics/geo.md#geo02) |
| `Regions within … overlap:` | 一つの空間が `+` で合併した矩形同士が重なっている | 重ならないように割る | [GEO01](../reference/diagnostics/geo.md#geo01) |
| `References an undefined space:` | パスの綴り違い、またはその空間を宣言した層を `import` していない | パスを直すか `import` を足す | [REF01](../reference/diagnostics/ref.md) |
| `Duplicate boundary:` | 同じ空間対に境界が二本ある | 一本に統合するか、両方に `edge:` を付けて別の辺に限定する | [BND02](../reference/diagnostics/bnd.md#bnd02) |
| `A wall boundary cannot be written to a space on a different level` | 階を跨ぐ関係を壁として書いている | `type:stair` / `type:shaft` / `type:void` を使う | [BND03](../reference/diagnostics/bnd.md#bnd03) |
| `Openings overlap` | 同じ境界線分の上で扉と窓が近すぎる | `at:` をずらす | [OPN02](../reference/diagnostics/opn.md#opn02) |
| `The door width … exceeds the boundary segment length` | 開口が壁より長い | 幅を縮めるか、壁を伸ばす | [OPN06](../reference/diagnostics/opn.md#opn06) |
| `is written as a positive number:` | 解釈される属性の値が数値として読めない (`h:24OO` のように英字が混じっている) | 綴りを直す | [ATT01](../reference/diagnostics/att.md) |
| `A boundary type is wall / open / stair / shaft / void:` | 語彙の決まった属性に台帳外の値を書いた | 台帳の語に直す | [ATT02](../reference/diagnostics/att.md) |
| `which is not in the ledger (check the spelling, or add a namespace…)` | **台帳に無い属性キーを、名前空間なしで書いた。**`nmae:` は黙って通らない | 綴りを直すか、運ぶだけの値なら `acme.note:` のように名前空間を付ける | [ATT03](../reference/diagnostics/att.md) |
| `daylight is either 1 … or 0` | `daylight:` に 0/1 以外を書いた | `daylight:1` か `daylight:0` にする | [DAY01](../reference/diagnostics/day.md) |
| `Duplicate uid:` | 同じ `uid` が二つの対象に付いている | 片方を `new_uids` が発行した新しい値にする → [同一性](../reference/identity.md) | [UID03](../reference/diagnostics/uid.md) |
| `A koyu 0.5 file uses a 1.0 word:` | 古い版を宣言したファイルに新しい語 (`over` / `drop` / 集合編集) を書いた | `koyu 1.0` に上げる | [VER04](../reference/diagnostics/ver.md) |
| `One layer holds two opinions about … ` | 同じ層が同じ属性に二度意見を持っている | 上書きは別の層から行う → [実測を計画に重ねる](write-as-built.md) | 合成エラー |
| `No such target for over:` | `over` の対象が合成されていない | 綴りを直すか、定義した層より後ろに置く | 合成エラー |
| `Duplicate space path:` | 二つの層が同じパスを定義している | 片方を `over` に変えるか、パスを分ける | 合成エラー |

## 2. check は警告だけ出す

`--strict` を付けない限り終了コードは 0 である。**放っておくと形が生成されないものが混じっている。**

| 見えているもの | 意味 | どうするか | コード |
|---|---|---|---|
| `has no slab:, so not one floor is generated on this storey` | そのレベルの床が一枚も出ない | `level L1 0 h:2400 slab:150` のように `slab:` を書く | [SUF03](../reference/diagnostics/suf.md) |
| `There are no spaces beneath zone …` | ゾーンの配下が空。パス接頭辞が噛み合っていない | ゾーンのパスか空間のパスを直す | [ZON01](../reference/diagnostics/zon.md) |
| `A space shares its path with a zone` | 同じパスに空間とゾーンの両方がある | どちらか一方にする | [ZON02](../reference/diagnostics/zon.md) |
| `A door on a vertical boundary is not interpreted` | 階段・シャフト・吹抜けの境界に開口を書いた。通行には効かない | 開口を消す。通行は垂直境界そのものが持つ | [VRT05](../reference/diagnostics/vrt.md#vrt05) |
| `A door on an open boundary has no effect on passage` | `type:open` は既に通れる | 開口を消すか、境界を `wall` に戻す | [OPN03](../reference/diagnostics/opn.md#opn03) |
| `cuts nothing` | 描いた線が既定の隣接線と同じか、割付の外にある | 線を引き直すか、消す | [LIN03](../reference/diagnostics/lin.md) |
| `The area spills outside the region of` | `area` が親の空間からはみ出している | 範囲を縮める → [数える分節と数えない分節](uncounted-divisions.md) | [SEG02](../reference/diagnostics/seg.md) |
| 柱の宣言に対して立つ柱が 0 本 | 通り芯の交点に床が無い、または半屋外で上に床が無い | 宣言する通りか、床のある範囲を見直す | [COL01](../reference/diagnostics/col.md) |

## 3. check は緑なのに正しくない

**ここには診断が無い。**`check` が言うのは「書かれたものがデータとして矛盾していない」までで、建物として使えるかは言わない。

| 症状 | 原因 | 確かめる道具 |
|---|---|---|
| 室から外へ出られない | 接する空間の既定は**扉のない壁**である。扉は自動では付かない | `koyu doors` / `koyu graph` → [よくある詰まり](troubleshooting.md#9-緑なのに外へ出られない) |
| 外皮が一枚も無い | 領域を持たない空間 (`/out`) との組には既定が導出されない | `koyu validate` の `envelope.gap` → [よくある詰まり](troubleshooting.md#10-緑なのに外皮が無い) |
| 空のファイルが緑になる | 何も書かれていない構成は成立している | `koyu stats` / `koyu graph` で中身を見る |
| 面積表に出したい室が出ない | `area` は数えない分節である。面積にも室数にも現れない | [数える分節と数えない分節](uncounted-divisions.md) |
| `check` の境界数と正準 JSON の `boundaries` が合わない | `check` は導出後の本数、正準 JSON は**書かれた構成だけ** | 食い違いではない → [よくある詰まり](troubleshooting.md#13-境界の数が二つの場所で違う) |
| 属性が効いていない | 台帳に無いキーはエラーになるが、**値の綴り違いは運ばれる** | `koyu layers --attrs` で出所を引く |
| 型を変えたのに採光の判定が変わらない | 採光の対象は型ではなく `daylight:1` が決める | `koyu light` |

## 4. check は何も言わない — validate が言う

建築の側の判断は `koyu validate` が別に返す。**`check` の診断コードではなく、`章.規則` の綴りを持つ。**

| 症状 | 規則 |
|---|---|
| 外周に何も面していない部分がある | [`envelope.gap`](../reference/validate/envelope.md) |
| 窓が床面積の 1/7 に足りない | [`daylight.ratio`](../reference/validate/daylight.md) |
| 窓の `h:` が無くて窓面積を数え切れていない | [`daylight.unknown`](../reference/validate/daylight.md) |
| 階段の踏面が窮屈・蹴上と踏面の関係が常用域の外 | [`stair.proportion`](../reference/validate/runs.md) |
| 傾斜路の勾配が宣言より急 | [`run.slope`](../reference/validate/runs.md) |
| 縦動線の形はあるが上下が繋がっていない | [`run.disconnected`](../reference/validate/runs.md) |
| 室から外部へ辿り着けない | [`access.unreachable`](../reference/validate/access.md) |
| 扉が吹抜けにしか開いていない | [`access.voidonly`](../reference/validate/access.md) |
| 柱が扉と重なっている | [`column.blocksdoor`](../reference/validate/column.md) |
| 建物が敷地形状からはみ出す | [`site.escape`](../reference/validate/site.md) |
| 敷地面積の宣言と導出が食い違う | [`site.area`](../reference/validate/site.md) |
| 接道長が足りない | [`site.frontage`](../reference/validate/site.md) |

規則の全部は[判定 — koyu validate](../reference/validate/index.md)にある。

## 5. コマンドそのものが落ちる

| 見えているもの | 終了コード | 原因 |
|---|---|---|
| `Undeclared level: l2 (declared: L1 L2 R)` | 2 | `-l` のレベル名違い。**大文字小文字を区別する。**`koyu levels` で確かめる |
| `Usage: koyu …` の使い方行 | 2 | 引数が足りない。`--help` も同じ経路を通る |
| `Error: No level is defined` (スタックトレース付き) | 1 | `level` 行が一つも無い。`check` は緑でも描画は落ちる |
| `Error: There is no space with a region on level R` (スタックトレース付き) | 1 | そのレベルに領域を持つ空間が一つも無い |
| `Cannot reach /out from /L1/nope` | 1 | 到達不能。**起点か終点のパスが存在しないときも同じ文言**である。`koyu graph` で綴りを確かめる |

**呼び方の問題は終了コード 2、構成の問題は 1 である。**この二つを混ぜないので、CI で区別して扱える。

## 関連

- [よくある詰まり](troubleshooting.md) — 上の表のうち、手順で直すもの
- [診断コード索引](../reference/diagnostics/index.md) — コードから引く 65 件の全目録
- [診断を読む](../reference/diagnostics/reading.md) — `--json` の返りの構造
- [判定 — koyu validate](../reference/validate/index.md) — 15 の規則
- [約束の範囲](../reference/scope.md) — `check` が緑であることの意味
