import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";
import { svgSection } from "../src/draw/section.js";

const source = `muro 1.8
grid X 0 6000
grid Y 0 4000
axis D1 X1+1000,Y1+1000 X1+2000,Y1+1500
level L1 0 h:2700 slab:180
space /L1/a room X1..X2 Y1..Y2
`;

test("plan extends the named reference line beyond its defining points without changing its slope", () => {
  const plan = svgPlan(parse(source), { scale: 0.05 });
  const line = /<g data-axis="D1"><line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(plan);
  assert.ok(line);
  const [x1, y1, x2, y2] = line.slice(1).map(Number) as [number, number, number, number];
  assert.ok(x1 < 84 && x2 > 384);
  assert.ok(Math.abs((y2 - y1) / (x2 - x1) + 0.5) < 1e-8);
  const expectedY = y1 + (134 - x1) * (y2 - y1) / (x2 - x1);
  assert.ok(Math.abs(expectedY - 234) < 1e-8);
});

test("CLI cuts along the selected named axis in either direction", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-axis-"));
  try {
    const file = join(dir, "test.muro"), output = join(dir, "section.svg");
    writeFileSync(file, source);
    const model = parse(source);
    for (const reverse of [false, true]) {
      const result = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "section", file, "--at", "D1",
        ...(reverse ? ["--look", "right"] : []), "-o", output], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const cut = reverse ? { x1: 2000, y1: 1500, x2: 1000, y2: 1000 } : { x1: 1000, y1: 1000, x2: 2000, y2: 1500 };
      assert.equal(readFileSync(output, "utf8"), svgSection(model, { cut, atRef: "D1" }));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("each primary Y datum has the family's signed inclination in the actual plan", () => {
  const input = source.replace("grid X 0 6000", "grid X 2000 8000")
    .replace("grid Y 0 4000", "grid Y 0 2000 4000 slope:-1/5")
    .replace("Y1..Y2", "Y1..Y3");
  const svg = svgPlan(parse(input), { scale: 0.05 });
  const datums = [...svg.matchAll(/<g data-axis="(Y\d+)"><line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)];
  assert.deepEqual(datums.map(match => match[1]), ["Y1", "Y2", "Y3"]);
  for (const datum of datums) {
    const [x1, y1, x2, y2] = datum.slice(2).map(Number) as [number, number, number, number];
    assert.ok(Math.abs((y2 - y1) / (x2 - x1) - 0.2) < 1e-8);
  }
});

test("offset sections on a sloping Y family cut the actual grid in both viewing directions", () => {
  const input = source.replace("grid X 0 6000", "grid X 2000 8000")
    .replace("grid Y 0 4000", "grid Y 0 4000 slope:1/5");
  const dir = mkdtempSync(join(tmpdir(), "koyu-skew-section-"));
  try {
    const file = join(dir, "input.muro"), output = join(dir, "out.svg");
    writeFileSync(file, input);
    for (const look of ["N", "S"]) {
      const cli = spawnSync(process.execPath,
        ["--import", "tsx", "src/cli.ts", "section", file, "--at", "Y1+1000", "--look", look, "-o", output], { encoding: "utf8" });
      assert.equal(cli.status, 0, cli.stderr);
      const cut = look === "N"
        ? { x1: 2000, y1: 1000, x2: 3000, y2: 1200 }
        : { x1: 3000, y1: 1200, x2: 2000, y2: 1000 };
      const svg = readFileSync(output, "utf8");
      assert.equal(svg, svgSection(parse(input), { cut, atRef: "Y1+1000" }));
      assert.match(svg, />X1<\/text>/);
      assert.match(svg, />X2<\/text>/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
