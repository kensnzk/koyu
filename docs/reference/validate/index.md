---
title: koyu validate — 建築的な判定
mode: reference
---

# koyu validate — 建築的な判定

[`koyu check`](../cli/check.md) が言うのは「書かれたものがデータとして矛盾していない」までである。採光が足りるか、外皮が閉じているか、階段が登れるか、車が駐車場から出られるか、建物が敷地に収まるか — 建築の側の判断は一つも含まれていない。**それを言うのが `koyu validate` であり、この巻である。**

```sh
koyu validate examples/tower/main.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

同梱の建物 (`two-rooms` `office` `house` `mansion` `tower` `basement` `complex` `twin`) は、いま全て何も引っ掛からない。

## 二つの緑は同じ言葉で語れない

判定の結果が構成の保証と読み違えられないよう、**型からして分けてある**。

| | 構成の診断 | 建築の判定 |
|---|---|---|
| 型 | `Diagnostic` | `Finding` |
| 識別子 | `code: "BND04"` | `rule: "daylight.ratio"` |
| 重さ | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| 入口 | `checkDiagnostics(model)` / [`koyu check`](../cli/check.md) | `validate(model)` / [`koyu validate`](../cli/validate.md) |
| 綴り | 大文字4+2桁のコード | 章と主題を `.` で繋いだ規則名 |
| 版 | 凍る | **凍らない** — 増える・精度が上がる・捨てられる |

フィールド名が違うので、二つの配列は取り違えようがない。連結しようとすれば型が落ちる。`ENV01` と `envelope.gap` を取り違える読み手はいない — それがこの綴りの分け方の目的である。

**`level` は規則の不変属性である。**同じ規則が場合によって `violation` になったり `caution` になったりはしない。重さを変えるときは新しい規則名を切る。

## level と終了コード

| level | 意味 | `koyu validate` の終了コード |
|---|---|---|
| `violation` | 規則が守られていない | 1 |
| `caution` | 疑わしい、または数え切れていない | 0 |

`check` の `error` / `warning` とは**別の軸である**。判定が緑でも構成が壊れていることはあるし、その逆もある。`--json` を付けても終了コードの規則は同じ。

## 台帳 — 15の規則

並びは章の順で、章の中は台帳 (`VALIDATION_RULES`) の宣言順である。**章の中の並びは出力と一致しない** — 出力は走査の単位ごとに出るので、一つの走りについては `run.disconnected` が `stair.proportion` / `run.slope` より先に出るし、敷地は `site.frontage` → `site.area` → `site.escape` の順に出る。章の順序 (`envelope` → `daylight` → 縦動線 → `access`/`column` → `site`) だけが出力と同じである。

| 規則 | level | 何を言うか |
|---|---|---|
| [`envelope.gap`](envelope.md#envelope-gap) | caution | 何にも面していない外周がある — 外皮に穴 |
| [`daylight.ratio`](daylight.md#daylight-ratio) | violation | 有効窓面積が床面積の 1/7 に足りない |
| [`daylight.unknown`](daylight.md#daylight-unknown) | caution | `h:` を持たない窓があり、窓面積を数え切れていない |
| [`stair.proportion`](runs.md#stair-proportion) | caution | 導出された段が窮屈 (踏面 240mm 未満、または 2×蹴上+踏面 が 550〜700mm の外) |
| [`run.slope`](runs.md#run-slope) | caution | 導出された勾配が宣言 `slope:` より急、またはエスカレーターの常用域の外 |
| [`run.disconnected`](runs.md#run-disconnected) | caution | 縦動線の形はあるが、上下を繋ぐ垂直境界が無い |
| [`access.unreachable`](access.md#access-unreachable) | violation | 領域を持つ室から外部へ辿り着けない |
| [`access.voidonly`](access.md#access-voidonly) | violation | 扉が吹抜け (床の無い所) にしか開いていない |
| [`access.throughtenant`](access.md#access-throughtenant) | caution | 階段室からの避難が賃貸区画を必ず通る |
| [`access.parking`](access.md#access-parking) | violation | 駐車場から車が出られない |
| [`access.backofhouse`](access.md#access-backofhouse) | caution | 共用廊下からバックヤードを通らずに縦動線へ届かない |
| [`column.blocksdoor`](column.md#column-blocksdoor) | violation | 導出された柱が導出された扉と重なる |
| [`site.escape`](site.md#site-escape) | violation | 建物が敷地形状からはみ出す |
| [`site.area`](site.md#site-area) | caution | 敷地面積の宣言と導出が食い違う |
| [`site.frontage`](site.md#site-frontage) | violation | 接道長が 2m に足りない |

章 (`envelope` / `daylight` / `stair` / `run` / `access` / `column` / `site`) は管轄ではなく**主題**である。管轄が二つ目を持ったとき — 日本の法規と別の国の法規 — に、章の下へ足す。

## 閾値

判定の閾値は**建築の側の数**であって、書かれた構成が満たすべき不変量ではない。だから一箇所にまとめて置いてある。

| 定数 | 値 | どの規則が読むか |
|---|---|---|
| `DAYLIGHT_DIVISOR` | 7 | [`daylight.ratio`](daylight.md#daylight-ratio) |
| `TREAD_MIN` | 240mm | [`stair.proportion`](runs.md#stair-proportion) |
| `STEP_RULE` | 550〜700mm | [`stair.proportion`](runs.md#stair-proportion) |
| `ESCALATOR_SLOPE` | 1/2.3 〜 1/1.4 | [`run.slope`](runs.md#run-slope) |
| `CAR_WIDTH_MIN` | 2400mm | [`access.parking`](access.md#access-parking) |
| `FRONTAGE_MIN` | 2000mm | [`site.frontage`](site.md#site-frontage) |
| 敷地面積の許容 | ±0.05㎡ | [`site.area`](site.md#site-area) |
| 敷地形状の許容 | 1mm (境界上は内側) | [`site.escape`](site.md#site-escape) |

採光の半屋外係数 0.7 はここに無い。あれは**閾値ではなく係数**で、「窓の先が何か」という形の導出に属する — 詳しくは [採光](daylight.md) を見る。

## 三つの入口

```sh
koyu validate <file.muro>          # 人向け。0=違反なし / 1=違反あり
koyu validate <file.muro> --json   # Finding[] を JSON で
```

```ts
import { validate, VALIDATION_RULES, type Finding } from "@kensnzk/koyu";
// 領域として分けた入口もある: import { validate } from "@kensnzk/koyu/validate";

