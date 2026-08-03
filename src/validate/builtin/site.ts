import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { codePointCompare } from "../../analysis/json.js";
import {
  canonicalSpaceOrder,
  displayName,
  isOutside,
  polygonAreaM2,
  regionOf,
  shapeEscapesPolygon,
  type Model,
  type SitePolygon,
  type Space,
  type Zone,
} from "../../core/model.js";
import { siteReport } from "../../core/site.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export const SITE_CONTAINMENT_TOLERANCE_MM = 1;
export const SITE_AREA_TOLERANCE_M2 = 0.05;
export const SITE_FRONTAGE_MIN_MM = 2000;

export const SITE_ESCAPE_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.site.escape",
  revision: "1",
} as const);

export const SITE_AREA_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.site.area",
  revision: "1",
} as const);

export const SITE_FRONTAGE_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.site.frontage",
  revision: "1",
} as const);

export type SitePointMm = {
  readonly x: number;
  readonly y: number;
};

export type SitePolygonObservation = {
  readonly siteRef: string;
  readonly declaredAreaM2: number | null;
  readonly rawAreaM2: number;
  readonly roundedAreaM2: number;
};

export type SiteRoadObservation = {
  readonly roadRef: string;
  readonly name: string;
  readonly widthMm: number;
  readonly frontageMm: number;
};

export type SiteMetricsObservation = {
  readonly siteName: string | null;
  readonly polygonVertexCount: number | null;
  readonly declaredAreaM2: number | null;
  readonly derivedAreaM2: number;
  readonly areaBasisM2: number;
  readonly footprintM2: number;
  readonly totalFloorM2: number;
  readonly coveragePercent: number | null;
  readonly floorAreaRatioPercent: number | null;
};

export type SiteSpaceRelationObservation = {
  readonly siteRef: string;
  readonly spaceRef: string;
  readonly firstNonContainedPointMm: SitePointMm | null;
};

export type SiteAnalysisValue = {
  readonly selectedSiteRef: string | null;
  readonly metrics: SiteMetricsObservation;
  readonly polygons: readonly SitePolygonObservation[];
  readonly roads: readonly SiteRoadObservation[];
  readonly spaceRelations: readonly SiteSpaceRelationObservation[];
};

export const SITE_ANALYSIS_ID: AnalysisRef<SiteAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.site",
  revision: "1",
});

export const SITE_ANALYSIS: AnalysisDefinition<SiteAnalysisValue> = freezeBuiltin<AnalysisDefinition<SiteAnalysisValue>>({
  ...SITE_ANALYSIS_ID,
  title: "Site observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<SiteAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const report = siteReport(coreModel);
    // The ratios and their rounding come from core, so the artifact, the CLI and the MCP
    // adapter cannot drift apart by each dividing on their own.
    const metrics: SiteMetricsObservation = {
      siteName: report.siteZone ? namedPath(report.siteZone) : null,
      polygonVertexCount: report.polygon?.points.length ?? null,
      declaredAreaM2: report.declaredArea ?? null,
      derivedAreaM2: report.derivedArea,
      areaBasisM2: report.areaBasis,
      footprintM2: report.footprint,
      totalFloorM2: report.totalFloor,
      coveragePercent: report.coveragePercent ?? null,
      floorAreaRatioPercent: report.floorAreaRatioPercent ?? null,
    };
    const polygons: SitePolygonObservation[] = [];
    const spaceRelations: SiteSpaceRelationObservation[] = [];
    const evidence: Evidence[] = [];
    const spaces = canonicalSpaceOrder(coreModel).filter((space) => space.rects.length > 0);

    for (const polygon of [...coreModel.polygons.values()].sort((a, b) => codePointCompare(a.path, b.path))) {
      const zone = coreModel.zones.get(polygon.path);
      if (!zone || zone.attrs["site"] !== 1) continue;

      const rawAreaM2 = polygonAreaM2(polygon.points as SitePolygon["points"]);
      const declared = zone.attrs["area"];
      const observation: SitePolygonObservation = {
        siteRef: polygon.path,
        declaredAreaM2: typeof declared === "number" ? declared : null,
        rawAreaM2,
        roundedAreaM2: Math.round(rawAreaM2 * 100) / 100,
      };
      polygons.push(observation);
      evidence.push(siteAreaEvidence(observation, zone, polygon));

      for (const space of spaces) {
        if (isOutside(space) || space.path.startsWith(`${polygon.path}/`)) continue;
        let firstNonContainedPointMm: SitePointMm | null = null;
        for (const shape of regionOf(space)) {
          const point = shapeEscapesPolygon(shape, polygon.points as SitePolygon["points"], SITE_CONTAINMENT_TOLERANCE_MM);
          if (point) {
            firstNonContainedPointMm = { x: point.x, y: point.y };
            break;
          }
        }
        const relation: SiteSpaceRelationObservation = {
          siteRef: polygon.path,
          spaceRef: space.path,
          firstNonContainedPointMm,
        };
        spaceRelations.push(relation);
        evidence.push(siteSpaceEvidence(relation, space, polygon));
      }
    }

    const roads = report.roads
      .map(({ road, width, frontage }): SiteRoadObservation => ({
        roadRef: road.path,
        name: displayName(road),
        widthMm: width,
        frontageMm: frontage,
      }))
      .sort((a, b) => codePointCompare(a.roadRef, b.roadRef));
    for (const road of roads) {
      evidence.push(roadEvidence(
        road,
        coreModel.spaces.get(road.roadRef)!,
        report.siteZone,
      ));
    }

    return {
      state: "complete",
      value: {
        selectedSiteRef: report.siteZone?.path ?? null,
        metrics,
        polygons,
        roads,
        spaceRelations,
      },
      evidence,
    };
  },
});

