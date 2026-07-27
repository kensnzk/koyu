[English](en/validation.md) · **日本語**

# 判定の台帳 — 検証の面

koyu v1.0.0-rc.1 現在。**この面は凍らない** ([scope.md §8](scope.md#8-100-が凍結する八つの面))。

`koyu check` が言うのは「書かれたものがデータとして矛盾していない」までである ([scope.md §3](scope.md#3-保証の範囲--検査が通ったの意味))。建築として妥当かは、この面が言う。原因と直し方は [guide/validation.md](../guide/validation.md)。

## core との分け方

判定の出力が原本の保証と読まれないよう、**型からして別にしてある**。

| | core の診断 | 検証の判定 |
|---|---|---|
| 型 | `Diagnostic` | `Finding` |
| 識別子 | `code: "BND04"` | `rule: "daylight.ratio"` |
| 重さ | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| 入口 | `checkDiagnostics(model)` / `koyu check` | `validate(model)` / `koyu validate` |
| 版 | **凍る** | 凍らない — 増える・精度が上がる・捨てられる |

フィールド名が違うので二つの配列は取り違えようがなく、連結しようとすれば型が落ちる。**「core の緑」と「判定の緑」を同じ言葉で語れないようにすること**が、この分離の目的である。

`level` はコードの不変属性である — 同じ規則が場合によって `violation` になったり `caution` になったりはしない (core の severity と同じ規律)。重さを変えるときは新しい規則名を切る。

## 台帳

実装の `VALIDATION_RULES` (`src/validate/index.ts`) が正であり、本表はその写しである。テストが集合一致を守る。

| 規則 | level | 概要 |
|---|---|---|
| `envelope.gap` | caution | 外皮に穴 — 他の空間とも宣言された境界とも向かい合っていない外周がある ([ADR-0025](../docs/decisions/0025-envelope-gaps.md))。**外部への境界を一本でも書いたレベルだけ**を検査する (書き始めたなら閉じきる、という整合であって完全性の要求ではない) |
| `daylight.ratio` | violation | 有効窓面積 < 床面積/7。対象は `daylight:1` を書いた空間だけ ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md))。補正係数を掛けない粗い判定 |
| `daylight.unknown` | caution | `h` を持たない窓があり、窓面積を数え切れていない — 足りているのか数えていないのかを区別するための印 |
| `stair.proportion` | caution | 導出された段が窮屈 (踏面 <240mm、または 2×蹴上+踏面 が 550〜700mm の外)。折返しでは**最も窮屈な走り**が代表する |
| `run.slope` | caution | 導出された勾配が宣言 `slope:` より急、またはエスカレーターの常用域 (約1/1.7) から外れる |
| `run.disconnected` | caution | 縦動線の形はあるが上下を繋ぐ垂直境界が無い (形はあってもグラフでは通れない) |
| `access.unreachable` | violation | 領域を持つ室から、通れる境界を辿って外部空間へ出られない。**扉の有無ではなく到達性**を問う。シャフト (人が通れない)・吹抜け (床が無い)・外部は対象外 |
| `access.voidonly` | violation | 通れる境界を持つのに、その行き先が全部 `type:void` — 扉が床の無い穴に向かって開いている |
| `access.throughtenant` | caution | 階段室から外部へ出る経路が `use:rentable` の空間を必ず通る (テナントが施錠すると死ぬ避難路)。専用通路として通す設計もあるので caution |
| `access.parking` | violation | `use:parking` の空間から車が外部へ出られない。車が通れるのは `type:open` の境界・幅 2400mm 以上の扉・斜路 (`ramp:` を持つ空間の縦連結) だけ |
| `access.backofhouse` | caution | 縦動線の宣言を持つ共用空間へ、共用廊下から `type:backyard` を通らずに届かない。共用廊下が一つも無い建物では問わない。当の空間へは**水平に**入れることを要求する〈近似〉 |
| `column.blocksdoor` | violation | 導出された柱が導出された扉と重なる ([ADR-0023](../docs/decisions/0023-columns.md))。**どちらも原本には座標が無い**ので、衝突は導出でしか分からない |
| `site.escape` | violation | 建物が敷地形状からはみ出す。四隅の内包に加え頂点の入り込みと辺の交差を見るため凹敷地でも正しい。境界上は内側扱い・許容1mm。外部空間タイルは検査しない〈近似〉 |
| `site.area` | caution | 敷地面積の宣言 (`area:` 測量値) と多角形からの導出が ±0.05㎡ を超えて食い違う |
| `site.frontage` | violation | 接道長が 2000mm 未満 (法43条の粗い写し)。建物外壁が道路に面する分は数えない。**`site:1` のゾーンが無い模型では問わない** — 導かれる0は「接道が無い」ではなく「導けていない」である |

## 閾値

判定の閾値は**建築の側の数**であって、原本の構成が満たすべき不変量ではない。すべて実装の定数として一箇所にあり、管轄が二つ目を持ったときに章の下へ足す。

| 定数 | 値 | 出所 |
|---|---|---|
| `DAYLIGHT_DIVISOR` | 7 | `src/validate/light.ts` |
| `TREAD_MIN` | 240mm | `src/validate/runs.ts` |
| `STEP_RULE` | 550〜700mm | 同上 |
| `ESCALATOR_SLOPE` | 1/2.3 〜 1/1.4 | 同上 |
| `CAR_WIDTH_MIN` | 2400mm | `src/validate/access.ts` — 車が通れる開口の最小幅 (人の扉 900mm では車は出られない) |
| `FRONTAGE_MIN` | 2000mm | `src/validate/site.ts` |
| `COVERED_SEMI_FACTOR` | 0.7 | `src/core/light.ts` — これは**係数であって閾値ではない**ので core にある (窓の先が何かという導出) |

## 入口

```sh
koyu validate <file.muro>          # 人向け。0=違反なし / 1=違反あり
koyu validate <file.muro> --json   # Finding[]
```

```ts
import { validate, VALIDATION_RULES, type Finding } from "@kensnzk/koyu";
```

MCP では `validate` ツール。**すべての判定は MCP から呼べる** — 呼べない判定は、機械にとって存在しないに等しい。

## 増やすときの規律

判定を足すのは安い。面を一つ増やすだけで、言語の版は動かない。守るのは二つだけである。

1. **`VALIDATION_RULES` に載せ、本表と [guide/validation.md](../guide/validation.md) に節を書く。**テストが集合一致を守る
2. **core を触らない。**判定のために core へ属性や診断を足したくなったら、それは判定ではなく構造整合かもしれない — [scope.md §3](scope.md#3-保証の範囲--検査が通ったの意味) に照らして決める
