---
title: koyu json
mode: reference
---

# koyu json

合成後のモデルを正準 JSON で標準出力に書く。差分と外部接続の土台であり、キーの並びは安定している。

## 引数

```text
koyu json <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。出力は常に整形済みで、標準出力へ書かれる (末尾に改行が付く以外の装飾は無い)。

## 出力

```sh
npx tsx src/cli.ts json examples/two-rooms.muro
```

```text
{
  "format": "koyu-canonical/1.0",
  "koyu": "1.0",
  "name": "二室",
  "unit": "mm",
  "grid": {
    "X": [
      0,
      3600,
      7200
    ],
    "Y": [
      0,
      4500
    ]
  },
  "levels": {
    "L1": {
      "z": 0,
      "h": 2400,
      "slab": 150
    }
  },
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "daylight": 1,
        "name": "居室A"
      }
    },
```

(先頭の一部である。)

**最初の二つのキーは別の版を言う。**`format` はこの JSON 形式そのものの版で、`koyu` は原本に書かれた言語の版である。原本が `koyu <版>` の行を持たなければ `koyu` のキーは出ない。

```sh
npx tsx src/cli.ts json derived.muro
```

```text
{
  "format": "koyu-canonical/1.0",
  "unit": "mm",
```

境界は配列で、両側のパス・種別・厚み・属性・開口を持つ。

```text
  "boundaries": [
    {
      "between": [
        "/L1/a",
        "/L1/b"
      ],
      "a": "/L1/a",
      "kind": "wall",
      "t": 120,
      "attrs": {
        "spec": "PW1"
      },
      "openings": [
        {
          "kind": "door",
          "w": 780,
          "h": 2000,
          "at": 0.5
        }
      ]
    },
```

開口の `at:0.5` は書かれていない値である。位置を書かなかった開口は境界の中央に置かれるので、正準 JSON はその決まった位置を書く。

## import は残らない

正準 JSON は**合成後の単一のモデル**である。層に割った建物でも、`import` も層の境目も出ない。同じ建物を一枚で書いても層に割って書いても、同じ正準 JSON が出る。

`over` の跡も残らない。`over` で `h:2400` にした模型と、最初から `h:2400` と書いた模型は同じである。正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。

## 既定境界は出ない

**正準 JSON が持つのは書かれた構成だけで、導出された意味は持たない。**接する二室だけを書き、`boundary` を一行も書いていないファイルで確かめられる。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

```sh
npx tsx src/cli.ts check derived.muro
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```sh
npx tsx src/cli.ts json derived.muro
```

```text
  "boundaries": []
```

[`check`](check.md) の「境界 1」は導出された既定の壁を数えた**意味**の側の数、`json` の空配列は**書かれた構成**の側の数である。矛盾ではない。正準 JSON の消費者は、既定境界を自分で導出してから意味を読む。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 常に |
| 1 | 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**`json` は `check` を通さない。**整合していないモデルでも、合成さえ通れば正準 JSON は出る。

## 関連

- [正準 JSON](../json/index.md) — キーごとのリファレンスと安定性の規則
- [koyu diff](diff.md) — 二つのモデルを構成の言葉で比べる
- [koyu check](check.md) — 導出された境界を数える側
- [公開 API](../api/index.md) — 同じ出力をプログラムから得る