export const SITE_ESCAPE_RULE: Rule = freezeBuiltin<Rule>({
  ...SITE_ESCAPE_RULE_ID,
  title: "Site containment",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: SITE_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateSiteContainment(get(SITE_ANALYSIS_ID)),
});

export const SITE_AREA_RULE: Rule = freezeBuiltin<Rule>({
  ...SITE_AREA_RULE_ID,
  title: "Declared and polygon site area",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: SITE_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateSiteArea(get(SITE_ANALYSIS_ID)),
});

export const SITE_FRONTAGE_RULE: Rule = freezeBuiltin<Rule>({
  ...SITE_FRONTAGE_RULE_ID,
  title: "Site road frontage",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: SITE_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateSiteFrontage(get(SITE_ANALYSIS_ID)),
});

function evaluateSiteContainment(artifact: AnalysisArtifact<SiteAnalysisValue>): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  if (artifact.value.spaceRelations.length === 0) {
    return notApplicable("No regioned space and site-polygon pair is available");
  }

  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  return applicable(artifact.value.spaceRelations.map((relation): RuleOutcome => {
    const witness = relation.firstNonContainedPointMm;
    const failed = witness !== null;
    const evidence = requireEvidence(evidenceById, siteSpaceEvidenceId(relation.siteRef, relation.spaceRef));
    return {
      id: siteSpacePairId(relation.siteRef, relation.spaceRef),
      status: failed ? "fail" : "pass",
      subjects: [spaceSubject(relation.spaceRef)],
      message: failed
        ? `${relation.spaceRef} escapes the site shape (near ${witness.x},${witness.y})`
        : `${relation.spaceRef} is contained by ${relation.siteRef} within the ${SITE_CONTAINMENT_TOLERANCE_MM} mm geometry tolerance`,
      evidence: [evidence],
    };
  }));
}

function evaluateSiteArea(artifact: AnalysisArtifact<SiteAnalysisValue>): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  const population = artifact.value.polygons.filter(
    (polygon): polygon is SitePolygonObservation & { declaredAreaM2: number } => polygon.declaredAreaM2 !== null,
  );
  if (population.length === 0) return notApplicable("No site polygon has a declared area");

  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  return applicable(population.map((polygon): RuleOutcome => {
    const differenceM2 = Math.abs(polygon.declaredAreaM2 - polygon.rawAreaM2);
    const failed = differenceM2 >= SITE_AREA_TOLERANCE_M2;
    const source = requireEvidence(evidenceById, siteAreaEvidenceId(polygon.siteRef));
    return {
      id: polygon.siteRef,
      status: failed ? "fail" : "pass",
      subjects: [siteSubject(polygon.siteRef)],
      message: failed
        ? `Declared and derived site areas disagree: declared ${polygon.declaredAreaM2} m2 / derived ${polygon.roundedAreaM2.toFixed(2)} m2 (${polygon.siteRef})`
        : `${polygon.siteRef} declared and polygon areas differ by less than ${SITE_AREA_TOLERANCE_M2} m2`,
      evidence: [{
        id: "area-difference",
        kind: "comparison",
        observed: { value: differenceM2, unit: "m2" },
        operator: "<",
        required: { value: SITE_AREA_TOLERANCE_M2, unit: "m2" },
        subjects: [siteSubject(polygon.siteRef)],
        sources: source.sources,
        producedBy: SITE_AREA_RULE_ID,
      }],
    };
  }));
}

