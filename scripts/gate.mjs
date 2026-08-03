#!/usr/bin/env node
// 同梱例の門番。**check だけでは足りない** (AGENTS.md 掟2)。
//
// check が緑でも建物が使えるとは限らない — 接する空間の既定は壁なので、扉を一枚も
// 宣言しない建物は緑のまま完全に密封される。実際、旗艦例は check 緑のまま
// 「床の無い吹抜けにしか扉が開かない区画が20」「他人の店舗を貫通する避難路」
// 「車の出入口の無い2層の駐車場」「バックヤードの奥で孤立したエスカレーター」を
// 抱えていた。掟2 が予言した失敗を旗艦例が踏んだ。
//
// ここが問うのは九つ。
//   1. check --strict が緑か (警告も含めて)
//   2. 領域を持つ室から外部へ**辿り着けるか** (扉の有無ではなく到達性)
//   3. 採光の対象と宣言した室が 1/7 を満たすか
//   4. 敷地があるなら接道が導けるか
//   5. 吹抜け (床の無い所) にしか扉が開かない区画が無いか
//   6. 階段室が賃貸区画を通らずに外部へ出られるか (避難は他人の店を通らない)
//   7. 駐車場から車が出られるか (幅2400mm以上の開口・open境界・斜路だけを通って)
//   8. 客が共用廊下からバックヤードを通らずに縦動線へ届くか
//   9. 柱が扉を塞いでいないか (位置を書かない要素どうしの衝突)
//
// **判定のロジックはここに無い。**問1 は core の診断そのものなので checkDiagnostics を
// 直に読み、問2〜9 は `assess()` が返す AssessmentReport を読むだけである — スクリプトの
// 中に閉じた判定は MCP からもAPIからも呼べず、機械にとって存在しないに等しい
// (spec/validation.md)。同じ問いを別の建物へ向けたければ `koyu validate` を呼べばよい。
//
//   npm run gate:examples

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/core/diagnose.ts";
import { parseFile } from "../src/parse-file.ts";
import { assess } from "../src/validate/index.ts";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "../src/validate/builtin/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const EX = join(root, "examples");

/**
 * 門にする規則と、その見出し。並びは上の問いの番号どおりである。
 *
 * **`validate` が返す全部ではない。**門番が問うのは九つであって、判定の面の全部ではない —
 * `envelope.gap` や `stair.proportion` のように「同梱例としてはこれでよい」と判断して
 * 抱えている caution がある。門を広げたいなら、まず例の側を直してからここに足す。
 */
const GATED = [
  ["koyu.schematic.access.unreachable", "外部へ到達できない室"],
  ["koyu.schematic.daylight.ratio", "採光1/7を満たさない室"],
  ["koyu.schematic.site.frontage", "接道2m未満の道路"],
  ["koyu.schematic.access.voidonly", "吹抜けにしか扉が開かない区画"],
  ["koyu.schematic.access.throughtenant", "賃貸区画を通らないと外部へ出られない階段室"],
  ["koyu.schematic.access.parking", "車が外部へ出られない駐車場"],
  ["koyu.schematic.access.backofhouse", "共用廊下からバックヤードを通らずに届かない縦動線"],
  ["koyu.schematic.column.blocksdoor", "柱が塞いでいる扉"],
];

/** 判定の根拠は明示する — 基準日を時計から読むと、同じ例が日によって違う門をくぐる */
const GATE_CONTEXT = { schema: "koyu-context/1", asOf: "2026-08-03", values: {} };
const GATE_REGISTRY = createSchematicRegistry();

/** 同梱例の入口 — ディレクトリなら main.muro、単体なら .muro そのもの */
function entries() {
  const out = [];
  for (const e of readdirSync(EX)) {
    const p = join(EX, e);
    if (statSync(p).isDirectory()) {
      const main = join(p, "main.muro");
      try {
        statSync(main);
        out.push(main);
      } catch {
        // steps/ のように入口を持たない集まりは、各ファイルを単体として見る
        for (const f of readdirSync(p)) if (f.endsWith(".muro")) out.push(join(p, f));
      }
    } else if (e.endsWith(".muro")) {
      out.push(p);
    }
  }
  return out.sort();
}

/** 件数つきの問題文。長い列挙は先頭4件で切る */
function listUp(paths) {
  return `${paths.slice(0, 4).join(" ")}${paths.length > 4 ? " …" : ""}`;
}

let failed = 0;
for (const file of entries()) {
  const name = relative(root, file);
  const problems = [];
  let model;
  try {
    model = parseFile(file);
  } catch (e) {
    console.log(`✖ ${name}\n    解析: ${e.message}`);
    failed++;
    continue;
  }

  // 問1 — core の保証。ここだけは判定ではないので診断を直に読む
  const diags = checkDiagnostics(model);
  const errs = diags.filter((d) => d.severity === "error");
  const warns = diags.filter((d) => d.severity === "warning");
  if (errs.length) problems.push(`check エラー ${errs.length}件 — ${errs[0].code} ${errs[0].message}`);
  if (warns.length) problems.push(`check 警告 ${warns.length}件 — ${warns[0].code} ${warns[0].message}`);

  // 問2〜9 — 建築的な判定。門番は AssessmentReport を読むだけである
  const report = assess(model, {
    registry: GATE_REGISTRY,
    profile: SCHEMATIC_PROFILE_ID,
    context: GATE_CONTEXT,
  });
  // 判定できなかったものを黙って通さない — 「不明」は「合格」ではない
  for (const run of report.rules) {
    if (run.state === "error") problems.push(`規則が実行できなかった [${run.rule.id}] — ${run.issues[0]?.message ?? ""}`);
    if (run.state === "indeterminate") problems.push(`入力不足で判定できない [${run.rule.id}] — ${run.evaluation.reason}`);
  }

  const byRule = new Map();
  for (const f of report.findings) {
    const list = byRule.get(f.rule.id);
    if (list) list.push(f);
    else byRule.set(f.rule.id, [f]);
  }
  for (const [rule, label] of GATED) {
    const hits = byRule.get(rule);
    if (!hits) continue;
    problems.push(
      `${label} ${hits.length}件 [${rule}] — ${listUp(hits.map((f) => f.outcome.subjects.map((s) => s.ref).join("|")))}`,
    );
  }

  if (problems.length === 0) {
    console.log(`✔ ${name}`);
  } else {
    console.log(`✖ ${name}`);
    for (const p of problems) console.log(`    ${p}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n門番: 全例が通った" : `\n門番: ${failed}件が落ちた`);
process.exit(failed === 0 ? 0 : 1);
