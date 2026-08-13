import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { passable } from "../../core/graph.js";
import {
  canonicalSpaceOrder,
  effectiveAttr,
  isOutside,
  isVoid,
  type Boundary,
  type Model,
  type Space,
} from "../../core/model.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export const CAR_WIDTH_MIN = 2400;

export type AccessRouteObservation = {
  readonly ref: string;
  readonly reachable: boolean;
  readonly path: readonly string[];
};

export type PassableNeighbourObservation = {
  readonly ref: string;
  readonly exists: boolean;
  readonly declaresVoid: boolean;
};

export type PassableNeighbourhoodObservation = {
  readonly ref: string;
  readonly neighbours: readonly PassableNeighbourObservation[];
};

export type AccessAnalysisValue = {
  readonly exteriorRefs: readonly string[];
  readonly commonCorridorRefs: readonly string[];
  readonly personExteriorRoutes: readonly AccessRouteObservation[];
  readonly passableNeighbourhoods: readonly PassableNeighbourhoodObservation[];
  readonly rentableAvoidingExteriorRoutes: readonly AccessRouteObservation[];
  readonly vehicleExteriorRoutes: readonly AccessRouteObservation[];
  readonly vehicleDoorMinimumMm: number;
  readonly commonCorridorHorizontalRoutes: readonly AccessRouteObservation[];
};

export const ACCESS_ANALYSIS_ID: AnalysisRef<AccessAnalysisValue> = Object.freeze({
  id: "koyu.analysis.access",
  revision: "1",
});

export const ACCESS_UNREACHABLE_RULE_ID = Object.freeze({
  id: "koyu.schematic.access.unreachable",
  revision: "1",
} as const);

export const ACCESS_VOIDONLY_RULE_ID = Object.freeze({
  id: "koyu.schematic.access.voidonly",
  revision: "1",
} as const);

export const ACCESS_THROUGHTENANT_RULE_ID = Object.freeze({
  id: "koyu.schematic.access.throughtenant",
  revision: "1",
} as const);

export const ACCESS_PARKING_RULE_ID = Object.freeze({
  id: "koyu.schematic.access.parking",
  revision: "1",
} as const);

export const ACCESS_BACKOFHOUSE_RULE_ID = Object.freeze({
  id: "koyu.schematic.access.backofhouse",
  revision: "1",
} as const);

const PERSON_EXTERIOR_PROFILE = "person-exterior-without-space-filter";
const RENTABLE_AVOIDING_PROFILE = "person-exterior-without-rentable-intermediates";
const VEHICLE_EXTERIOR_PROFILE = "vehicle-exterior-open-wide-door-or-ramp";
const COMMON_HORIZONTAL_PROFILE = "common-corridor-horizontal-entry-without-backyard";