const findings: Finding[] = validate(model);
const violations = findings.filter((f) => f.level === "violation");
```

`--json` が返す一件はこの形である。

```json
{
 "rule": "daylight.unknown",
 "level": "caution",
 "message": "Window area is not fully counted: /L1/a has a window without h: (write h: on it)",
 "line": 6,
 "file": "/path/to/main.muro",
 "path": [
  "/L1/a"
 ]
}
```

`line` は出所の行、`file` は合成に参加した層のうち**その値を書いた層**、`path` は対象の空間かゾーンである。位置を持たない判定もあるので、`line` と `file` は省かれうる。

MCP サーバー `koyu-mcp` では `validate` ツールが同じ `Finding[]` を `violations` / `cautions` の件数とともに返す。**すべての判定は MCP から呼べる** — 呼べない判定は、機械にとって存在しないに等しい。

## 欠番の診断コードから来た読者へ

かつて `check` の診断だったものの一部は、建築の判断だったのでこの面へ移された。**同じ綴りは再利用しない** — 過去の出力が読めなくなるからである。

| 旧コード | 現在の規則 |
|---|---|
| `ENV01` | [`envelope.gap`](envelope.md#envelope-gap) |
| `RUN06` | [`stair.proportion`](runs.md#stair-proportion) |
| `RUN07` | [`run.slope`](runs.md#run-slope) |
| `RUN08` | [`run.disconnected`](runs.md#run-disconnected) |
| `SIT03` | [`site.escape`](site.md#site-escape) |
| `SIT05` | [`site.area`](site.md#site-area) |

欠番の一覧は [欠番になった診断コード](../diagnostics/retired.md) にある。

## この面は凍らない

規則が粗くても、管轄が一つしかなくても、精度が足りなくても、この面は増やしてよいし捨ててよい。**値段が安いのは、凍らないからである。**判定を一つ足すのに言語の版は動かない — 台帳に一行と、この巻に一節が増えるだけである。

汚くてよい条件は一つだけある。**判定の結果が、構成の保証と混同されないこと。**そのために型が分けてあり、綴りが分けてあり、この巻が `check` の巻と別に立っている。
