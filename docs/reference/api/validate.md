---
title: 検証
mode: reference
---

# 検証

建築的な判定の面である。採光が足りるか、外皮が閉じているか、階段が登れるか、車が駐車場から出られるか、建物が敷地に収まるか — [`checkDiagnostics`](diagnostics.md) が一言も言わないことを、ここが言う。

```ts
import { validate, VALIDATION_RULES } from "@kensnzk/koyu";
import type { Finding, ValidationRule } from "@kensnzk/koyu";
```

領域としては `@kensnzk/koyu/validate` にも分けてある。**同じ関数の別入口である。**

```ts
import { validate, VALIDATION_RULES } from "@kensnzk/koyu/validate";
```

## この面は凍らない

core は凍る — 意味論を変える変更は言語版を上げる。**この面は凍らない。**規則が粗くても、管轄が一つしかなくても、精度が足りなくても、増やしてよいし捨ててよい。値段が安いのは、凍らないからである。

その代わり、**判定の結果が構成の保証と混同されないようにしてある。**型からして分けてある。

| | 構成の診断 | 建築の判定 |
|---|---|---|
| 型 | `Diagnostic` | `Finding` |
| 識別子 | `code: "BND04"` | `rule: "daylight.ratio"` |
| 重さ | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| 入口 | `checkDiagnostics(model)` | `validate(model)` |

フィールド名が違うので、二つの配列は取り違えようがない。連結しようとすれば型が落ちる。**「core の緑」と「判定の緑」を同じ言葉で語れないようにすることが、この分離の目的である。**

## validate

```ts
function validate(model: Model): Finding[]
```

全ての判定を回す。並びは章の順で、章の中は走査の順である。

**合否は返らない。**返るのは「守られなかったこと」の列であって、建物が使えるかどうかの結論ではない。空配列は「何も引っ掛からなかった」であって「合格」ではない。

```ts
import { validate } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

console.log(validate(parseFile("examples/tower/main.muro")));
```

```text
[]
```

引っ掛かる方の例。

```ts
import { parse, validate } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W`);
for (const f of validate(m)) console.log(JSON.stringify(f));
```

```text
{"rule":"envelope.gap","level":"caution","message":"Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior","line":4,"path":["/L1/a"]}
{"rule":"envelope.gap","level":"caution","message":"Perimeter not faced by any envelope: /L1/b — S 3600mm / E 4000mm / N 3600mm (11200mm over 3 run(s)). Write a boundary to the exterior","line":5,"path":["/L1/b"]}
{"rule":"daylight.ratio","level":"violation","message":"Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.06 m2 (1/7 of the 14.40 m2 floor)","line":4,"path":["/L1/a"]}
{"rule":"access.unreachable","level":"violation","message":"Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)","line":4,"path":["/L1/a"]}
{"rule":"access.unreachable","level":"violation","message":"Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)","line":5,"path":["/L1/b"]}
```

**この模型は `checkDiagnostics` を通る。**構成としては何も壊れていない — 外壁を一枚書き忘れ、窓を一つも書かず、扉を一枚も書いていないだけである。二つの面が別のことを言っているのが、この例で見える。

## Finding

```ts
interface Finding {
  rule: ValidationRule;
  level: "violation" | "caution";
  message: string;
  line?: number;
  file?: string;
  path?: string[];
}
```

| フィールド | 中身 |
|---|---|
| `rule` | 台帳の規則名 — 章と主題を `.` で繋いだ綴り |
| `level` | `"violation"` (守られなかった) か `"caution"` (疑わしい) |
| `message` | 本文。**位置接頭辞を含まない** (診断と同じ流儀) |
| `line` | 出所の行 |
| `file` | 合成時の出所レイヤー |
| `path` | 対象の空間・ゾーンのパス |

**`level` は規則の不変属性である。**同じ規則が場合によって `violation` になったり `caution` になったりはしない。重さを変えるときは新しい規則名を切る。だから `VALIDATION_RULES` を見て `level` を先に知ることができる。

`level` は診断の `severity` とは**別の軸である。**判定が緑でも構成が壊れていることはあるし、その逆もある。

## VALIDATION_RULES

```ts
const VALIDATION_RULES: Record<ValidationRule, "violation" | "caution">

type ValidationRule = keyof typeof VALIDATION_RULES;
```

判定の台帳である。**綴りが診断コードと違うのは事故を防ぐためである** — `ENV01` と `envelope.gap` を取り違える読み手はいない。

```ts
import { VALIDATION_RULES } from "@kensnzk/koyu";
console.log(Object.keys(VALIDATION_RULES).length);
for (const [k, v] of Object.entries(VALIDATION_RULES)) console.log(`${k}\t${v}`);
```

```text
15
envelope.gap	caution
daylight.ratio	violation
daylight.unknown	caution
stair.proportion	caution
run.slope	caution
run.disconnected	caution
access.unreachable	violation
access.voidonly	violation
access.throughtenant	caution
access.parking	violation
access.backofhouse	caution
column.blocksdoor	violation
site.escape	violation
site.area	caution
site.frontage	violation
```

**規則は 15 個で、この並びが `validate` の返り値の並びでもある。**

章 (`envelope` / `daylight` / `stair` / `run` / `access` / `column` / `site`) は管轄ではなく**主題**である。管轄が二つ目を持ったとき (別の国の法規) に、章の下へ足す。

一件ずつが何を見て何を言うかは [判定リファレンス](../validate/index.md)。

## 終了コードのように使う

`koyu validate` は `violation` があれば 1 を返し、`caution` だけなら 0 を返す。

```ts
import { validate } from "@kensnzk/koyu";

const findings = validate(model);
const code = findings.some((f) => f.level === "violation") ? 1 : 0;
```

`ValidationRule` は規則名の合併型なので、台帳に無い綴りはコンパイルが通らない。

```ts
import type { Finding, ValidationRule } from "@kensnzk/koyu";

const BLOCKING: ValidationRule[] = ["access.unreachable", "site.escape"];
const blocking = (fs: Finding[]) => fs.filter((f) => BLOCKING.includes(f.rule));
```

## 関連

- [判定リファレンス](../validate/index.md) — 15規則の中身
- [`koyu validate`](../cli/validate.md) — 同じ判定をコマンドラインから
- [診断](diagnostics.md) — 構成の整合を言う別の面
- [モデルへの問い](queries.md) — 判定が読んでいる数と形