export const ACCESS_ANALYSIS: AnalysisDefinition<AccessAnalysisValue> = freezeBuiltin<AnalysisDefinition<AccessAnalysisValue>>({
  ...ACCESS_ANALYSIS_ID,
  title: "Access route observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<AccessAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const spaces = canonicalSpaceOrder(coreModel);
    const exteriorRefs = spaces.filter(isOutside).map((space) => space.path);
    const exterior = new Set(exteriorRefs);
    const personAdjacency = buildAdjacency(coreModel, passable);
    const exteriorRoutes = routesToTargets(personAdjacency, exteriorRefs);
    const commonCorridorRefs = spaces
      .filter((space) =>
        space.type === "corridor"
        && space.rects.length > 0
        && leaseCategory(coreModel, space) === "common"
      )
      .map((space) => space.path);

    // This query deliberately does not filter void/shaft intermediate spaces. It preserves the
    // legacy reachableFromExterior component semantics rather than the other four route profiles.
    const personExteriorRoutes = spaces
      .filter(baseAccessPopulation)
      .map((space) => routeObservation(space.path, exteriorRoutes.get(space.path) ?? null));

    const passableNeighbourhoods = spaces
      .filter(baseAccessPopulation)
      .map((space): PassableNeighbourhoodObservation => ({
        ref: space.path,
        neighbours: passableNeighbours(coreModel, personAdjacency.get(space.path) ?? []),
      }))
      .filter((observation) => observation.neighbours.length > 0);

    const rentableAvoidingExteriorRoutes = spaces
      .filter((space) => space.type === "stair" && space.rects.length > 0)
      .map((space) => routeObservation(
        space.path,
        findRoute(coreModel, [space.path], exterior, {
          avoid: (candidate) => leaseCategory(coreModel, candidate) === "rentable",
        }),
      ));

    const vehicleCanPass = carPassable(coreModel);
    const vehicleExteriorRoutes = spaces
      .filter((space) => baseAccessPopulation(space) && isVehicleSpace(space))
      .map((space) => routeObservation(
        space.path,
        findRoute(coreModel, [space.path], exterior, { canPass: vehicleCanPass }),
      ));

    const commonCorridorHorizontalRoutes = spaces
      .filter((space) =>
        space.rects.length > 0
        && space.type !== "shaft"
        && (space.attrs["stair"] != null || space.attrs["escalator"] != null)
        && leaseCategory(coreModel, space) === "common"
      )
      .map((space) => {
        const horizontalEntry = (boundary: Boundary): boolean =>
          passable(boundary)
          && !(boundary.kind === "stair" && (boundary.a === space.path || boundary.b === space.path));
        return routeObservation(
          space.path,
          findRoute(coreModel, commonCorridorRefs, new Set([space.path]), {
            avoid: (candidate) => candidate.type === "backyard",
            canPass: horizontalEntry,
          }),
        );
      });

    const value: AccessAnalysisValue = {
      exteriorRefs,
      commonCorridorRefs,
      personExteriorRoutes,
      passableNeighbourhoods,
      rentableAvoidingExteriorRoutes,
      vehicleExteriorRoutes,
      vehicleDoorMinimumMm: CAR_WIDTH_MIN,
      commonCorridorHorizontalRoutes,
    };

    const evidence: Evidence[] = [
      ...personExteriorRoutes.map((route) => routeEvidence("person-exterior", PERSON_EXTERIOR_PROFILE, route, coreModel)),
      ...passableNeighbourhoods.map((observation) => neighbourhoodEvidence(observation, coreModel)),
      ...rentableAvoidingExteriorRoutes.map((route) =>
        routeEvidence("rentable-avoiding-exterior", RENTABLE_AVOIDING_PROFILE, route, coreModel)
      ),
      ...vehicleExteriorRoutes.flatMap((route) => [
        routeEvidence("vehicle-exterior", VEHICLE_EXTERIOR_PROFILE, route, coreModel),
        vehicleProfileEvidence(route.ref, coreModel),
      ]),
      ...commonCorridorHorizontalRoutes.map((route) =>
        routeEvidence("common-horizontal-entry", COMMON_HORIZONTAL_PROFILE, route, coreModel)
      ),
    ];

    return { state: "complete", value, evidence };
  },
});

export const ACCESS_UNREACHABLE_RULE: Rule = freezeBuiltin<Rule>({
  ...ACCESS_UNREACHABLE_RULE_ID,
  title: "Exterior reachability",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: ACCESS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ACCESS_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    if (artifact.value.exteriorRefs.length === 0) return notApplicable("No exterior space is declared");
    if (artifact.value.personExteriorRoutes.length === 0) {
      return notApplicable("No regioned non-exterior space belongs to the person-route population");
    }
    return routeOutcomes(
      artifact,
      artifact.value.personExteriorRoutes,
      "person-exterior",
      (ref) => `Cannot reach the exterior: ${ref} (no passable boundary leads out — write a door)`,
      (ref) => `${ref} has a person-passable route to the exterior`,
    );
  },
});

export const ACCESS_VOIDONLY_RULE: Rule = freezeBuiltin<Rule>({
  ...ACCESS_VOIDONLY_RULE_ID,
  title: "Passable-neighbour floor",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: ACCESS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ACCESS_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    const population = artifact.value.passableNeighbourhoods;
    if (population.length === 0) return notApplicable("No eligible space has an incident passable boundary");
    const evidenceById = evidenceMap(artifact);
    return applicable(population.map((observation): RuleOutcome => {
      const onlyDeclaredVoids = observation.neighbours.every(
        (neighbour) => neighbour.exists && neighbour.declaresVoid,
      );
      return {
        id: observation.ref,
        status: onlyDeclaredVoids ? "fail" : "pass",
        subjects: [spaceSubject(observation.ref)],
        message: onlyDeclaredVoids
          ? `Doors open only onto a void: ${observation.ref} (they open where there is no floor, so nobody can pass)`
          : `${observation.ref} has an incident passable boundary that is not limited to a declared void`,
        evidence: [requiredEvidence(evidenceById, neighbourhoodEvidenceId(observation.ref))],
      };
    }));
  },
});

