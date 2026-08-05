import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as diagnostics from "../src/diagnostics.js";
import * as diff from "../src/diff.js";
import * as form from "../src/form.js";
import * as graph from "../src/graph.js";
import * as model from "../src/model.js";
import * as vocabulary from "../src/vocabulary.js";

const root = fileURLToPath(new URL("..", import.meta.url));

interface SurfaceCase {
  path: string;
  runtime: Record<string, unknown>;
  values: string[];
  types: string[];
  forbidden: string[];
}

const cases: SurfaceCase[] = [
  {
    path: "src/model.ts",
    runtime: model,
    values: [
      "areaM2",
      "DEFAULT_LANGUAGE_VERSION",
      "displayName",
      "effectiveUse",
      "heff",
      "isCoveredAbove",
      "isIndoor",
      "isOutside",
      "isSemiOutdoor",
      "isVoid",
      "levelsSorted",
      "newUids",
      "SUPPORTED_LANGUAGE_VERSIONS",
      "toCanonical",
      "zoneAreaM2",
    ],
    types: [
      "Area",
      "Asset",
      "Attrs",
      "AttrValue",
      "Azimuth",
      "Boundary",
      "BoundaryKind",
      "Column",
      "ColumnDecl",
      "DrawnLine",
      "Edge",
      "GridAxis",
      "GridRef",
      "Level",
      "Model",
      "Opening",
      "Pt",
      "Rect",
      "Seg",
      "SiteOrigin",
      "SitePolygon",
      "Space",
      "Zone",
    ],
    forbidden: [
      "canonicalBoundaryOrder",
      "columnsFor",
      "pointInPolygon",
      "polyBounds",
      "polygonAreaM2",
      "rectToPoly",
      "srcRef",
      "unionAreaM2",
    ],
  },
  {
    path: "src/diagnostics.ts",
    runtime: diagnostics,
    values: ["checkDiagnostics", "DIAGNOSTIC_CODES"],
    types: ["Diagnostic", "DiagnosticCode"],
    forbidden: ["check", "CheckResult"],
  },
  {
    path: "src/graph.ts",
    runtime: graph,
    values: ["doorsBetween", "envelopeGaps", "neighbors", "passable", "segmentsFor"],
    types: ["NeighborInfo", "Route", "Segment"],
    forbidden: [
      "deriveDefaultBoundaries",
      "placeBand",
      "placeOpening",
      "Band",
      "BandCode",
      "BandError",
      "PlacedBand",
    ],
  },
  {
    path: "src/form.ts",
    runtime: form,
    values: [
      "band",
      "bandLine",
      "columnRect",
      "derive",
      "DERIVATION_CONSTANTS",
      "runPrism",
      "thicken",
      "TOLERANCES",
    ],
    types: [
      "DeriveOptions",
      "Form",
      "FormPrism",
      "FormBoundary",
      "FormColumn",
      "FormInput",
      "FormLevel",
      "FormOpening",
      "FormPanel",
      "FormPlan",
      "FormRun",
      "FormSeg",
      "FormSite",
      "FormSpace",
      "FormSwing",
      "PlanClass",
      "PlanEntity",
      "PlanRole",
      "PlanSubject",
      "RunDevice",
      "RunForm",
      "RunPart",
      "RunSolid",
      "Seg2",
      "Slab",
      "SlabKind",
      "VerticalRun",
    ],
    forbidden: [
      "columnsFor",
      "levelPitch",
      "slabs",
      "RUN_KEYS",
      "runDecls",
      "runDrawsForLevel",
      "runSolids",
      "slopeText",
      "verticalRuns",
      "RunArrow",
      "RunDecl",
      "RunDraw",
    ],
  },
  {
    path: "src/diff.ts",
    runtime: diff,
    values: ["semanticDiff"],
    types: [
      "BoundaryChange",
      "BoundaryItem",
      "ChangedItem",
      "ColumnItem",
      "FieldChange",
      "GridChange",
      "ModelDiff",
      "RenamedItem",
      "SpaceItem",
    ],
    forbidden: ["renderDiff"],
  },
  {
    path: "src/vocabulary.ts",
    runtime: vocabulary,
    values: ["ATTR_LEDGER", "attrSpec", "isNamespaced"],
    types: ["AttrSpec", "AttrTier"],
    forbidden: ["ASSET_ELEM", "CARRY_NAMESPACE", "known"],
  },
];

function declaredSurface(path: string): { values: string[]; types: string[]; source: string } {
  const source = readFileSync(join(root, path), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  const values: string[] = [];
  const types: string[] = [];

  for (const match of code.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*"[^"]+"/g)) {
    const allTypes = match[1] !== undefined;
    for (const raw of match[2]!.split(",")) {
      const entry = raw.trim();
      if (entry === "") continue;
      const isType = allTypes || entry.startsWith("type ");
      const name = entry.replace(/^type\s+/, "").trim();
      (isType ? types : values).push(name);
    }
  }

  return { values, types, source: code };
}

for (const entry of cases) {
  test(`${entry.path}: the facade is explicit and declares each name once`, () => {
    const declared = declaredSurface(entry.path);
    assert.equal(/export\s+\*/.test(declared.source), false, "public facades must not use export *");
    const all = [...declared.values, ...declared.types];
    const duplicates = all.filter((name, index) => all.indexOf(name) !== index);
    assert.deepEqual(duplicates, [], `duplicate exports: ${duplicates.join(", ")}`);
  });

  test(`${entry.path}: the declared contract is the approved contract`, () => {
    const declared = declaredSurface(entry.path);
    assert.deepEqual([...declared.values].sort(), [...entry.values].sort());
    assert.deepEqual([...declared.types].sort(), [...entry.types].sort());
  });

  test(`${entry.path}: declared runtime values equal actual runtime values`, () => {
    const declared = declaredSurface(entry.path);
    assert.deepEqual([...declared.values].sort(), Object.keys(entry.runtime).sort());
  });

  test(`${entry.path}: removal candidates do not leak through the facade`, () => {
    const declared = declaredSurface(entry.path);
    const all = new Set([...declared.values, ...declared.types]);
    assert.deepEqual(entry.forbidden.filter((name) => all.has(name)), []);
    assert.deepEqual(entry.forbidden.filter((name) => name in entry.runtime), []);
  });
}
