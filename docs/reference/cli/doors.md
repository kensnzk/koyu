---
title: koyu doors
mode: reference
---

# koyu doors

空間グラフ上で、ある空間から別の空間へ**最少の扉数で辿る経路**を出す。避難と動線の問いである。

## 引数

```text
koyu doors <entry.muro> <パスA> <パスB>
```

entry のパスの後に、出発と到着の空間パスを両方渡す。両方必須である。

## 旗

無い。

## 出力

扉の枚数と、経由した空間の列が一行で出る。

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

経路は空間の列であって扉の列ではない。扉を数えない境界 (`open` や階段) も経路の途中に現れる。

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
```

```text
3 doors — /home/bed1 → /home/hall2 → /home/hall1 → /site/east → /site/garden → /out/road
```

五つの境界を跨いでいるのに扉は 3 枚である。`/home/hall2 → /home/hall1` は階段、`/site/east → /site/garden` は `open` なので数えられない。

到達できなければその旨が出る。

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed9 /site/garden
```

```text
Cannot reach /site/garden from /home/bed9
```

## 何が通れるか

| 境界 | 通れるか |
|---|---|
| 扉のある壁 | 通れる (扉の枚数を数える) |
| 扉の無い壁 | 通れない |
| `open` | 通れる (扉を数えない) |
| `air:1` の壁 (手すり・柵・塀) | **通れない** — `air` は遮蔽の話であって通行の話ではない |
| `stair` | 通れる (扉を数えない) |
| `shaft` (EV 等) | 通れない |
| `void` (吹抜け) | 通れない |

書かれていない境界も経路に使われる。接する空間の既定は壁で、扉の無い壁は通れないので、**書かなかった接触は経路を塞ぐ側に働く。**

## 存在しないパスの扱い

**綴りを間違えたパスを渡しても「到達できません」と出る。**綴り違いと本当の未到達は、同じメッセージ・同じ終了コード 1 になる。上の例の `/home/bed9` は存在しない空間である。

到達できないと出たら、まず [`koyu graph`](graph.md) でパスの綴りを確かめる。外部は一つとは限らない — `examples/house` の外部は `/out/road` `/out/n` `/out/e` `/out/w` に割れていて、`/out` という空間は存在しない。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 到達できる |
| 1 | 到達できない (存在しないパスを含む)、または構文・合成エラーで読めなかった |
| 2 | パスが二つ揃っていない / ファイルパスを渡していない |

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1
```

```text
Usage: koyu doors <file> /pathA /pathB
```

## 一組ずつしか答えない

`doors` が答えるのは渡した一組についてだけである。**「どこか一つでも外へ出られない室があるか」を建物全体について問うなら [`koyu validate`](validate.md) を使う** — `access.unreachable` が、領域を持つ室のすべてについて外部への到達可能性を確かめる。

## 関連

- [koyu graph](graph.md) — 空間ごとの隣接と境界の種別
- [koyu validate](validate.md) — 建物全体の到達可能性を一度に問う
- [.muro リファレンス](../muro/index.md) — `boundary` と開口の書き方
- [koyu コマンド](index.md) — 終了コードの共通の約束
