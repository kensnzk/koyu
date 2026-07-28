---
title: 診断
mode: reference
---

# 診断

構成の整合を検査する面である。**言うのは「書かれたものがデータとして矛盾していない」までであって、建築として妥当かは何も言わない。**建築の側の判断は [`validate`](validate.md) が別に言う。

```ts
import { check, checkDiagnostics, DIAGNOSTIC_CODES } from "@kensnzk/koyu";
import type { CheckResult, Diagnostic, DiagnosticCode } from "@kensnzk/koyu";
```

## checkDiagnostics

```ts
function checkDiagnostics(model: Model): Diagnostic[]
```

**これが一次の形式である。**構造化して扱うならこちらを使う。

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const model = parse(`grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120`);
console.log(JSON.stringify(checkDiagnostics(model), null, 1));
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 },
 {
  "code": "SUF03",
  "severity": "warning",
  "message": "Level L1 has no slab:, so not one floor is generated on this storey",
  "line": 3
 }
]
```

**`checkDiagnostics` は投げない。**構文・合成のエラーは [`parse` 系](parsing.md)が `SourceError` として投げるので、そちらは呼び出し側で捕まえる。

### 三つの規律

**母集団は書かれた宣言である。**診断は「書かれた一行に対して一件」出る。導出された結果を数えるのではない。

**出所を必ず持つ。**位置を持たない診断はほとんど無い — `line` が無いのは、どの行にも帰せない診断だけである。

**並びは走査の順である。**コードの族でまとめ直したりはしない。同じ入力なら同じ順で出る。

## Diagnostic

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

| フィールド | 中身 |
|---|---|
| `code` | 台帳のコード (領域2〜3字 + 2桁の連番) |
| `severity` | `"error"` か `"warning"` — **コードの不変属性である** |
| `message` | 本文。**位置接頭辞を含まない** |
| `line` | 出所の行 |
| `file` | 合成時の出所レイヤー (解決済みの絶対パス) |
| `path` | 対象の空間・ゾーン・多角形のパス (境界は両方) |
| `related` | 関連位置 — 重複の既出側、重なりの相手など |

**`severity` はコードの属性であって、場合によって変わらない。**同じコードが error になったり warning になったりはしない。重さを変えたくなったときは新しいコードが切られる。だから `DIAGNOSTIC_CODES` の表を持って分岐を書いてよい。

`related` は「もう一方はどこか」を言う。重複した uid の既出側、重なった空間の相手側などがここに入る。

```ts
const dup = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 uid:u-aaaaaaaaaaaaaaaa
space /L1/b room X2..X3 Y1..Y2 uid:u-aaaaaaaaaaaaaaaa`);
console.log(JSON.stringify(checkDiagnostics(dup)[0], null, 1));
```

```text
{
 "code": "UID03",
 "severity": "error",
 "message": "Duplicate uid: u-aaaaaaaaaaaaaaaa (space /L1/a — line 4, space /L1/b — line 5)",
 "path": [
  "/L1/a",
  "/L1/b"
 ],
 "related": [
  {
   "line": 4
  },
  {
   "line": 5
  }
 ]
}
```

## check

```ts
function check(model: Model): CheckResult

interface CheckResult {
  errors: string[];
  warnings: string[];
}
```

互換の文字列形式である。`checkDiagnostics` と**同件・同順**で、位置接頭辞 (`ファイル:N行目: `) を組み立てた文字列を返す。人にそのまま見せる用途向け。

```ts
import { check } from "@kensnzk/koyu";
const { errors, warnings } = check(model);
console.log(errors, warnings);
```

```text
[
  'line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b'
] [
  'line 3: Level L1 has no slab:, so not one floor is generated on this storey'
]
```

この例は `parse` で読んだので出所ファイルが無く、接頭辞が行番号だけになっている。`parseFile` で読めば `<絶対パス>:6行目: ` が付く。

**コードは文字列に出ない。**コードで分岐したいなら `checkDiagnostics` を使う。

## DIAGNOSTIC_CODES

```ts
const DIAGNOSTIC_CODES: Record<DiagnosticCode, "error" | "warning">

type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;
```

全コードと severity の対応表である。**台帳が唯一の出所で、登録していないコードは型が通らない。**

```ts
import { DIAGNOSTIC_CODES } from "@kensnzk/koyu";
const codes = Object.keys(DIAGNOSTIC_CODES);
console.log(codes.length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "error").length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "warning").length);
console.log(DIAGNOSTIC_CODES["BND04"], DIAGNOSTIC_CODES["BND07"]);
```

```text
65 49 16
error undefined
```

**コードは 65 個で、error が 49、warning が 16 である。**

`BND07` が `undefined` を返すのは、それが**欠番**だからである。廃止されたコードの番号は再利用されない — 古いログや古い設定に残った番号が、別の意味で復活しないためである。欠番の一覧と、その代わりに何が言われるようになったかは [引退した診断](../diagnostics/retired.md)。

コード一件ずつの原因と直し方は [診断リファレンス](../diagnostics/index.md)。

## DiagnosticCode を型として使う

`DiagnosticCode` はコードの合併型である。台帳に無い綴りはコンパイルが通らない。

```ts
import type { Diagnostic, DiagnosticCode } from "@kensnzk/koyu";

const FATAL: DiagnosticCode[] = ["BND04", "GEO02", "SUF02"];
const fatal = (ds: Diagnostic[]) => ds.filter((d) => FATAL.includes(d.code));
```

`"BND07"` をこの配列に書けば、その場で型エラーになる。

## 終了コードのように使う

CLI の `koyu check` は error があれば 1 を返し、`--strict` を付けると warning でも 1 を返す。同じ規則を自分で書くならこうなる。

```ts
import { checkDiagnostics } from "@kensnzk/koyu";

function exitCode(model: Model, strict = false): number {
  const ds = checkDiagnostics(model);
  if (ds.some((d) => d.severity === "error")) return 1;
  if (strict && ds.length > 0) return 1;
  return 0;
}
```

**診断が空でも建物が使えるとは限らない。**接する空間の既定は壁で、壁は扉が無ければ通れない。扉を一枚も宣言しない二階建ては、診断が空のまま完全に密封される。動線が繋がっているかは [`doorsBetween`](queries.md#doorsbetween) が、建築の側の判断は [`validate`](validate.md) が言う。

## 関連

- [診断リファレンス](../diagnostics/index.md) — 65コードの原因と直し方
- [検証](validate.md) — 建築的な判定 (`Finding`)
- [`koyu check`](../cli/check.md) — 同じ検査をコマンドラインから
- [エラー](errors.md) — 検査ではなく解析が投げるもの
