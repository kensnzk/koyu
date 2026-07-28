---
title: 診断を読む
mode: reference
---

# 診断を読む

**人向けの `check` は診断コードを表示しない。**出るのは本文だけで、`BND04` のようなコードはどこにも現れない。[索引](index.md)や族の頁を引くには、まずコードを手に入れる。

## コードを手に入れる

次のファイル (二室が角でしか触れていない) を検査する。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

人向けの出力はこうなる。

```text
✖ <absolute path>/bad.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

行頭の出所は**解決済みの絶対パス**である (ここでは `<absolute path>` と省略して示した)。合成したモデルでは、この出所は entry ではなく**その診断を生んだ宣言が書かれているレイヤー**を指す。

`--json` を付けると、同じ診断がコードつきで出る。

```sh
koyu check bad.muro --json
```

```json
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

コードが手に入ったら[索引](index.md)を引く。

## Diagnostic の構造

`--json` が吐くのは `Diagnostic` の配列である。

```ts
interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning";
  message: string;
  line?: number;
  file?: string;
  path?: string[];
  related?: Array<{ line: number; file?: string }>;
}
```

| フィールド | 必ずあるか | 中身 |
|---|---|---|
| `code` | 必ず | 台帳の 65 コードのいずれか。領域2〜3字 + 2桁の連番 |
| `severity` | 必ず | `"error"` か `"warning"`。**コードの不変属性**であって、場合によって変わらない |
| `message` | 必ず | **本文だけ。**位置接頭辞 (`ファイル:line N: `) を含まない |
| `line` | 位置を持つ診断のみ | 出所の行番号 (1始まり)。既定境界の導出のように、書かれた行を持たない診断では省略される |
| `file` | `line` があり、出所のレイヤーが分かるとき | そのレイヤーの解決済み絶対パス |
| `path` | 対象がパスを持つとき | 対象の空間・ゾーン・`polygon` のパス。境界に対する診断は**両側のパス**が入る |
| `related` | 関連位置があるとき | 重複の既出側、重なりの相手、影を作った先の宣言などの位置 |

`message` に位置が入らないのは、位置を別のフィールドが持つからである。エディタや CI は `line` / `file` を機械的に読み、人向けの `check` は `<file>:line <N>: ` を組み立てて本文の前に貼る。**この二つは同じ本文を共有している。**

`related` が付く例。重複した境界 (BND02) では、後から書いた側が診断の出所になり、既出側が `related` に入る。

```json
[
 {
  "code": "BND02",
  "severity": "error",
  "message": "Duplicate boundary: /L1/a | /L1/b (first seen at <absolute path>/bad.muro:line 6)",
  "line": 7,
  "file": "<absolute path>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ],
  "related": [
   {
    "line": 6,
    "file": "<absolute path>/bad.muro"
   }
  ]
 }
]
```

**出所を持たない診断は無い。**集合に対する診断 (「同じ空間対に二種類の境界が併存している」) でも、その集合を作った宣言のうち一本を `line` が指し、残りが `related` に入る。「どこかで矛盾している」とだけ言われても直す場所が無いからである。

## severity と終了コード

| severity | 意味 | `check` | `check --json` | `check --strict` |
|---|---|---|---|---|
| `error` | 構成が成立していない | 1 | 1 | 1 |
| `warning` | 疑わしい (成立はしている) | 0 | 0 | 1 |
| (診断なし) | 緑 | 0 | 0 | 0 |

**警告も落としたいときは `--strict` を付ける。**CI の門番に置くのはこちらである。`--json` と `--strict` は同時に使える。

エラーが一件も無いとき、人向けの `check` は件数と、緑が何を意味するかを印字する。

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

警告だけがあるときはこうなる (終了コードは 0、`--strict` を付けると 1)。

```text
⚠ <absolute path>/warn.muro:line 6: The same pair of spaces carries both an edge-restricted and an unrestricted boundary (the segments overlap): /L1/a | /L1/b
✔ Consistent — 2 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

人向けの出力では**警告が先、エラーが後**に並ぶ。`--json` は severity で並べ替えず、後述の走査の順のまま返す。

## 並びは走査の順である

診断の並びは、コードの族ではなく**走査した順**で決まる。検査は決まった順に並んだ節から成り、**節の粒度は走査単位であってコードの族ではない。**一つの節が宣言を一周するあいだに複数のコードを出すなら、それらは走査のその場で隣り合って出る。境界の妥当性を見る節は境界を一本ずつ回り、その境界の線分・開口・`seg` について言うべきことを、そこでまとめて出す。

外壁に扉と `seg` を置いた二つの境界を検査すると、族ごとにまとまらず、境界ごとにまとまる。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  door w:800
  seg w:800 spec:X
boundary /L1/b /out t:150
  door w:800
  seg w:800 spec:X
```

出るコードと行はこの順である。

```text
OPN05  line 8
SEG05  line 9
OPN05  line 11
SEG05  line 12
```

**この性質は意図されたものである。**一つの境界について言うべきことが一箇所に固まるので、上から順に直していける。コードの族でまとめると、同じ境界の話が出力の端と端に分かれる。

## 母集団は「書かれた宣言」である

診断が数え上げるのは、導出された結果ではなく**書かれた宣言**である。同じ階の別の柱宣言が一本でも柱を立てたからといって、一本も立たない宣言が黙って通ることはない。属性についても同じで、**解釈される属性は値まで検査される** — 書いたのに解釈されなかった値が、黙って既定へ落ちることはない。

## 構文エラーは SYN01 に写る

ファイルがモデルにならなかったときは、意味の検査が一件も走っていない。`--json` を付けたときだけ、有効な JSON を返すために、その例外が `SYN01` 一件に写される。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X9 Y1..Y2
```

```sh
koyu check broken.muro --json
```

```json
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: X9",
  "line": 4,
  "file": "<absolute path>/broken.muro"
 }
]
```

`--json` を付けない `check` と、他のすべてのサブコマンドは、例外をそのまま `✖ <出所>:line N: <本文>` として印字し、終了コード1で終わる。**構文エラーが一つでもあると、`check --json` の結果は SYN01 が1件だけになる。**

## プログラムから読む

`checkDiagnostics(model)` が `Diagnostic[]` を返す。`check(model)` は互換層で、`{ errors, warnings }` の**文字列**の組を返す — こちらの文字列には位置接頭辞が付いている。コードが要るなら `checkDiagnostics` を使う。

`DIAGNOSTIC_CODES` は台帳そのもので、コードから規範の severity を引ける。欠番の綴りを引くと `undefined` が返る。

```ts
import { checkDiagnostics, DIAGNOSTIC_CODES } from "koyu";

for (const d of checkDiagnostics(model)) {
  console.log(d.code, d.severity, d.line, d.message);
}

DIAGNOSTIC_CODES["BND04"]; // "error"
DIAGNOSTIC_CODES["BND07"]; // undefined — 欠番
```

欠番の一覧は[欠番の診断コード](retired.md)にある。
