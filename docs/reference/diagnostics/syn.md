---
title: SYN — 構文と合成
mode: reference
---

# SYN — 構文と合成

SYN は一つだけである。

| コード | severity | 何を言うか |
|---|---|---|
| SYN01 | error | 構文または合成のエラー |

**SYN01 は個別のコードではない。**パーサが投げた例外を、ひとまとめに写したものである。ファイルがモデルにならなかったのだから、意味の検査は一件も走っていない — 構文エラーが一つでもあれば、`check` の結果は「SYN01 が1件」だけになる。

## 出るのは --json のときだけ

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X9 Y1..Y2
```

```sh
koyu check bad.muro --json
```

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: X9",
  "line": 4,
  "file": "<absolute path>/bad.muro"
 }
]
```

`--json` を付けない `check` も、他のサブコマンドも、例外をそのまま印字して終了コード 1 で終わる。

```sh
koyu check bad.muro
```

```text
✖ <absolute path>/bad.muro:line 4: Undefined grid line name: X9
```

`--json` のときだけ SYN01 の一件に写されるのは、**有効な JSON を返すため**である。機械が `check --json` を回すとき、構文エラーだけが別の形で返ってきては困る。

## よく出る本文と直し方

### 通りとレベル

| 本文 | 原因 | 直し方 |
|---|---|---|
| `Undefined grid line name: X1` | `grid X` がまだ書かれていない | `grid X` / `grid Y` を、通りを使う行より**前**に書く。`grid` と `level` は前方参照できない (`boundary` はできる) |
| `Undefined grid line name: X9` | その通りが grid の本数を超えている | `grid X 0 3600 7200` なら使えるのは X1〜X3 |
| `grid coordinates are written in ascending order` | 座標が降順 | 昇順に並べ直す |
| `grid X is declared once (in the base layer when composing)` | 複数のレイヤーに `grid X` がある | base 層 (entry) に一本化する |
| `Undeclared level: level:L9` | `level:` の指す先が無い | `level L9 …` を宣言するか、綴りを直す |
| `Duplicate level: L2` | 同じレベル名を二度宣言した (範囲宣言との衝突を含む) | どちらかを消す |
| `The level height (z) is not a number:` | `level L1` のように z を書いていない | `level L1 0` |
| `A level range requires pitch: (the storey height in mm): L1..L3` | 範囲宣言に階高が無い | `level L1..L3 0 pitch:3000` |
| `level carries spec:, which is not in the ledger (level reads h / slab / pitch / underground)` | `level` に未知のキー | `level` は四つしか読まない。他の情報は空間かゾーンへ |
| `The range includes an undeclared level (declare level first): L1..L2` | `stack` / `column` が未宣言のレベルを指す | 先に `level` を書く |

### 空間・境界・ゾーン

| 本文 | 原因 | 直し方 |
|---|---|---|
| `A region is given as two ranges, X?..X? and Y?..Y?` | 領域は X 系と Y 系で**二つ**要るのに、片方しか書かれていない | もう一方の軸を書く: `space /L1/a room X1..X2 Y1..Y2`。**型の書き忘れではない** — 型は任意である |
| `space /L1/a requires a type (a word from the vocabulary)` | 型も領域も無い | 型を足す |
| `Duplicate space path: /L1/a (first seen …)` | 同じパスの空間が二つ | パスは同一性である。片方のパスを変える |
| `boundary takes the form boundary /pathA /pathB [attributes...]` | 相手のパスが無い | 境界は二つの空間を結ぶ関係である |
| `zone takes the form zone /path [attributes...]` | パスが無い | |
| `Unknown keyword: wall` | そのキーワードは存在しない | 壁は物ではなく関係である。`boundary` を使う |
| `The attribute h is written as a number: 24OO` | `level` の数値属性が読めない | 単位のない数値にする |

### 字下げ

開口・`seg`・`line` は境界の下、`area` と帯の要素は空間の下に、**字下げして**書く。

