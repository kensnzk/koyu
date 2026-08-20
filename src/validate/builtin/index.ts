// koyu — the built-in schematic rule pack
//
// **This is design lint, not code compliance.** The constants below recall statute and custom,
// but nothing here reads a jurisdiction, an effective date, a use-class condition, an exception,
// or an administrative interpretation. The namespace says so: `koyu.schematic.*`, never `jp.bsl.*`.
// What it is good for is an early, reproducible screen at schematic resolution.
//
// The catalog is a **value**, not a registration. Nothing here mutates a process-global registry
// and nothing runs at import time beyond building frozen literals — the caller composes a local
// immutable registry and passes it in.

import type { AnalysisDefinition, AnalysisRef } from "../../analysis/contracts.js";
import type { JsonValue } from "../../analysis/json.js";
import { createAssessmentRegistry } from "../assessment.js";
import type {
  AssessmentRegistry,
  Profile,
  ProfileRef,
  Rule,
  RuleSet,
  RuleSetRef,
} from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

import {
  ACCESS_ANALYSIS,
  ACCESS_ANALYSIS_ID,
  ACCESS_BACKOFHOUSE_RULE,
  ACCESS_PARKING_RULE,
  ACCESS_THROUGHTENANT_RULE,
  ACCESS_UNREACHABLE_RULE,
  ACCESS_VOIDONLY_RULE,
} from "./access.js";
import {
  DAYLIGHT_ANALYSIS,
  DAYLIGHT_ANALYSIS_ID,
  DAYLIGHT_RATIO_RULE,
  DAYLIGHT_UNKNOWN_RULE,
} from "./daylight.js";
import {
  COLUMN_BLOCKS_DOOR_RULE,
  DOOR_COLUMN_COLLISIONS_ANALYSIS,
  DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
} from "./door-column-collisions.js";
import {
  SITE_ANALYSIS,
  SITE_ANALYSIS_ID,
  SITE_AREA_RULE,
  SITE_ESCAPE_RULE,
  SITE_FRONTAGE_RULE,
} from "./site.js";
import {
  ESCALATOR_USUAL_SLOPE_RULE,
  RAMP_DECLARED_SLOPE_RULE,
  RUN_DISCONNECTED_RULE,
  STAIR_PROPORTION_RULE,
  VERTICAL_RUNS_ANALYSIS,
  VERTICAL_RUNS_ANALYSIS_ID,
} from "./vertical-runs.js";

export * from "./access.js";
export * from "./daylight.js";
export * from "./door-column-collisions.js";
export * from "./site.js";
export * from "./vertical-runs.js";

export const SCHEMATIC_RULE_SET_ID: RuleSetRef = freezeBuiltin({
  id: "koyu.ruleset.schematic-screen",
  revision: "1",
});

export const SCHEMATIC_PROFILE_ID: ProfileRef = freezeBuiltin({
  id: "koyu.profile.schematic-screen",
  revision: "1",
});

/**
 * The five analyses, in the order they are declared in the catalog.
 *
 * Each computes facts once and says nothing about pass or fail — no rule identity, no level,
 * no compliance summary. CLI, MCP and eval read these rather than recomputing a ratio,
 * an area tolerance, a frontage, a route or a slope of their own.
 */
export const SCHEMATIC_ANALYSES: readonly AnalysisDefinition<JsonValue>[] = freezeBuiltin([
  DAYLIGHT_ANALYSIS,
  VERTICAL_RUNS_ANALYSIS,
  ACCESS_ANALYSIS,
  DOOR_COLUMN_COLLISIONS_ANALYSIS,
  SITE_ANALYSIS,
] as unknown as AnalysisDefinition<JsonValue>[]);

export const SCHEMATIC_ANALYSIS_IDS: readonly AnalysisRef[] = freezeBuiltin([
  DAYLIGHT_ANALYSIS_ID,
  VERTICAL_RUNS_ANALYSIS_ID,
  ACCESS_ANALYSIS_ID,
  DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
  SITE_ANALYSIS_ID,
] as unknown as AnalysisRef[]);

/**
 * The fifteen rules, in the order of the legacy ledger.
 *
 * The one place the order is not a copy is the old `run.slope`, which splits in place into the
 * ramp rule and then the escalator rule: a declared limit and a customary band have different
 * grounds and have to be revisable one without the other.
 *
 * `koyu.schematic.envelope.gap` used to open the list and is gone. It said "this perimeter faces
 * nothing" — a state muro 1.4 cannot reach, because an unfaced perimeter is a wall (ADR-0065).
 * What is left of the question is that nobody said *which* outside the face looks at, and that is
 * a fact about a missing declaration rather than a judgement about a building, so it belongs to
 * `check` and is [[BND08]].
 */
export const SCHEMATIC_RULES: readonly Rule[] = freezeBuiltin([
  DAYLIGHT_RATIO_RULE,
  DAYLIGHT_UNKNOWN_RULE,
  STAIR_PROPORTION_RULE,
  RAMP_DECLARED_SLOPE_RULE,
  ESCALATOR_USUAL_SLOPE_RULE,
  RUN_DISCONNECTED_RULE,
  ACCESS_UNREACHABLE_RULE,
  ACCESS_VOIDONLY_RULE,
  ACCESS_THROUGHTENANT_RULE,
  ACCESS_PARKING_RULE,
  ACCESS_BACKOFHOUSE_RULE,
  COLUMN_BLOCKS_DOOR_RULE,
  SITE_ESCAPE_RULE,
  SITE_AREA_RULE,
  SITE_FRONTAGE_RULE,
]);

export const SCHEMATIC_RULE_SET: RuleSet = freezeBuiltin<RuleSet>({
  ...SCHEMATIC_RULE_SET_ID,
  title: "koyu schematic screen",
  purpose: "design-lint",
  rules: SCHEMATIC_RULES,
});

export const SCHEMATIC_PROFILE: Profile = freezeBuiltin<Profile>({
  ...SCHEMATIC_PROFILE_ID,
  title: "koyu schematic screen",
  analyses: SCHEMATIC_ANALYSIS_IDS,
  ruleSets: [SCHEMATIC_RULE_SET_ID],
});

/**
 * Build a local immutable registry holding the built-in pack.
 *
 * A factory rather than a shared singleton: the registry is the caller's value, and composing
 * an external pack alongside these must not be able to reach back into anyone else's catalog.
 */
export function createSchematicRegistry(): AssessmentRegistry {
  return createAssessmentRegistry({
    analyses: SCHEMATIC_ANALYSES,
    ruleSets: [SCHEMATIC_RULE_SET],
    profiles: [SCHEMATIC_PROFILE],
  });
}
