---
title: koyu — 版の宣言
mode: reference
---

# koyu — 版の宣言

```muro-part
koyu 1.1
```

**このファイルをどの版の意味論で読むかを宣言する一行である。**受理される版は次の七つで、この並びが新旧の順である。

```text
0.1   0.2   0.3   0.4   0.5   1.0   1.1
```

**省略すれば最新版 `1.1` の意味論で読まれる。**省略はツールの版を跨いで意味が安定することを意味しない — 意味を固定したいファイルは版を書く。

## 新旧は並び順であって、綴りの辞書順ではない

**`1.0` も `1.1` も `0.5` より新しい。**文字列として比べれば `"0.5" > "1.0"` になるので、版の比較を綴りに任せると新しい版が古い版と判定される。新旧は必ず上の並びの添字で決まる。

## 書き方の規律

`koyu <版>` の**ちょうど2トークン**である。

| 書いたもの | 結果 |
|---|---|
| `koyu 1.1` | 受理される |
| `koyu` | `koyu takes a version: koyu 1.1` |
| `koyu 1.1 latest` | `Extra tokens on the koyu version declaration: latest` |
| `koyu 0.6` | `Unsupported koyu version: 0.6 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1)` |

**宣言は入口の層でのみ、一度だけである。**

- 入口以外の層に書けば `The koyu version is declared only in the base layer (the entry)`
- 二度書けば `The koyu version is declared once (already 1.1)` — **同じ版を二度書いてもエラーである**。合成の順序による黙った上書きを禁じるため、`grid` と同じ規律を取る
- 行の位置は自由である。ファイルの先頭でなくてもよい

## 旧版は、意味が保たれる場合だけ受理される

**古い版を宣言したファイルは、その版の処理系が読んだときと同じ建物になる場合にのみ通る。**同じ文字列が別の建物を意味してしまうときは `check` が止め、二つの選択肢を示す — 意味を明示的に書き足すか、版を上げるか。

これを言う診断が五つある。すべて error であり、`check --json` にコードが出る。

### VER01 — 0.1 で既定境界が導出される

`0.2` から、同じレベルで接する領域つきの空間の組には、宣言が無ければ `wall` の既定境界が導かれるようになった。`0.1` を宣言したファイルにその組があれば、境界の有無で建物が変わる。

```text
A koyu 0.1 file has a touching pair with no declared boundary: /L1/a | /L1/b — in 0.2 a
default wall is derived and the meaning changes. Declare the boundary, or raise the
version to koyu 0.2
```

**直し方**: その境界を宣言するか、`koyu 0.2` 以上へ上げる。

### VER02 — 0.3 以前で採光の対象が型から推定されていた

`0.3` 以前は `unit` `room` `ldk` `bedroom` `living` の型を採光の対象と推定していた。`0.4` から採光の対象は `daylight:1` という宣言だけになったので、これらの型に `daylight` が書かれていなければ、版を上げた瞬間に黙って判定から外れる。

```text
A koyu 0.3 file has a room with no daylight: /L1/a — 0.4 does not infer the daylight scope
from the type, so it falls out of the check. Write daylight:1 (in scope) or daylight:0
(out of scope), then raise the version to koyu 0.4
```

**直し方**: `daylight:1` (対象) か `daylight:0` (対象外) を書いてから `koyu 0.4` 以上へ上げる。

### VER03 — 0.4 以前のファイルに 0.5 の語がある

`0.5` で入った語を `0.4` 以前の処理系は知らない。知らない語が書かれていれば、その形は黙って生成されない。対象は四つ。

| 語 | どこに書かれるか |
|---|---|
| `stair:` `ramp:` `escalator:` `lift:` | 空間の縦動線の宣言 |
| `line` | 境界の下の描かれた線 |
| `column` | 柱の宣言 |
| `underground:` | レベルの地下の宣言 |

```text
A koyu 0.4 file uses a 0.5 word: /B1/st carries stair: (a vertical circulation) — raise the
version to koyu 0.5
```

**直し方**: `koyu 0.5` 以上へ上げる。

### VER04 — 0.5 以前のファイルに 1.0 の語がある

`1.0` で入った合成の語を `0.5` 以前の処理系は知らない。**知らない処理系ではその行が語として読めず、上書きも削除も起きない — 黙って別の建物になる。**対象は三つ。

| 語 | 何をする語か |
|---|---|
| `over` | 空間・ゾーン・境界・レベル・アセットの上書き |
| `drop` | 空間・境界・柱の宣言の削除 |
| `over` 直下の `+` `-` `=` | 集合 (開口・`seg`・`area`) の追加・削除・置換 |

```text
A koyu 0.5 file uses a 1.0 word: over /L1/a name:居室 (a composition override) — raise the
version to koyu 1.0
```

**直し方**: `koyu 1.0` へ上げる。

## 版が意味するもの

版は**言語と意味論と合成の規則**に付く。「この版で読めたものは、以後も同じ意味で読める」という約束であり、実装の版とは別に数えられる。したがって、

- 言語の意味を変える変更は版を上げる。同じ綴りが別の建物を意味するようになることは、版を上げずには起きない
- **判定を足しても版は動かない。**建築的な妥当性を言う規則は `koyu validate` の面にあり、増えても既存のファイルの意味は変わらない
- 描画も版に含まれない。同じ形から出る SVG の見た目は変わりうる

同梱の例はすべて最新版で書かれる。版を上げる変更を入れたときは、例も同じ変更で追随する。