| 本文 | 原因 | 直し方 |
|---|---|---|
| `Unknown keyword: door` | `door` の行に字下げが無い | 行頭に空白を入れて `boundary` に従属させる |
| `door is written indented directly under boundary` | 字下げはあるが、直前の非字下げ行が `boundary` ではない | 親を `boundary` にする (上の例は `space` の下に置いていた) |
| `area is written indented directly under space` | 字下げの `area` の親が `space` でない | |
| `Only door / window / seg / line / area / space (a band member) may sit on an indented line: note` | 字下げの行に別の語 | 字下げできるのはこの六つだけ |
| `Only + (add) / - (remove) / = (replace) may sit directly under over: door` | `over` の下に集合編集以外 | `- door D1` のように書く |
| `One boundary carries one line: /L1/a \| /L1/b` | 一つの境界に二本目の `line` | 境界を二つに分ける |

### 開口と属性

| 本文 | 原因 | 直し方 |
|---|---|---|
| `door requires a width w:(mm) (the asset may supply it)` | 開口に `w:` が無い | `door w:800` と書くか、幅を持つアセットを参照する (`door SD1`) |
| `Duplicate attribute key: name` | 同じ行に同じキーが二度 | 一つに寄せる。後勝ちの黙認はしない |
| `Unclosed quote` | `"` が奇数個 | 閉じる |
| `An attribute is written key:value: 居室` | `:` の無いトークンが属性の位置にある | `key:value` にする。値に空白を含めるなら `"…"` で囲む |

### 版と合成

| 本文 | 原因 | 直し方 |
|---|---|---|
| `Unsupported koyu version: 0.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0)` | 存在しない版 | 六つのどれかにする |
| `The koyu version is declared only in the base layer (the entry)` | `import` した層に版がある | base 層へ移す |
| `The koyu version is declared once (already 1.0)` | 版を二度書いた | 一つ消す |
| `Cannot read file: ./assets.muro` | `import` の相対パスが違う | パスは**書かれたファイルからの相対**で解決される |

## 綴り間違いはどこまで捕まるか

**属性キーの綴り間違いは捕まる。**`nmae:居室A` は自由な属性として運ばれたりせず、[ATT03](./att.md) のエラーになる。台帳に無いキーは、ドット区切りの名前空間 (`acme.nmae`) を持たなければ書けない。

**型 (第2位置引数) の綴り間違いは捕まらない。**型は開かれた語彙なので、`bedroom` を `bedrom` と書いてもエラーにはならない。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a bedrom X1..X2 Y1..Y2
```

このファイルは緑である。型は面積の集計軸と描画の淡さくらいにしか使われず、**core はこの位置を一切読まない**ので、閉じる必要が無い。

**構成の事実は型の位置に置かない。**外部も吹抜けも採光も、宣言の側にある — `outside:1` `void:1` `daylight:1` はどれも[台帳](../muro/attributes.md)の鍵なので、一字違えば [ATT03](./att.md#att03) で止まる。`outsid:1` はエラーであり、黙って外部でなくなることはない。かつては `exterior` が型の位置にあり、`exteriorr` の一字で延床が倍増しながら緑で通った。

なお[検証](../validate/index.md)の面はいくつかの型語を判定に使う。そちらは**凍らない面**であり、綴りは守られない ([scope](../scope.md))。

## 構文が通ってからが本番

SYN01 が消えたということは、ファイルがモデルになったということでしかない。そこから意味の検査 (他の 64 のコード) が走る。

```sh
koyu check house.muro --strict
```

`--strict` は警告も終了コード 1 にする。CI の門番に置くのはこちらである。

## 関連

- [ATT — 属性](./att.md) — 属性キーの綴り間違い (ATT03)
- [VER — 言語の版](./ver.md) — 版が受理されたあとに走る四つの検査
- [LIN — 描かれた線](./lin.md) — 二本目の `line`
- [koyu check](../cli/check.md)
