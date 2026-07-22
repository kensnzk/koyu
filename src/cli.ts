#!/usr/bin/env node
// IFCXS v0 — CLI
//   npm run ifcxs -- check examples/two-rooms.ifcxs
//   npm run ifcxs -- plan  examples/two-rooms.ifcxs -o out/two-rooms.svg
//   npm run ifcxs -- doors examples/two-rooms.ifcxs /L1/a /out
//   npm run ifcxs -- graph examples/two-rooms.ifcxs
//   npm run ifcxs -- stats examples/two-rooms.ifcxs
//   npm run ifcxs -- json  examples/two-rooms.ifcxs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check } from "./check.js";
import { doorsBetween, neighbors } from "./graph.js";
import { areaM2, displayName, SourceError, toCanonical, type Model } from "./model.js";
import { parse } from "./parse.js";
import { svgPlan } from "./plan.js";

function load(file: string): Model {
  const src = readFileSync(file, "utf8");
  return parse(src);
}

function main(argv: string[]): number {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) {
    console.log(
      "使い方: ifcxs <check|plan|doors|graph|stats|json> <file.ifcxs> [引数...]",
    );
    return 2;
  }
  const model = load(file);

  switch (cmd) {
    case "check": {
      const { errors, warnings } = check(model);
      for (const w of warnings) console.log(`⚠ ${w}`);
      for (const e of errors) console.log(`✖ ${e}`);
      if (errors.length === 0) {
        console.log(
          `✔ 整合 — 空間 ${model.spaces.size} / 境界 ${model.boundaries.length}` +
            (warnings.length ? ` (警告 ${warnings.length})` : ""),
        );
        return 0;
      }
      return 1;
    }
    case "json": {
      process.stdout.write(toCanonical(model));
      return 0;
    }
    case "plan": {
      const oIdx = rest.indexOf("-o");
      const outFile =
        oIdx >= 0 && rest[oIdx + 1] ? rest[oIdx + 1]! : file.replace(/\.ifcxs$/, "") + ".svg";
      const svg = svgPlan(model);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, svg);
      console.log(`平面図を生成しました: ${outFile}`);
      return 0;
    }
    case "doors": {
      const [from, to] = rest;
      if (!from || !to) {
        console.log("使い方: ifcxs doors <file> /パスA /パスB");
        return 2;
      }
      const route = doorsBetween(model, from, to);
      if (!route) {
        console.log(`${from} から ${to} へは到達できません`);
        return 1;
      }
      console.log(`${route.doors}枚 — ${route.path.join(" → ")}`);
      return 0;
    }
    case "graph": {
      for (const s of model.spaces.values()) {
        const ns = neighbors(model, s.path);
        console.log(`${s.path} (${displayName(s)})`);
        for (const n of ns) {
          const mark = n.boundary.kind === "open" ? "〰 開放" : n.passable ? `— 扉${n.doors}` : "| 壁";
          const attrs = Object.entries(n.boundary.attrs)
            .map(([k, v]) => `${k}:${v}`)
            .join(" ");
          console.log(`  ${mark} → ${n.space.path}${attrs ? `  (${attrs})` : ""}`);
        }
      }
      return 0;
    }
    case "stats": {
      let total = 0;
      const byType = new Map<string, number>();
      for (const s of model.spaces.values()) {
        const a = areaM2(s);
        if (a === undefined) continue;
        total += a;
        byType.set(s.type, (byType.get(s.type) ?? 0) + a);
        console.log(`${s.path}\t${displayName(s)}\t${s.type}\t${a.toFixed(2)}㎡`);
      }
      console.log(`合計\t\t\t${total.toFixed(2)}㎡`);
      for (const [t, a] of byType) console.log(`  ${t}: ${a.toFixed(2)}㎡`);
      return 0;
    }
    default:
      console.log(`未知のコマンドです: ${cmd}`);
      return 2;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  if (e instanceof SourceError) {
    console.error(`✖ ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
