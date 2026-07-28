---
title: koyu diff
mode: reference
---

# koyu diff

二つのモデルを**構成の言葉**で比べる。行順・書式・素の `wall` 宣言と省略 (既定壁) の違いは差分にしない。テキストの diff ではなく、意味の diff である。

## 引数

```text
koyu diff <a.muro> <b.muro> [--json]
```

**二つのファイルパスを取る唯一のサブコマンドである。**一つ目が比較元、二つ目が比較先で、どちらも entry として合成される。

## 旗

| 旗 | 効果 |
|---|---|
| `--json` | `ModelDiff` を JSON で標準出力に書く |

## 出力

差分が無ければ一行だけ出る。

```sh
npx tsx src/cli.ts diff examples/two-rooms.muro examples/two-rooms.muro
```

```text
No differences
```

差分があれば一件ずつ並ぶ。`±` が変更、`+` が追加、`−` が削除である。

`examples/two-rooms.muro` をそのままコピーしたものを `before.muro`、そこから `/L1/b` の `name:居室B` を `name:書斎` に、二室間の扉の `w:780` を `w:900` に変えたものを `after.muro` として比べる。

```sh
npx tsx src/cli.ts diff before.muro after.muro
```

```text
± /L1/b: name 居室B → 書斎
± boundary /L1/a | /L1/b: door at:0.5 w 780 → 900
```

扉の `at:0.5` は書かれていない値である。位置を書かなかった開口は境界の中央に置かれるので、差分もその導出された位置を名乗って報告する。

## --json のかたち

`ModelDiff` は七つの区画を持つ。`grid` は変化の列、それ以外は `added` / `removed` / `changed` を持ち、`zones` と `spaces` はさらに `renamed` を持つ。

```sh
npx tsx src/cli.ts diff before.muro after.muro --json
```

```text
{
 "grid": [],
 "levels": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "assets": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "polygons": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "zones": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": []
 },
 "spaces": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": [
   {
    "path": "/L1/b",
    "fields": [
     {
      "field": "name",
      "from": "居室B",
      "to": "書斎"
     }
    ]
   }
  ]
 },
 "boundaries": {
  "added": [],
  "removed": [],
  "changed": [
   {
    "between": [
     "/L1/a",
     "/L1/b"
    ],
    "fields": [
     {
      "field": "door at:0.5 w",
      "from": "780",
      "to": "900"
     }
    ]
   }
  ]
 },
 "columns": {
  "added": [],
  "removed": [],
  "changed": []
 }
}
```

差分が無いときも同じ形の骨格が出る — すべての配列が空になるだけである。

## 何を差分にしないか

- **行順と書式。**同じ宣言を別の順で書いても、空白を変えても差分にならない。
- **素の `wall` 宣言と省略。**接する空間の既定は壁なので、`boundary /L1/a /L1/b` と書いても書かなくても実効の境界は同じである。境界は実効集合で比較される。
- **`import` による層の割り方。**比べられるのは合成後のモデルである。
- **`over` の跡。**`over` で `h:2400` にした模型と、最初から `h:2400` と書いた模型は同じである。

## 改名の検出

`uid` が一致していてパスが違うものは、削除と追加ではなく**改名**として報告される。`uid` を持たない要素の改名は、削除と追加に見える。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 差分なし |
| 1 | 差分あり |
| 2 | 入力が構文・合成エラーで壊れている / 比較先のファイルが渡されていない |

**`diff` の終了コードだけ意味が違う。**[`check`](check.md) の 0/1 は「整合しているか」、`diff` の 0/1 は「同じか」である。CI で両方を使うときは取り違えないこと。

入力が壊れているときは 1 ではなく 2 になる。差分の有無を答えられなかったのだから、「差分あり」に落とすのは嘘だからである。

```sh
npx tsx src/cli.ts diff broken.muro after.muro
```

```text
✖ <absolute path>/broken.muro:line 2: Undefined grid line name: Y1
```

比較先を渡し忘れたときは使い方が出る。

```sh
npx tsx src/cli.ts diff before.muro
```

```text
Usage: koyu diff <a.muro> <b.muro> [--json]
```

## コミット前の姿と比べる

```sh
git show HEAD:examples/two-rooms.muro > before.muro
npx tsx src/cli.ts diff before.muro examples/two-rooms.muro
```

```text
No differences
```

**`import` で割ったモデルではこの手は使えない。**`diff` は entry から層を合成するので、取り出した一枚だけを別の場所に置くと相対 `import` が解決できない。割られたモデルを比べるときは `git worktree` で旧版のツリーを丸ごと展開し、両方の base 層のパスを渡す。

## 関連

- [koyu json](json.md) — 差分の土台になる正準 JSON
- [koyu layers](layers.md) — 合成に参加した層とその強度
- [koyu check](check.md) — 0/1 の意味が違うほうの門番
- [koyu コマンド](index.md) — 終了コードの共通の約束
