#!/usr/bin/env node
// 同梱例の門番。**check だけでは足りない** (AGENTS.md 掟2)。
//
// check が緑でも建物が使えるとは限らない — 接する空間の既定は壁なので、扉を一枚も
// 宣言しない建物は緑のまま完全に密封される。実際、旗艦例は check 緑のまま
// 「床の無い吹抜けにしか扉が開かない区画が20」「車の出入口の無い2層の駐車場」
// 「他人の店舗を貫通する避難路」を抱えていた。掟2 が予言した失敗を旗艦例が踏んだ。
//
// ここが問うのは四つ。
//   1. check --strict が緑か (警告も含めて)
//   2. 領域を持つ室から外部へ**辿り着けるか** (扉の有無ではなく到達性)
//   3. 採光の対象と宣言した室が 1/7 を満たすか
//   4. 敷地があるなら接道が導けるか
//
//   npm run gate:examples

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/check.ts";
import { doorsBetween } from "../src/graph.ts";
import { daylight } from "../src/light.ts";
import { parseFile } from "../src/parse-file.ts";
import { siteReport } from "../src/site.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const EX = join(root, "examples");

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

/** 外部へ辿り着けない室。シャフト (通行不可) と吹抜けと外部そのものは問わない */
function unreachable(model) {
  const outs = [...model.spaces.values()].filter((s) => s.type === "exterior");
  if (outs.length === 0) return [];
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || s.type === "exterior" || s.type === "void") continue;
    // シャフト (EV等) は空間として連続するが人は通れない — 到達性を問わない
    if (s.type === "shaft") continue;
    if (!outs.some((o) => doorsBetween(model, s.path, o.path))) bad.push(s.path);
  }
  return bad;
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

  const diags = checkDiagnostics(model);
  const errs = diags.filter((d) => d.severity === "error");
  const warns = diags.filter((d) => d.severity === "warning");
  if (errs.length) problems.push(`check エラー ${errs.length}件 — ${errs[0].code} ${errs[0].message}`);
  if (warns.length) problems.push(`check 警告 ${warns.length}件 — ${warns[0].code} ${warns[0].message}`);

  const un = unreachable(model);
  if (un.length) {
    problems.push(`外部へ到達できない室 ${un.length}件 — ${un.slice(0, 4).join(" ")}${un.length > 4 ? " …" : ""}`);
  }

  const day = daylight(model).filter((d) => !d.ok);
  if (day.length) {
    problems.push(`採光1/7を満たさない室 ${day.length}件 — ${day.slice(0, 3).map((d) => d.space.path).join(" ")}`);
  }

  for (const poly of model.polygons.values()) {
    const zone = model.zones.get(poly.path);
    if (zone?.attrs["site"] !== 1) continue;
    const r = siteReport(model);
    const noFront = r.roads.filter((rd) => rd.frontage < 2000);
    if (noFront.length) {
      problems.push(`接道2m未満の道路 ${noFront.length}件 — ${noFront.map((rd) => rd.road.path).join(" ")}`);
    }
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
