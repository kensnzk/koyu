---
title: 書く — write_layer / new_uids
mode: reference
---

# 書く — write_layer / new_uids

`write_layer` は**サーバーの中で唯一ディスクに触れるツール**である。`new_uids` は何も書かないが、書くために呼ぶ。

**エージェントに書かせる前にコミットしておくこと。**`write_layer` は全置換で書き、取り消しを持たない。サーバーは過去の版を一つも保存しない。

この頁の出力はすべて実際に走らせて得たものである。絶対パスは `<abs>` に縮めてある。

---

## write_layer

> Checks a layer (.muro file) before replacing it. Content that would make the composition unparsable is never written (the original stays intact). Check errors are returned but the write still happens, so that an edit spanning several layers can be made in steps — fix it and write again. History is left to git

### 引数

| 引数 | 必須 | 中身 |
|---|---|---|
| `file` | ○ | entry の `.muro` パス。**書き込み先ではない** — 合成の起点であり、書き込みが許される範囲の基準でもある |
| `layer` | ○ | 書き込み先の `.muro` パス。**entry のあるディレクトリからの相対**、または絶対 |
| `content` | ○ | そのファイルの全文。**差分ではない** |

`layer` に entry 自身を渡してもよい。base 層を書き換える正規の方法がそれである。