export const ACCESS_THROUGHTENANT_RULE: Rule = freezeBuiltin<Rule>({
  ...ACCESS_THROUGHTENANT_RULE_ID,
  title: "Rentable-space-avoiding stair egress",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: ACCESS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ACCESS_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    if (artifact.value.exteriorRefs.length === 0) return notApplicable("No exterior space is declared");
    if (artifact.value.rentableAvoidingExteriorRoutes.length === 0) {
      return notApplicable("No regioned space has the free type stair");
    }
    return routeOutcomes(
      artifact,
      artifact.value.rentableAvoidingExteriorRoutes,
      "rentable-avoiding-exterior",
      (ref) => `Escape from ${ref} passes through rentable space (if the tenant locks up, there is no way out)`,
      (ref) => `${ref} has a route to the exterior that avoids rentable intermediate spaces`,
    );
  },
});

export const ACCESS_PARKING_RULE: Rule = freezeBuiltin<Rule>({
  ...ACCESS_PARKING_RULE_ID,
  title: "Vehicle exterior route",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: ACCESS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ACCESS_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    if (artifact.value.exteriorRefs.length === 0) return notApplicable("No exterior space is declared");
    if (artifact.value.vehicleExteriorRoutes.length === 0) {
      return notApplicable("No regioned eligible space is typed parking or ramp");
    }
    const evidenceById = evidenceMap(artifact);
    return applicable(artifact.value.vehicleExteriorRoutes.map((route): RuleOutcome => ({
      id: route.ref,
      status: route.reachable ? "pass" : "fail",
      subjects: [spaceSubject(route.ref)],
      message: route.reachable
        ? `${route.ref} has a vehicle-passable route to the exterior`
        : `No vehicle route to the exterior: ${route.ref} (needs an opening at least ${artifact.value.vehicleDoorMinimumMm}mm wide, a type:open boundary, or a ramp)`,
      evidence: [
        requiredEvidence(evidenceById, routeEvidenceId("vehicle-exterior", route.ref)),
        requiredEvidence(evidenceById, vehicleProfileEvidenceId(route.ref)),
      ],
    })));
  },
});

export const ACCESS_BACKOFHOUSE_RULE: Rule = freezeBuiltin<Rule>({
  ...ACCESS_BACKOFHOUSE_RULE_ID,
  title: "Common-corridor horizontal access to vertical circulation",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: ACCESS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ACCESS_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    if (artifact.value.commonCorridorRefs.length === 0) {
      return notApplicable("No regioned common corridor is declared");
    }
    if (artifact.value.commonCorridorHorizontalRoutes.length === 0) {
      return notApplicable("No regioned common space carries stair or escalator");
    }
    return routeOutcomes(
      artifact,
      artifact.value.commonCorridorHorizontalRoutes,
      "common-horizontal-entry",
      (ref) => `${ref} cannot be reached from a common corridor without passing through back-of-house (visitors cannot use this vertical circulation)`,
      (ref) => `${ref} has a horizontal-entry route from a common corridor that avoids back-of-house`,
    );
  },
});

type CanPass = (boundary: Boundary) => boolean;

type Adjacency = ReadonlyMap<string, readonly string[]>;

type RouteOptions = {
  readonly avoid?: (space: Space) => boolean;
  readonly canPass?: CanPass;
  readonly blockImpassable?: boolean;
};

