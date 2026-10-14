import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseFileWith } from "../../src/parse-file.js";
import { observeSpatial, spatialBody } from "./model.js";
import { spatialPlan } from "./plan.js";

try {
  const [command, file, ...rest] = process.argv.slice(2);
  if (!command || !file || !["check", "json", "plan"].includes(command)) {
    throw new Error("Usage: npm run spatial -- <check|json|plan> <file.spatial> [-l level] [-o output]");
  }
  const options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]!, value = rest[i + 1];
    if (!["-l", "-o"].includes(key) || !value || value.startsWith("-") || options.has(key)) throw new Error(`Invalid option: ${key}`);
    options.set(key, value);
  }
  if (command !== "plan" && options.has("-l")) throw new Error("-l is only supported by plan");
  const entry = realpathSync.native(file);
  const body = spatialBody(readFileSync(entry, "utf8"));
  const report = observeSpatial(parseFileWith(entry, path => path === entry ? body : undefined));
  let output: string;
  if (command === "json") output = JSON.stringify(report, null, 2) + "\n";
  else if (command === "plan") {
    const level = options.get("-l") ?? (report.levels.length === 1 ? report.levels[0]!.name : undefined);
    if (!level) throw new Error("Choose a level with -l");
    output = spatialPlan(report, level);
  } else {
    output = report.diagnostics.map(d => `${d.severity} ${d.code}: ${d.message}\n`).join("") +
      `${report.state === "consistent" ? "Consistent" : "Invalid"} spatial model: ${report.spaces.length} spaces; ${report.relations.filter(r => r.resolution === "unresolved").length} unresolved boundary segments\n` +
      "Spatial consistency only. Circulation, daylight and egress are not evaluated.\n";
  }
  const out = options.get("-o");
  if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, output); }
  else process.stdout.write(output);
  process.exitCode = report.state === "invalid" ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
