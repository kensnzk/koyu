---
title: koyu check
mode: reference
---

# koyu check

書かれたものがデータとして矛盾していないかを検査する。編集のたびに通す門番であり、CI に置くのもこれである。

## 引数

```text
koyu check <entry.muro> [--json] [--strict]
```

entry のパスを一つ取る。`import` で割られた建物なら base 層のファイルを渡す。

## 旗

| 旗 | 効果 |
|---|---|
| `--json` | 診断を `Diagnostic[]` の JSON で標準出力に書く。**診断コードが出るのはこのときだけ** |
| `--strict` | 警告があっても終了コード 1 にする |

二つは併用できる。`--json --strict` は JSON を書いた上で、警告だけでも 1 を返す。

## 出力

エラーが無ければ、緑の行と、その緑が何を意味するかの行が出る。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

数えられている境界は**導出後**の境界である。接する空間の既定は壁なので、`boundary` を一行も書いていなくても境界は現れる。書かれた構成の側の数を見たいときは [`koyu json`](json.md) を使う。

警告があれば緑のまま件数が付き、警告そのものが `⚠` で前に出る。

```sh
npx tsx src/cli.ts check warn.muro
```

```text
⚠ <absolute path>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey
✔ Consistent — 3 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

エラーがあれば `✖` の行だけが出て、緑の行は出ない。位置は `<解決済みの絶対パス>:line <行>:` の形で本文の前に付く。

```sh
npx tsx src/cli.ts check bad.muro
```

```text
✖ <absolute path>/bad.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

**人向けの出力に診断コードは出ない。**コードを引きたいときは `--json` を付ける。

## --json のかたち

診断が無ければ空配列である。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro --json
```

```text
[]
```

診断があれば一件ずつの配列になる。`message` は本文だけを持ち、位置は `line` と `file` が別に持つ。`file` は解決済みの絶対パスである。

```sh
npx tsx src/cli.ts check bad.muro --json
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "file": "<absolute path>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

フィールドは `code` `severity` `message` の三つが必ずあり、`line` `file` `path` `related` は持つときだけ出る。

**`severity` はコードの属性である。**同じコードが場合によって `error` になったり `warning` になったりはしない。コードは全部で 65 個ある。

構文エラーや合成エラーで**モデルが組み上がらなかった**場合も、`--json` は有効な JSON を返す。`SYN01` の一件に写される。

```sh
npx tsx src/cli.ts check broken.muro --json
```

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: Y1",
  "line": 2,
  "file": "<absolute path>/broken.muro"
 }
]
```

ファイルが読めなかった場合も同じ経路を通る。この場合は位置が無いので `line` も `file` も出ない。

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Cannot read file: <absolute path>/nope.muro"
 }
]
```

`--json` を付けずに同じファイルを渡すと、JSON ではなく `✖` の一行が出る。どちらも終了コードは 1 である。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | エラーが無い (`--strict` のときは警告も無い) |
| 1 | エラーがある / `--strict` で警告がある / 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

`--json` はこの終了コードを変えない。診断を JSON で書いた上で、同じ判定で 0 か 1 を返す。

## check が言わないこと

`check` が保証するのは「書かれたものがデータとして矛盾していない」までである。**建物として使えるかは一言も見ていない。**

接する空間の既定は壁で、壁は扉が無ければ通れない。だから扉を一枚も書かない建物は、完全に密封されたまま `check` が緑になる。窓も同じで、一枚も無くても緑である。

```muro
koyu 1.0
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
```

```sh
npx tsx src/cli.ts check sealed.muro
```

```text
✔ Consistent — 3 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

同じファイルを [`koyu validate`](validate.md) に渡すと三つの違反が出る。**緑を根拠に「動く」と主張しない。**

## 関連

- [koyu validate](validate.md) — `check` がしない建築的な判定
- [診断コード](../diagnostics/index.md) — 65 コードの原因と直し方
- [CI で門番にする](ci.md) — `--strict` を付ける理由
- [koyu json](json.md) — 書かれた構成の側の境界数
- [koyu コマンド](index.md) — entry と終了コードの共通の約束