function findRoute(
  model: Model,
  from: readonly string[],
  targets: ReadonlySet<string>,
  options: RouteOptions = {},
): string[] | null {
  const avoid = options.avoid ?? (() => false);
  const canPass = options.canPass ?? passable;
  const blockImpassable = options.blockImpassable ?? true;
  const seen = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [];

  for (const origin of [...from].sort(compareText)) {
    if (targets.has(origin)) return [origin];
    if (!model.spaces.has(origin) || seen.has(origin)) continue;
    seen.add(origin);
    parent.set(origin, null);
    queue.push(origin);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacentRefs(model, current, canPass)) {
      if (seen.has(next)) continue;
      if (targets.has(next)) {
        parent.set(next, current);
        return reconstructPath(parent, next);
      }
      const space = model.spaces.get(next);
      if (!space || (blockImpassable && impassable(space)) || avoid(space)) continue;
      seen.add(next);
      parent.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

/**
 * Build the undirected person-passable graph in one boundary scan. The exterior query has a
 * potentially building-sized population, so running one boundary scan per room is not viable.
 */
function buildAdjacency(model: Model, canPass: CanPass): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const add = (from: string, to: string): void => {
    const neighbours = adjacency.get(from) ?? [];
    neighbours.push(to);
    adjacency.set(from, neighbours);
  };
  for (const boundary of model.boundaries) {
    if (!canPass(boundary)) continue;
    add(boundary.a, boundary.b);
    add(boundary.b, boundary.a);
  }
  for (const neighbours of adjacency.values()) neighbours.sort(compareText);
  return adjacency;
}

/**
 * Expand all exterior components once and retain one deterministic shortest route back to an
 * exterior. No space-kind filter is applied: this is the intentional reachableFromExterior quirk.
 */
function routesToTargets(adjacency: Adjacency, targets: readonly string[]): Map<string, string[]> {
  const next = new Map<string, string | null>();
  const queue: string[] = [];
  for (const target of [...new Set(targets)].sort(compareText)) {
    next.set(target, null);
    queue.push(target);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbour of adjacency.get(current) ?? []) {
      if (next.has(neighbour)) continue;
      next.set(neighbour, current);
      queue.push(neighbour);
    }
  }

  const routes = new Map<string, string[]>();
  for (const ref of next.keys()) {
    const route = [ref];
    let current = ref;
    while (true) {
      const following = next.get(current);
      if (following == null) break;
      route.push(following);
      current = following;
    }
    routes.set(ref, route);
  }
  return routes;
}

function adjacentRefs(model: Model, ref: string, canPass: CanPass): string[] {
  const adjacent: string[] = [];
  for (const boundary of model.boundaries) {
    if (!canPass(boundary)) continue;
    const other = boundary.a === ref ? boundary.b : boundary.b === ref ? boundary.a : undefined;
    if (other !== undefined) adjacent.push(other);
  }
  adjacent.sort(compareText);
  return adjacent;
}

function reconstructPath(parent: ReadonlyMap<string, string | null>, target: string): string[] {
  const reversed = [target];
  let current = target;
  while (true) {
    const previous = parent.get(current);
    if (previous === null || previous === undefined) break;
    reversed.push(previous);
    current = previous;
  }
  return reversed.reverse();
}

function passableNeighbours(
  model: Model,
  adjacent: readonly string[],
): PassableNeighbourObservation[] {
  return adjacent.map((otherRef): PassableNeighbourObservation => {
    const other = model.spaces.get(otherRef);
    return {
      ref: otherRef,
      exists: other !== undefined,
      declaresVoid: other !== undefined && isVoid(other),
    };
  });
}

function carPassable(model: Model): CanPass {
  return (boundary) => {
    if (boundary.kind === "open") return true;
    if (boundary.kind === "shaft" || boundary.kind === "void") return false;
    if (boundary.kind === "stair") {
      return model.spaces.get(boundary.a)?.attrs["ramp"] != null
        || model.spaces.get(boundary.b)?.attrs["ramp"] != null;
    }
    return boundary.openings.some((opening) => opening.kind === "door" && opening.w >= CAR_WIDTH_MIN);
  };
}

/**
 * The lease division a space falls in, as this rule pack reads it.
 *
 * `lease.category` is a carried namespaced key, so core gives it no meaning and nothing guards
 * its spelling: write `lease.categry:common` and the rules below quietly stop applying to that
 * space. That is the same exposure the free type words already carry here, and it is a
 * consequence of judgement living on the face that does not freeze rather than in the language.
 *
 * It resolves through the zones above a space, so writing it once on a tenancy zone reaches
 * every room beneath.
 */
function leaseCategory(model: Model, space: Space): string | undefined {
  const v = effectiveAttr(model, space, "lease.category");
  return typeof v === "string" ? v : undefined;
}

/**
 * Whether cars belong in this space.
 *
 * This is the room's purpose, so it is read from the type position rather than from a key.
 * On the bundled examples it selects exactly the spaces the retired `use:parking` selected.
 */
function isVehicleSpace(space: Space): boolean {
  return space.type === "parking" || space.type === "ramp";
}

function baseAccessPopulation(space: Space): boolean {
  return space.rects.length > 0 && !isOutside(space) && !impassable(space);
}

function impassable(space: Space): boolean {
  return isVoid(space) || space.type === "shaft";
}

function routeObservation(ref: string, path: readonly string[] | null): AccessRouteObservation {
  return { ref, reachable: path !== null, path: path ?? [] };
}

