#!/usr/bin/env node
// IFCXS v0.1 — CLI
//   npm run ifcxs -- check  examples/office.ifcxs
//   npm run ifcxs -- plan   examples/office.ifcxs -l L2 -o out/office-L2.svg
//   npm run ifcxs -- doors  examples/office.ifcxs /L2/office /out
//   npm run ifcxs -- graph  examples/office.ifcxs
//   npm run ifcxs -- stats  examples/office.ifcxs
//   npm run ifcxs -- levels examples/office.ifcxs   # テキストの矩計 (高さの積み上がり)
//   npm run ifcxs -- json   examples/office.ifcxs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check } from "./check.js";
import { doorsBetween, neighbors } from "./graph.js";
import { daylight } from "./light.js";
import {
  areaM2,
  displayName,
  effectiveUse,
  heff,
  levelsSorted,
  SourceError,
  toCanonical,
  zoneAreaM2,
  type Model,
} from "./model.js";
import { parse } from "./parse.js";
import { svgPlan } from "./plan.js";

function load(file: string): Model {
  const src = readFileSync(file, "utf8");
  return parse(src);
}

function opt(rest: string[], ...names: string[]): string | undefined {
  for (const n of names) {
    const i = rest.indexOf(n);
    if (i >= 0 && rest[i + 1]) return rest[i + 1];
  }
  return undefined;
}

function main(argv: string[]): number {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) {
    console.log(
      "使い方: ifcxs <check|plan|doors|graph|stats|levels|light|json> <file.ifcxs> [引数...]",
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
      const level = opt(rest, "-l", "--level") ?? Object.keys(model.levels)[0];
      const explicit = opt(rest, "-o");
      const outFile =
        explicit ?? `${file.replace(/\.ifcxs$/, "")}-${level}.svg`;
      const svg = svgPlan(model, { level });
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
          const mark =
            n.boundary.kind === "open"
              ? "〰 開放"
              : n.boundary.kind === "stair"
                ? "↕ 階段"
                : n.boundary.kind === "shaft"
                  ? "↕ シャフト(通行不可)"
                  : n.boundary.kind === "void"
                    ? "↕ 吹抜け"
                    : n.passable
                      ? `— 扉${n.doors}`
                      : "| 壁";
          const attrs = Object.entries(n.boundary.attrs)
            .map(([k, v]) => `${k}:${v}`)
            .join(" ");
          console.log(`  ${mark} → ${n.space.path}${attrs ? `  (${attrs})` : ""}`);
        }
      }
      return 0;
    }
    case "stats": {
      const levels = levelsSorted(model);
      const spaces = [...model.spaces.values()];
      let total = 0;
      const byType = new Map<string, number>();
      const byUse = new Map<string, number>();
      for (const l of levels) {
        const onLevel = spaces.filter((s) => s.level === l.name && s.rects.length > 0);
        if (onLevel.length === 0) continue;
        console.log(`${l.name}`);
        let sub = 0;
        for (const s of onLevel) {
          if (s.type === "void") {
            console.log(`  ${s.path}\t${displayName(s)}\t吹抜け (床面積不算入)`);
            continue;
          }
          const a = areaM2(s)!;
          sub += a;
          total += a;
          byType.set(s.type, (byType.get(s.type) ?? 0) + a);
          const use = effectiveUse(model, s);
          if (use) byUse.set(use, (byUse.get(use) ?? 0) + a);
          console.log(`  ${s.path}\t${displayName(s)}\t${s.type}\t${a.toFixed(2)}㎡`);
        }
        console.log(`  小計 ${sub.toFixed(2)}㎡`);
      }
      console.log(`合計 ${total.toFixed(2)}㎡`);
      if (model.zones.size > 0) {
        console.log("ゾーン別 (数える集約):");
        for (const z of [...model.zones.values()].sort((a, b) => (a.path < b.path ? -1 : 1))) {
          const nm = z.attrs["name"];
          console.log(
            `  ${z.path}\t${typeof nm === "string" ? nm : ""}\t${zoneAreaM2(model, z.path).toFixed(2)}㎡`,
          );
        }
      }
      for (const [t, a] of byType) console.log(`  ${t}: ${a.toFixed(2)}㎡`);
      if (byUse.size > 0) {
        const parts = [...byUse.entries()].map(
          ([u, a]) => `${u} ${a.toFixed(2)}㎡ (${((a / total) * 100).toFixed(1)}%)`,
        );
        console.log(`use別: ${parts.join(" / ")}`);
      }
      return 0;
    }
    case "light": {
      const results = daylight(model);
      if (results.length === 0) {
        console.log("対象の居室 (住居系) がありません");
        return 0;
      }
      let fail = 0;
      for (const r of results) {
        if (!r.ok) fail++;
        const ratio = r.window > 0 ? `1/${(r.floor / r.window).toFixed(1)}` : "窓なし";
        console.log(
          `${r.ok ? "✔" : "✖"} ${r.space.path}\t${displayName(r.space)}\t窓 ${r.window.toFixed(2)}㎡ / 床 ${r.floor.toFixed(2)}㎡ = ${ratio} (必要 1/7 ≈ ${r.need.toFixed(2)}㎡)` +
            (r.missingH ? " ⚠ h未指定の窓は数えていません" : ""),
        );
      }
      console.log(
        fail === 0
          ? `✔ 全${results.length}室が 1/7 を満たします (補正係数なしの粗い判定)`
          : `✖ ${results.length}室中 ${fail}室が不足しています`,
      );
      return fail === 0 ? 0 : 1;
    }
    case "levels": {
      // テキストの矩計: レベルの積み上がりと高さの検算
      const levels = levelsSorted(model);
      if (levels.length === 0) {
        console.log("レベルが定義されていません");
        return 1;
      }
      for (let i = levels.length - 1; i >= 0; i--) {
        const l = levels[i]!;
        const upper = levels[i + 1];
        console.log(
          `${l.name}\tz:${l.z}` +
            (l.h !== undefined ? `\th:${l.h}` : "") +
            (l.slab !== undefined ? `\tslab:${l.slab}` : ""),
        );
        if (upper) {
          const pitch = upper.z - l.z;
          const detail =
            l.h !== undefined && upper.slab !== undefined
              ? ` = 天井${l.h} + slab${upper.slab}` +
                (pitch - l.h - upper.slab > 0 ? ` + 余り${pitch - l.h - upper.slab}` : "")
              : "";
          console.log(`  ↑ 階高 ${pitch}${detail}`);
        }
      }
      const spaces = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level);
      const overrides = spaces.filter((s) => typeof s.attrs["h"] === "number");
      for (const s of overrides) {
        console.log(`個別天井高: ${s.path} h:${heff(model, s)}`);
      }
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
