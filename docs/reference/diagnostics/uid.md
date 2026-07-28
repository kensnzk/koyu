---
title: UID — 同一性
mode: reference
---

# UID — 同一性

UID は四つある。すべてエラーである。

| コード | severity | 何を言うか |
|---|---|---|
| UID01 | error | `uid` が数字だけのトークン |
| UID02 | error | `uid` に空白が含まれる (空も同じ) |
| UID03 | error | `uid` が重複している |
| UID04 | error | 含む対象の中で `name` が重複している |

**同一性は二つある。**このことを掴むと四つのコードが二つに割れる。

- **`uid`** — `space` と `zone` に書く**不透明トークン**。モデル全体で一意で、パスを変えても「同じもの」だと言うために使う。`koyu diff` の改名検出がこれを読む。UID01〜UID03 がこれを守る。
- **`name`** — 開口・`seg`・`area`・柱の同一性。これらは自分のパスを持たないので、**含む対象 + その中で一意な名**が同一性になる。UID04 がこれを守る。

## UID01 — uid は数字だけのトークンにできません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:0123
```

```text
A uid cannot be a token of digits alone: uid:123 (write something like sp-123)
```

**原因** — 数値の形をした属性値は数値として保持される。`0123` と書いても `123` になる — メッセージが `uid:123` と言っているのがまさにそれで、先頭の 0 はもう無い。書いたトークンの区別が失われた状態で同一性を担わせることはできない。

**直し方** — 数字以外を混ぜる。接頭辞を付けるのが簡単である。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:sp-0123
```

## UID02 — uid に空白は使えません

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:"sp 1"
```

```text
A uid cannot contain whitespace: "sp 1"
```

**原因** — 引用符で囲めば空白を含む値は書けるが、`uid` は不透明トークンなので空白を許さない。空の値 (`uid:""`) も同じく通らない。

**直し方** — 空白をハイフンかアンダースコアに置き換える (`uid:sp-1`)。

## UID03 — uid が重複しています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:sp-1
space /L1/b room X2..X3 Y1..Y2 uid:sp-1
```

```text
Duplicate uid: sp-1 (space /L1/a — <absolute path>/bad.muro:line 4, space /L1/b — <absolute path>/bad.muro:line 5)
```

**原因** — 同じ `uid` が二箇所にある。**一意性は `space` と `zone` を跨ぐ** — 空間とゾーンが同じトークンを持っても重複である。行をコピーして `uid` を直し忘れた場合に出る。

メッセージは全ての出所を種別つきで並べ、`related` にも同じ位置が入る。

**直し方** — 片方を別のトークンに変える。

複数のファイルを `import` で合成しているなら、レイヤーごとに接頭辞を決めておくと事故が減る (`sp-` / `w2-` / `ext-`)。機械に作らせるなら、`koyu-mcp` の `new_uids` か API の `newUids` が衝突しないトークンを返す。

## UID04 — 同じ対象の中で name が重複しています

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  window w:1200 h:1100 edge:S at:0.25 name:W1
  window w:1200 h:1100 edge:S at:0.75 name:W1
```

```text
Duplicate opening name within boundary /L1/a | /out: W1 (<absolute path>/bad.muro:line 7, <absolute path>/bad.muro:line 8) — the name is what identifies it inside its container
```

**原因** — 開口も `seg` も `area` も柱も、自分のパスを持たない。だから同一性は「含む対象の中で一意な名」でしか成り立たない。名が二つの要素を指していれば、`= window W1` はどちらを差し替えるのか、`- window W1` はどちらを消すのかが決まらない。**推測せずにその場で拒む。**

検査されるのは四つで、含む対象がそれぞれ違う。

| 要素 | 含む対象 | メッセージの言い方 |
|---|---|---|
| 開口 (`door` / `window`) | その境界 | `within boundary /L1/a \| /out` |
| `seg` | その境界 | `within boundary /L1/a \| /out` |
| `area` | その空間 | `within space /L1/a` |
| `column` | モデル全体 | `within the model` |

柱だけがモデル全体を範囲に取る。柱は境界にも空間にも属さず、通りと階だけで宣言されるからである。

**名を書かない要素は母集団に入らない。**同一性を主張していないのだから、いくつ並べても衝突しない。

**アセットから継いだ名は数えない。**

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
asset W1 window w:1200 h:1100 name:掃き出し窓
space /L1/a room X1..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  window W1 edge:S at:0.25
  window W1 edge:S at:0.75
```

`asset W1 … name:掃き出し窓` の `name` は**型の名**であって、その開口自身の主張ではない。同じ建具を一枚の壁に二枚並べても衝突にはならない。上のファイルは緑である。

**直し方** — 片方の名を変える (`name:W1-e` / `name:W1-w`)。そもそも個別に指す必要がなければ、`name:` を書かない。

## 関連

- [ATT — 属性](./att.md) — `uid` と `name` を含む属性の鍵と値の検査
- [ZON — ゾーン](./zon.md) — `uid` を持てるもう一方
- [koyu check](../cli/check.md)
