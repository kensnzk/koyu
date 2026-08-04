# Built-in assessment implementation adversarial review

- Date: 2026-08-03
- Scope: the five non-daylight analyses and fourteen schematic Rules implemented before the pending daylight decision
- Status: reviewed and corrected; daylight, the combined catalog, and transport integration are not covered here

## Reviewed components

| Analysis | Rules |
|---|---|
| `koyu.analysis.envelope@1` | `koyu.schematic.envelope.gap@1` |
| `koyu.analysis.vertical-runs@1` | stair proportion, ramp declared slope, escalator usual slope, run disconnected |
| `koyu.analysis.access@1` | unreachable, void-only, through-tenant, parking, back-of-house |
| `koyu.analysis.door-column-collisions@1` | column blocks door |
| `koyu.analysis.site@1` | site escape, site area, site frontage |

The review compared the new implementation with the legacy validators, the generic protocol acceptance suite, ADR-0055's parity conditions, and the current CLI/MCP consumers that must later move to the shared analyses.

## Findings reproduced and corrected

### Captured built-in values were mutable

The original implementation exported plain Rule, analysis, identity, and threshold objects. TypeScript `readonly` and `as const` did not protect runtime values. Mutating the exported stair band after registry creation changed a later result, and mutating an analysis identity could redirect a Rule's captured reference.

All built-in component values now pass through one trusted recursive freezer in `src/validate/builtin/freeze.ts`. Tests walk the object graph with `Reflect.ownKeys`, assert every data object and function is frozen, attempt a real threshold mutation, and rerun the Rule.

### Vertical outcomes lost analysis provenance

The provider emitted a `vertical-run:<ref>` fact with the declaration location, but the Rules originally replaced it with comparison evidence whose model source had no file or line. The disconnected Rule also created a second analysis-labelled fact instead of using the provider result.

Every vertical outcome now retains the matching provider evidence. Dimensional Rules add their machine-readable comparison after that fact; disconnected reuses the fact directly. The parity oracle compares the resulting source line/file with the legacy Finding.

### Site analysis was not a complete shared site question

The first artifact only exposed polygons, roads, and containment pairs. That would have forced CLI, MCP, and eval to keep independently reading or recomputing selected site area, footprint, total floor, coverage, FAR, names, and polygon vertex count.

The site artifact now includes the shared neutral metrics and their actual rounding. The `areaMatch` decision remains absent: the 0.05 m2 comparison belongs only to `koyu.schematic.site.area`. A test compares every shared metric with the current `siteReport` output and confirms that the verdict field is not present.

### Evidence identities were not injective

Two legal edge-restricted boundaries between the same spaces could each carry a door, but the original door identity omitted the canonical boundary index. Both doors then emitted the same evidence ID and the generic protocol correctly changed the provider result to `unavailable`.

Door identities now use the same canonical boundary/opening index structure as Form: `<a>|<b>@<boundary-index>/<opening-index>`. A two-boundary fixture proves two distinct provider records.

Site/space pair IDs originally concatenated the two paths with `|`. Valid delimiter-bearing paths could produce the same text for two different pairs. The identity is now the JSON encoding of the tuple `['site-space', siteRef, spaceRef]`. A two-site/two-space fixture proves four unique pairs and a complete provider result.

### Parity subjects had changed

The first new outcomes added site subjects to containment/frontage and replaced the two legacy boundary endpoint subjects of column collision with one synthetic opening subject. That was useful enrichment but not the approved parity migration.

Outcome subjects now preserve the legacy population exactly:

- site escape: the space;
- site frontage: the road space;
- site area: the site zone;
- column blocks door: both boundary endpoint spaces.

Analysis evidence may still carry richer site, opening, and column references. The tests compare subject arrays, level, and source with the old implementation on all four documented failures.

### Overlay provenance fabricated a file/line pair

An opening added by `over` carries the overlay line but no file, while its containing boundary retains the base file. Combining those two values produced a location that existed in neither declaration.

Collision evidence now points at the containing boundary's real line/file, matching the legacy Finding. A virtual two-file composition adds a named door in an overlay and asserts the evidence points to the base boundary rather than fabricating an overlay line in the base file.

### Access exterior traversal regressed to one graph scan per room

The legacy implementation expands the person-passable exterior component once. The first migration draft performed a separate breadth-first search for every eligible room, undoing the deliberate large-building optimization.

The provider now builds one deterministic adjacency map, expands the multi-source exterior component once, and retains one shortest path for every reached space. The void-only query reuses the same adjacency. A 96-room fixture instruments boundary iteration and requires exactly one scan for this part of the provider.

## Parity and boundary evidence

- the five access reference failures are compared with the legacy validator, including message, Rule mapping, level, and subject;
- the envelope and four vertical reference failures are compared with legacy level, subject, and source;
- the four site/collision reference failures are compared with legacy level, subject, and source;
- pass and not-applicable are separate for every implemented Rule family;
- envelope drops a gap of exactly 1 mm and retains one just above it;
- stair dimensions are rounded before applying tread 240 mm and pace 550..700 mm inclusive;
- ramp accepts the declared limit and `limit + 1e-9`, and fails above that epsilon;
- escalator accepts both ends of `1/2.3..1/1.4`;
- vehicle doors fail at 2399 mm and pass at 2400 mm;
- site area passes below 0.05 m2 difference and fails at the endpoint;
- site containment includes the 1 mm tolerance;
- frontage uses integer rounding before the 2000 mm comparison;
- door/column contact is not overlap, while strict penetration is;
- every provider tested here leaves `toCanonical(model)` byte-identical;
- artifacts are JSON-only and contain no Rule identity or verdict vocabulary.

## Executed evidence

| Command | Result |
|---|---|
| `node --import tsx --test test/builtin-geometry-assessment.test.ts test/builtin-site-collision.test.ts test/builtin-access.test.ts` | 41 tests, 41 pass, 0 fail |
| `npm run typecheck` | success |
| `npm test` | 671 tests, 671 pass, 0 fail |

## Remaining boundary

This review deliberately does not approve a daylight missing-input representation, a CLI exit policy, or the final six-analysis/sixteen-Rule catalog. Those items remain stopped until the recorded user decisions are available. It also does not replace the final transport, package, documentation, canonical/Form fingerprint, or full gate review.
