import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContextSnapshot } from "../src/analysis/contracts.js";
import { EPS } from "../src/core/tolerance.js";
import { svgPlan } from "../src/draw/plan.js";
import { parseFile } from "../src/parse-file.js";
import { runAnalysis } from "../src/validate/assessment.js";
import {
  OPENING_OPERATIONS_ANALYSIS_ID,
  type OpeningOperationsAnalysisValue,
} from "../src/validate/builtin/opening-operations.js";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "../src/validate/builtin/index.js";

const [, , sourceArg, levelArg, outputArg] = process.argv;
if (!sourceArg || !levelArg || !outputArg) {
  throw new Error("usage: render-opening-operation-preview <source.muro> <level> <output.svg>");
}

const source = resolve(sourceArg);
const output = resolve(outputArg);
const scale = 0.05;
const margin = 84;
const model = parseFile(source);
const context: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-24",
  values: {},
};
const artifact = runAnalysis(model, OPENING_OPERATIONS_ANALYSIS_ID, {
  registry: createSchematicRegistry(),
  profile: SCHEMATIC_PROFILE_ID,
  context,
}).result.artifact;
if (artifact.state !== "complete") throw new Error("opening operation analysis did not complete");

const levelSpaces = [...model.spaces.values()].filter((space) => space.level === levelArg && space.rects.length > 0);
const rects = levelSpaces.flatMap((space) => space.rects);
if (rects.length === 0) throw new Error(`no region on ${levelArg}`);
const minX = Math.min(...rects.map((rect) => rect.x1));
const maxY = Math.max(...rects.map((rect) => rect.y2));
const sx = (x: number) => (x - minX) * scale + margin;
const sy = (y: number) => (maxY - y) * scale + margin;

const overlays = operationOverlay(artifact.value, levelArg, sx, sy);
const svg = svgPlan(model, { level: levelArg, scale });
writeFileSync(output, svg.replace("</svg>", `${overlays}\n</svg>`));

function operationOverlay(
  value: OpeningOperationsAnalysisValue,
  level: string,
  x: (value: number) => number,
  y: (value: number) => number,
): string {
  const parts = ['<g class="opening-operation-preview">'];
  for (const opening of value.openings.filter((item) => item.level === level)) {
    for (const leaf of opening.storage) {
      const failed = leaf.outsideTargetMm > EPS;
      const colour = failed ? "#d9483b" : "#12856f";
      const line = leaf.parked;
      parts.push(
        `<line x1="${x(line.x1)}" y1="${y(line.y1)}" x2="${x(line.x2)}" y2="${y(line.y2)}" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>`,
        `<line x1="${x(line.x1)}" y1="${y(line.y1)}" x2="${x(line.x2)}" y2="${y(line.y2)}" stroke="${colour}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>`,
        `<circle cx="${x(line.x1)}" cy="${y(line.y1)}" r="3.2" fill="${colour}"/>`,
        `<circle cx="${x(line.x2)}" cy="${y(line.y2)}" r="3.2" fill="${colour}"/>`,
      );
      const label = failed ? `${leaf.outsideTargetMm} mm outside` : `${leaf.widthMm} mm fits`;
      parts.push(
        `<text x="${(x(line.x1) + x(line.x2)) / 2 + 7}" y="${(y(line.y1) + y(line.y2)) / 2 - 7}" font-size="10" font-family="system-ui, sans-serif" fill="${colour}">${label}</text>`,
      );
    }
  }
  parts.push("</g>");
  return parts.join("\n");
}