function routeOutcomes(
  artifact: Extract<AnalysisArtifact<AccessAnalysisValue>, { state: "complete" }>,
  routes: readonly AccessRouteObservation[],
  evidencePrefix: string,
  failureMessage: (ref: string) => string,
  successMessage: (ref: string) => string,
): RuleEvaluation {
  const evidenceById = evidenceMap(artifact);
  return applicable(routes.map((route): RuleOutcome => ({
    id: route.ref,
    status: route.reachable ? "pass" : "fail",
    subjects: [spaceSubject(route.ref)],
    message: route.reachable ? successMessage(route.ref) : failureMessage(route.ref),
    evidence: [requiredEvidence(evidenceById, routeEvidenceId(evidencePrefix, route.ref))],
  })));
}

function applicable(outcomes: RuleOutcome[]): RuleEvaluation {
  if (outcomes.length === 0) throw new Error("applicable evaluation requires an outcome");
  return { applicability: "applicable", outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]] };
}

function notApplicable(reason: string): RuleEvaluation {
  return { applicability: "not-applicable", reason, evidence: [] };
}

function analysisIndeterminate(
  artifact: Exclude<AnalysisArtifact<AccessAnalysisValue>, { state: "complete" }>,
): RuleEvaluation {
  return {
    applicability: "indeterminate",
    reason: "Access observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
}

function evidenceMap(
  artifact: Extract<AnalysisArtifact<AccessAnalysisValue>, { state: "complete" }>,
): Map<string, Evidence> {
  return new Map(artifact.evidence.map((evidence) => [evidence.id, evidence]));
}

function requiredEvidence(evidence: ReadonlyMap<string, Evidence>, id: string): Evidence {
  const item = evidence.get(id);
  if (!item) throw new Error(`missing access evidence: ${id}`);
  return item;
}

function routeEvidence(
  prefix: string,
  profile: string,
  route: AccessRouteObservation,
  model: Model,
): Evidence {
  const subject = spaceSubject(route.ref);
  return {
    id: routeEvidenceId(prefix, route.ref),
    kind: "route",
    reachable: route.reachable,
    profile,
    path: route.path,
    subjects: [subject],
    sources: routeSources(model, route),
    producedBy: ACCESS_ANALYSIS_ID,
  };
}

function neighbourhoodEvidence(
  observation: PassableNeighbourhoodObservation,
  model: Model,
): Evidence {
  const subject = spaceSubject(observation.ref);
  return {
    id: neighbourhoodEvidenceId(observation.ref),
    kind: "fact",
    name: "incidentPassableNeighbours",
    value: observation.neighbours,
    subjects: [subject],
    sources: modelSources(model, [observation.ref, ...observation.neighbours.map((item) => item.ref)]),
    producedBy: ACCESS_ANALYSIS_ID,
  };
}

function vehicleProfileEvidence(ref: string, model: Model): Evidence {
  const subject = spaceSubject(ref);
  return {
    id: vehicleProfileEvidenceId(ref),
    kind: "fact",
    name: "vehicleTraversalProfile",
    value: {
      doorMinimumMm: CAR_WIDTH_MIN,
      openBoundary: true,
      rampDeclaredVerticalLink: true,
    },
    subjects: [subject],
    sources: [modelSource(model, ref)],
    producedBy: ACCESS_ANALYSIS_ID,
  };
}

function routeSources(
  model: Model,
  route: AccessRouteObservation,
): [SourceRef, ...SourceRef[]] {
  return modelSources(model, route.path.length > 0 ? route.path : [route.ref]);
}

function modelSources(model: Model, refs: readonly string[]): [SourceRef, ...SourceRef[]] {
  const unique = [...new Set(refs)];
  if (unique.length === 0) throw new Error("access evidence requires a model source");
  return unique.map((ref) => modelSource(model, ref)) as [SourceRef, ...SourceRef[]];
}

function modelSource(model: Model, ref: string): SourceRef {
  const subject = spaceSubject(ref);
  const source = model.spaces.get(ref);
  return {
    kind: "model",
    subject,
    ...(source
      ? {
          location: {
            ...(source.file !== undefined ? { file: source.file } : {}),
            line: source.line,
          },
        }
      : {}),
  };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function routeEvidenceId(prefix: string, ref: string): string {
  return `${prefix}:${ref}`;
}

function neighbourhoodEvidenceId(ref: string): string {
  return `passable-neighbours:${ref}`;
}

function vehicleProfileEvidenceId(ref: string): string {
  return `vehicle-profile:${ref}`;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
