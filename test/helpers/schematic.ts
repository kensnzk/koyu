// Test-only convenience for running koyu's own rule pack.
//
// This is **not** a compatibility layer. It composes exactly the values any caller composes —
// a local immutable registry, one named profile, one explicit context — and then flattens the
// failing outcomes into the few fields most tests want to compare. Nothing here is exported
// from the package, and no test may reach a rule except through a registry it built itself.

import type { Model } from "../../src/core/model.js";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "../../src/validate/builtin/index.js";
import { assess, type AssessmentReport, type FindingLevel } from "../../src/validate/index.js";

/** A fixed date. The engine never fills one in, and a test must not depend on the clock. */
export const TEST_AS_OF = "2026-08-03";

export function schematicContext(asOf: string = TEST_AS_OF) {
  return { schema: "koyu-context/1", asOf, values: {} } as const;
}

export function assessSchematic(model: Model, asOf: string = TEST_AS_OF): AssessmentReport {
  return assess(model, {
    registry: createSchematicRegistry(),
    profile: SCHEMATIC_PROFILE_ID,
    context: schematicContext(asOf),
  });
}

/** One failing outcome, flattened to the fields the older validation tests compared. */
export interface Caught {
  readonly rule: string;
  readonly level: FindingLevel;
  readonly message: string;
  readonly line?: number;
  readonly file?: string;
  readonly path: readonly string[];
}

/** Every fail outcome the pack produced, in report order. */
export function caught(model: Model, asOf: string = TEST_AS_OF): Caught[] {
  return assessSchematic(model, asOf).findings.map((finding) => {
    const located = finding.outcome.evidence
      .flatMap((item) => item.sources)
      .find((source) => source.kind === "model" && source.location?.line !== undefined);
    const location = located?.kind === "model" ? located.location : undefined;
    return {
      rule: finding.rule.id,
      level: finding.level,
      message: finding.outcome.message,
      ...(location?.line !== undefined ? { line: location.line } : {}),
      ...(location?.file !== undefined ? { file: location.file } : {}),
      path: finding.outcome.subjects.map((subject) => subject.ref),
    };
  });
}

/** The subject refs caught by one rule id. */
export function caughtBy(model: Model, ruleId: string, asOf: string = TEST_AS_OF): string[] {
  return caught(model, asOf)
    .filter((finding) => finding.rule === ruleId)
    .flatMap((finding) => finding.path);
}
