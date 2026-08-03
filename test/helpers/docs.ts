// Read the published documentation as the oracle for what a rule says.
//
// The migration from the old validators was proven against them while both existed. Once the old
// implementation is deleted, comparing the new one against itself would prove nothing, so the
// standing expectation is **the documented one**: every rule section in the validation reference
// carries a fixture and, right after it, the verdict line that fixture must produce.
//
// docs/ is authoritative in this repository, so binding the tests to it is not a convenience —
// it is what stops the implementation and the published contract from drifting apart.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const VALIDATE_DOCS = fileURLToPath(new URL("../../docs/reference/validate/", import.meta.url));

export interface DocumentedCase {
  /** The page the fixture came from, e.g. `runs.md`. */
  readonly page: string;
  /** The rule section it sits under, e.g. `koyu.schematic.stair.proportion`. */
  readonly section: string;
  /** The `.muro` source of the fixture. */
  readonly source: string;
  /** The rule id printed in the expected verdict line. */
  readonly rule: string;
  readonly level: "violation" | "caution";
  /** The source line the verdict points at. */
  readonly line: number;
  /** The verdict text, without the marker, rule and locator. */
  readonly message: string;
}

/**
 * Every `muro-fail` / `muro-caution` fixture in the validation reference, paired with the
 * verdict block that follows it.
 */
export function documentedCases(page?: string): DocumentedCase[] {
  const pages = page
    ? [page]
    : readdirSync(VALIDATE_DOCS).sort().filter((f) => f.endsWith(".md") && f !== "index.md");
  const out: DocumentedCase[] = [];

  for (const file of pages) {
    const lines = readFileSync(join(VALIDATE_DOCS, file), "utf8").split("\n");
    let section = "";
    for (let i = 0; i < lines.length; i++) {
      const heading = /^##\s+`([a-z0-9.-]+)`\s+—/.exec(lines[i]!);
      if (heading) section = heading[1]!;
      if (!/^```muro-(?:fail|caution)$/.test(lines[i]!)) continue;

      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length && lines[j] !== "```"; j++) body.push(lines[j]!);

      // the verdict block is the next ```text fence
      let k = j + 1;
      while (k < lines.length && lines[k] !== "```text") k++;
      const verdict = lines[k + 1] ?? "";
      const parsed = /^([✖⚠])\s+\[([a-z0-9.-]+)\]\s+\S+:line (\d+): (.*)$/.exec(verdict);
      if (!parsed) {
        throw new Error(`${file}:${k + 2}: the ${section} fixture has no parseable verdict line`);
      }
      out.push({
        page: file,
        section,
        source: body.join("\n"),
        rule: parsed[2]!,
        level: parsed[1] === "✖" ? "violation" : "caution",
        line: Number(parsed[3]),
        message: parsed[4]!,
      });
      i = k + 1;
    }
  }
  return out;
}
