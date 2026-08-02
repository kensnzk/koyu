---
title: 言語版
mode: reference
---

# 言語版

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";

const SUPPORTED_LANGUAGE_VERSIONS: readonly string[]
const DEFAULT_LANGUAGE_VERSION: string
```

```ts
console.log(SUPPORTED_LANGUAGE_VERSIONS, DEFAULT_LANGUAGE_VERSION);
```

```text
[ '0.1', '0.2', '0.3', '0.4', '0.5', '1.0' ] 1.0
```

**受理される版は六つで、既定は `1.0` である。**

## 言語の版であって、ツールの版ではない

`.muro` の一行目に書く `koyu 1.0` は**言語の意味論の版**である。パッケージの版 (`package.json` の `version`) とも、[正準JSON](canonical.md) が名乗る形式の版 (`koyu-canonical/1.1`) とも別のものである。

**三つは独立に動く。**ツールが上がっても言語の意味は動かないし、言語が上がっても正準形式の綴りが動くとは限らない。

## 並びが版の順である

**`SUPPORTED_LANGUAGE_VERSIONS` の添字が版の新旧の順である。**版を比べるならこの配列の添字で比べる。

```ts
import { SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";

const older = (a: string, b: string) =>
  SUPPORTED_LANGUAGE_VERSIONS.indexOf(a) < SUPPORTED_LANGUAGE_VERSIONS.indexOf(b);
```

**文字列として比べてはならない。**いま並んでいる六つの綴りではたまたま辞書順と一致するが、それはこの六つの偶然であって規則ではない。版が増えれば崩れる。

## 省略の意味

**版の宣言を省くと、常に最新版の意味論で読まれる。**

```ts
import { parse } from "@kensnzk/koyu";

const n = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2`);
console.log(n.version, n.versionDeclared);
```

```text
1.0 undefined
```

`version` には既定が入るが、`versionDeclared` は立たない。**この二つは別のことを言っている** — 前者は「どの意味論で読んだか」、後者は「著者が版を書いたか」である。[正準JSON](canonical.md) が `koyu` キーを出すかどうかは後者で決まる。

**省略は「最新版で読む」であって「版を跨いで意味が安定する」ではない。**意味を固定したいファイルには版を書く。

## 受理されない版

配列に無い綴りは解析の時点で `SourceError` になる。

```ts
try { parse(`koyu 9.9\ngrid X 0 3600`); } catch (e) { console.log((e as Error).message); }
```

```text
line 1: Unsupported koyu version: 9.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0)
```

## 旧版は意味保存の場合だけ受理される

**古い版を宣言したファイルは、その版の意味のまま読まれる。**だが「その版に無かった語」を使っていれば、診断がそれを咎める。

| コード | 何を咎めるか |
|---|---|
| `VER01` | `koyu 0.1` で既定境界の導出に頼っている |
| `VER02` | `koyu 0.3` 以前で、採光の推定対象だった型に `daylight` が無い |
| `VER03` | `koyu 0.4` 以前のファイルに 0.5 の語 (縦動線・描かれた線・柱・地下) |
| `VER04` | `koyu 0.5` 以前のファイルに 1.0 の語 (`over` / `drop` / 集合編集) |

```ts
import { checkDiagnostics, parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 floor:オーク
import ./finish.muro`,
  "finish.muro": `over /L1/a floor:タイル`,
}, "main.muro");

console.log(m.version, m.versionDeclared);
for (const d of checkDiagnostics(m)) console.log(d.code, d.severity, d.message, `(${d.file}:${d.line})`);
```

```text
0.5 true
VER04 error A koyu 0.5 file uses a 1.0 word: over /L1/a floor:タイル (a composition override) — raise the version to koyu 1.0 (finish.muro:1)
```

**出所は書いた層である。**版を宣言したのは `main.muro` だが、咎められているのは `finish.muro` の1行目である — 直す手はそこにある。

**版は base 層で一度だけ宣言する。**合成のどこにでも書けるものではない。

## 版を上げるとき

言語の意味論を変える変更は言語版を上げる。だから**この配列に版が増えたということは、意味が動いたということである。**逆に、パッケージの版が上がっただけなら、`.muro` の読まれ方は変わらない。

同梱の建物 (`examples/`) は常に最新の版で書かれている。

## 関連

- [版を書く](../muro/version.md) — `koyu <版>` の書き方
- [正準JSON](canonical.md) — 形式の版と `koyu` キー
- [診断リファレンス](../diagnostics/index.md) — `VER01`〜`VER04` の直し方