書き込み先の候補は [`spaces`](tools-read.md#spaces) の `layer` と [`layers`](tools-read.md#layers) の `file` に出ている。**そこに出たパスをそのまま渡すのが確実である。**

### 何が順に起きるか

1. `file` のあるディレクトリを基準に `layer` を解決する。
2. **`.muro` で終わらなければ拒否する。**
3. **解決先が entry のディレクトリの外なら拒否する** (相対パスによる脱出の検査)。
4. **`content` を差し替えたつもりで建物全体を合成する。**parse できなければ**原本に一切触れずに**返る。
5. 合成できたら `check` を回す。
6. 書き込み先のディレクトリを (無ければ) 作る。
7. **symlink の実体まで解決し直して、もう一度 entry のディレクトリ配下かを検査する。**
8. 同じディレクトリに一時ファイルを書き、`rename` で置き換える。
9. `written` と、直後の `check` の結果を返す。

**門番は書き込みの前にある。**壊れた合成がファイルシステムに着地することはない。

### 返り

書けたとき。

```text
{
 "written": "<abs>/w/L2.muro",
 "ok": true,
 "spaces": 13,
 "errors": [],
 "warnings": []
}
```

| フィールド | 中身 |
|---|---|
| `written` | 書けたときは書き込み先の絶対パス。書かなかったときは `false` |
| `ok` | 書いた後の合成に `check` のエラーが無いか |
| `spaces` | 書いた後の合成の空間数 |
| `errors` `warnings` | 出所レイヤー:行つきの文字列の配列 |
| `parseError` | parse できなかったときだけ。原本は変わっていない |
| `target` | parse できなかったときだけ。書こうとしていたパス |

**`diagnostics` は返らない。**診断コードが要るなら、書いた後に [`check`](tools-verify.md#check) を別に呼ぶ。

---

### 安全契約

#### 取り消しは無い

サーバーは版を一つも保存しない。**巻き戻し・分岐・レビューはすべて git の仕事である。**エージェントに書かせる作業を始める前にコミットする。

#### 全置換である

`content` はそのファイルの全文になる。部分置換も追記も無い。**書く前に [`layers`](tools-read.md#layers) で原本を読み、全文を組み立ててから渡す。**

#### parse 不能な内容は書かれない

差し替え後の内容で仮想的に合成し、parse できなければ**原本に一切触れない。**

```text
{
 "written": false,
 "target": "<abs>/w/L2.muro",
 "ok": false,
 "parseError": "<abs>/w/L2.muro:line 1: Undefined grid line name: X9"
}
```

`written` が `false` である。ファイルは元のままなので、`parseError` を読んで組み立て直し、もう一度呼ぶ。

#### check エラーの内容は書かれる — これは意図である

parse は通るが `check` がエラーを出す内容は、**書かれる。**複数のレイヤーにまたがる編集を段階的に行えるようにするための約束である。片方の層に空間を足し、もう片方の層でそれを参照する、という編集は、途中で必ず赤くなる。

```text
{
 "written": "<abs>/w/L2.muro",
 "ok": false,
 "spaces": 13,
 "errors": [
  "<abs>/w/L2.muro:line 5: References an undefined space: /home/bath2"
 ],
 "warnings": []
}
```

`written` にはパスが入り、`ok` が `false` になる。**赤いまま置き去りにしない** — 次の呼び出しで直し切る。

#### 書き込みは atomic

同じディレクトリに `<書き込み先>.tmp-<プロセスID>` を書き、`rename` で置き換える。**中途半端な内容のファイルが残ることはない。**書き込みの途中でプロセスが死んでも、原本は原本のままか、新しい内容の全部かのどちらかである。

#### `.muro` しか書けない

```text
Only .muro files can be written
```

拡張子だけの検査である。`.md` も `.json` も `.ts` も書けない。**サーバーは記法のファイル以外を一つも触らない。**

#### entry のディレクトリ配下しか書けない

```text
Cannot write outside the entry's directory
```

検査は二段ある。**相対パスによる脱出** (`../secrets.muro`) は解決の直後に止まる。**symlink による脱出** — ディレクトリ配下にある symlink が外を指している場合 — は、書き込み直前に実体パスまで解決し直して止める。どちらも同じ本文を返す。

だから `write_layer` の爆発半径は、**entry と同じディレクトリ木の中の `.muro` ファイル**である。エージェントに触らせたくないものを entry の隣に置かない。

#### 合成に参加しないファイルの内容は検査されない

門番が回すのは**差し替え後の合成**である。どこからも `import` されていないファイルは合成に入らないので、その中身は誰も読まない。

```text
{
 "written": "<abs>/w/sub/new.muro",
 "ok": true,
 "spaces": 13,
 "errors": [],
 "warnings": []
}
```

これは `sub/new.muro` に記法として成立しない文字列を書き込んだときの返りである。**`ok: true` が返る** — 合成が変わっていないからである。

**新しいレイヤーを作るときは、`import` 行の追加を同じ作業単位に含める。**entry に `import ./sub/new.muro` を書いて `write_layer` を呼び直すまで、その中身は一度も検査されない。

書き込み先のディレクトリは、無ければ作られる (`sub/` が上の例で作られた)。

---

## new_uids

> Mints fresh identity tokens (uid) to write onto spaces or zones with write_layer. They collide with nothing already composed into this model, and 80 bits of randomness keeps them apart from layers that are not composed here. **Nothing assigns a uid on its own** — call this only when a space has to be pointed at across renames (sensors, registers, long-running operations), and run check afterwards, because UID03 is the only thing that proves uniqueness

### 引数

| 引数 | 必須 | 中身 |
|---|---|---|
| `file` | ○ | entry の `.muro` パス |
| `count` | — | 作る個数。既定は 1。**1 以上 1000 以下の整数** |

```json
{"name": "new_uids", "arguments": {"file": "<abs>/examples/two-rooms.muro", "count": 3}}
```

```text
{
 "uids": [
  "u-msnnsna335w4nr50",
  "u-qkp41hwk4x8f8xx8",
  "u-qyw2359xr1qk8wps"
 ],
 "note": "Write these as uid: on a space or zone. No other element accepts uid (the ledger rejects it). A uid is carried across renames by hand — that act is the record of the design decision that it is still the same space"
}
```

綴りは `u-` に続く 16 文字で、文字種は数字と、見間違いやすい `i` `l` `o` `u` を抜いた小文字である。乱数は 80 ビット。

範囲を外すと書かずに返る。

```text
count is an integer between 1 and 1000
```

### このツールは何も書かない

**返るのは文字列だけである。**モデルには何も起きない。使うには [`write_layer`](#write_layer) で `uid:` として空間かゾーンの行に書き込む。

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A uid:u-msnnsna335w4nr50
```

**`uid` を受け付けるのは `space` と `zone` の二つだけである。**境界にも開口にもアセットにも書けない — 書けば属性の台帳が拒否する。

### 呼ぶのは同一性が要るときだけ

**何も自分から uid を付けない。**パスがそのまま同一性であって、`uid` はその上に載せる別の同一性である。改名を跨いで同じ空間を指し続ける必要が出たとき — センサーの台帳、外部の登録簿、長く走る運用 — にだけ呼ぶ。

改名のとき `uid` を持ち越すのは手の仕事である。**その行為そのものが「これは同じ空間である」という設計判断の記録になる。**

### 呼んだあとは check を通す

`new_uids` が保証するのは、**いまこのモデルに合成されている uid とは衝突しない**ことだけである。まだ合成されていない層にある uid との非衝突は 80 ビットの乱数による確率的なものにすぎない。

**一意性を実際に証明するのは `UID03` だけである。**書き込んだら [`check`](tools-verify.md#check) を呼ぶ。

## 関連

- [読む — model_summary / layers / spaces / canonical_json](tools-read.md) — 書く前に原本を読む
- [確かめる — check / validate](tools-verify.md) — 書いた後の門番と、その先の判定
- [プロトコル](protocol.md) — `isError` で返る失敗と、`result` で返る失敗の別
- [import](../muro/import.md) — 新しいレイヤーを合成に載せる
- [over / drop](../muro/over-drop.md) — 層をまたいで既存の宣言を上書き・削除する
- [診断コード](../diagnostics/index.md) — `check` が返すコードの読み方