function evaluateSiteFrontage(artifact: AnalysisArtifact<SiteAnalysisValue>): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  if (artifact.value.selectedSiteRef === null) return notApplicable("No site zone is selected");
  if (artifact.value.roads.length === 0) return notApplicable("No exterior road space is available");

  const siteRef = artifact.value.selectedSiteRef;
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  return applicable(artifact.value.roads.map((road): RuleOutcome => {
    const failed = road.frontageMm < SITE_FRONTAGE_MIN_MM;
    const source = requireEvidence(evidenceById, roadEvidenceId(road.roadRef));
    return {
      id: road.roadRef,
      status: failed ? "fail" : "pass",
      subjects: [spaceSubject(road.roadRef)],
      message: failed
        ? `Road frontage is ${road.frontageMm}mm, under the ${SITE_FRONTAGE_MIN_MM}mm this pack screens for: ${road.roadRef} (widen the frontage onto the road)`
        : `${road.roadRef} has ${road.frontageMm}mm of frontage, at or above the ${SITE_FRONTAGE_MIN_MM}mm minimum`,
      evidence: [{
        id: "frontage-minimum",
        kind: "comparison",
        observed: { value: road.frontageMm, unit: "mm" },
        operator: ">=",
        required: { value: SITE_FRONTAGE_MIN_MM, unit: "mm" },
        subjects: [spaceSubject(road.roadRef), siteSubject(siteRef)],
        sources: source.sources,
        producedBy: SITE_FRONTAGE_RULE_ID,
      }],
    };
  }));
}

function siteAreaEvidence(
  observation: SitePolygonObservation,
  zone: Zone,
  polygon: SitePolygon,
): Evidence {
  const subject = siteSubject(observation.siteRef);
  return {
    id: siteAreaEvidenceId(observation.siteRef),
    kind: "fact",
    name: "siteAreaMeasurements",
    value: observation,
    subjects: [subject],
    sources: [modelSource(subject, zone), modelSource(subject, polygon)],
    producedBy: SITE_ANALYSIS_ID,
  };
}

function siteSpaceEvidence(
  observation: SiteSpaceRelationObservation,
  space: Space,
  polygon: SitePolygon,
): Evidence {
  const spaceRef = spaceSubject(observation.spaceRef);
  const siteRef = siteSubject(observation.siteRef);
  return {
    id: siteSpaceEvidenceId(observation.siteRef, observation.spaceRef),
    kind: "geometry",
    geometry: {
      siteRef: observation.siteRef,
      spaceRef: observation.spaceRef,
      toleranceMm: SITE_CONTAINMENT_TOLERANCE_MM,
      firstNonContainedPointMm: observation.firstNonContainedPointMm,
    },
    subjects: [spaceRef, siteRef],
    sources: [modelSource(spaceRef, space), modelSource(siteRef, polygon)],
    producedBy: SITE_ANALYSIS_ID,
  };
}

function roadEvidence(
  observation: SiteRoadObservation,
  road: Space,
  site: Zone | undefined,
): Evidence {
  const roadRef = spaceSubject(observation.roadRef);
  if (site) {
    const siteRef = siteSubject(site.path);
    return {
      id: roadEvidenceId(observation.roadRef),
      kind: "fact",
      name: "roadFrontageMeasurement",
      value: observation,
      subjects: [roadRef, siteRef],
      sources: [modelSource(roadRef, road), modelSource(siteRef, site)],
      producedBy: SITE_ANALYSIS_ID,
    };
  }
  return {
    id: roadEvidenceId(observation.roadRef),
    kind: "fact",
    name: "roadFrontageMeasurement",
    value: observation,
    subjects: [roadRef],
    sources: [modelSource(roadRef, road)],
    producedBy: SITE_ANALYSIS_ID,
  };
}

function applicable(outcomes: RuleOutcome[]): RuleEvaluation {
  if (outcomes.length === 0) throw new Error("applicable evaluation requires an outcome");
  return {
    applicability: "applicable",
    outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]],
  };
}

function notApplicable(reason: string): RuleEvaluation {
  return { applicability: "not-applicable", reason, evidence: [] };
}

function analysisIndeterminate(
  artifact: Exclude<AnalysisArtifact<SiteAnalysisValue>, { state: "complete" }>,
): RuleEvaluation {
  return {
    applicability: "indeterminate",
    reason: "Site observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
}

function requireEvidence(evidence: ReadonlyMap<string, Evidence>, id: string): Evidence {
  const item = evidence.get(id);
  if (!item) throw new Error(`missing site evidence: ${id}`);
  return item;
}

function modelSource(
  subject: SubjectRef,
  source: { readonly line: number; readonly file?: string },
): SourceRef {
  return {
    kind: "model",
    subject,
    location: {
      ...(source.file !== undefined ? { file: source.file } : {}),
      line: source.line,
    },
  };
}

function siteSubject(ref: string): SubjectRef {
  return { kind: "site", ref };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function siteAreaEvidenceId(siteRef: string): string {
  return `site-area:${siteRef}`;
}

function siteSpaceEvidenceId(siteRef: string, spaceRef: string): string {
  return siteSpacePairId(siteRef, spaceRef);
}

function roadEvidenceId(roadRef: string): string {
  return `site-road:${roadRef}`;
}

function siteSpacePairId(siteRef: string, spaceRef: string): string {
  return JSON.stringify(["site-space", siteRef, spaceRef]);
}

function namedPath(value: { readonly path: string; readonly attrs: Readonly<Record<string, unknown>> }): string {
  const name = value.attrs["name"];
  return typeof name === "string" ? name : (value.path.split("/").pop() ?? value.path);
}
