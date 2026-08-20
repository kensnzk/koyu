# ADR-0065: The outside is not an exception — a face onto it is a wall

Date: 2026-08-20 / Status: adopted (muro 1.4, koyu 0.26.0) / Origin: the repository owner — "having to declare that a face touches the outdoors before it becomes a wall: I want that gone. Isn't it backwards? A face onto the outdoors being a wall unless you say otherwise is the natural reading."

## Context

ADR-0014 made the horizontal default a wall: two touching spaces with regions get a `kind:wall` boundary whether or not one is written, mirroring the vertical "the default is a floor". Decision 2(b) carved out one case. **A boundary against a space with no region — the exterior — was never derived**, because naming *which* exterior a face looks at (the road, the neighbour, the garden) is information no default can supply, and road frontage is measured against exterior spaces declared as roads, so how the exterior is split changes the numbers.

ADR-0025 named the cost and did not remove it. A forgotten `boundary` to the outside is not an error, not a warning, and not visible in the plan: it is **a wall that silently does not exist**. On a 416-space building it produced 34 missing stretches, of which a person reading the 3D model found two. The answer then was a validation caution (`koyu.schematic.envelope.gap`) gated to levels where an exterior boundary had already been written, and the alternative considered here was explicitly rejected on the grounds above.

**The rejection does not survive being looked at again.** Naming was never something the old rule obtained. It was something the old rule *demanded*, and what an author got for forgetting was not a name but a hole. The information the rule was protecting was lost in exactly the cases the rule was supposed to cover.

Measured before deciding: every one of the nine bundled buildings already writes a boundary to the exterior for every run of every perimeter, so the derivation has nothing to do in any of them. The two examples under `skills/koyu-author/examples/` — the most-copied text this repository ships — did not: `flat-1ldk.muro` left 7,150mm of WC, washroom and bathroom perimeter facing nothing, and `office/main.muro` had no exterior boundary on L2 at all. Both were green.

## Decision

**1. A face onto the outside is a wall.** Every run of a space's perimeter that no declared boundary reaches gets a derived `kind:wall` boundary. The counterpart is the outside itself, spelled `outside` — a reserved identity, not a space. Every space path begins with `/` and `parseSpace` refuses one that does not, so it cannot collide with anything an author writes.

**The exterior is deliberately not materialised as a `Space`.** A member of `model.spaces` would leak into the canonical form, the area tallies, the drawings, `stats`, `levels` and every listing that walks the map, each of which would then need an exclusion nobody can be trusted to remember. Eleven sites look up a boundary's ends; eleven guards are cheaper than eleven exclusions that fail silently.

**2. Naming is what a declaration adds, and it still wins.** `space /out outside:1` names a part of the outside and a boundary to it takes the runs it reaches, with its own `t:`, `spec:`, openings and `seg`s. What the default supplies is the wall, not the name.

**3. Suppression is by run, not by pair.** Between two spaces one declaration suppresses the pair, edge-restricted or not — unchanged. The outside is not a pair: it is whatever the rest of the perimeter faces, so there is no unit to suppress. Each declared boundary takes the runs it realises and the default takes the remainder, which is `envelopeGaps` exactly. Writing `edge:S` alone therefore leaves walls standing on N, E and W, where muro 1.3 left nothing.

**4. The population excludes three kinds of space, because being open is what they are.** A space declared `outside:1`; a semi-outdoor space (ADR-0007, derived from an `open` or `air:1` boundary to an outside space); and a space under a `site:1` zone. A void is **not** excluded — it has a region and a level, and where one reaches the edge of the building the outer wall passes it exactly as it passes a room. The population cannot chase its own tail: every wall derived here is a plain `wall`, and `isSemiOutdoor` reads only `open` and `air:1`, so running the derivation can never change who is in it.

**5. The forgetting is reported, as BND08 (warning).** One per space, in declaration order, naming the runs and their lengths. **It is not a report of a hole** — the shape is complete — but of the one thing silence could not decide: which outside the face looks at. It is a warning and not an error because the file is not wrong; a plan worked out before the site is settled is a legitimate state and its shape is determinate.

**6. `koyu.schematic.envelope.gap` is retired, not carried.** It said "this perimeter faces nothing", which muro 1.4 cannot reach. What remains of the question is a missing declaration rather than an architectural opinion, so it belongs to `check`. The rule set holds fifteen rules and the catalog five analyses.

**7. The language version rises to 1.4, and the derivation is version-blind.** A file declaring an older version is read with the new default, and BND08 is the notice. **This bends ADR-0017's rule that an older version is accepted only where the meaning is preserved**, and it is the first place this repository has done so. It was chosen deliberately over the alternative in §Alternatives.

## Alternatives

**Keep the rule and make the envelope gap an error in core.** The state being reported is a genuine defect, so an error is tempting. It makes a scheme-stage file — a plan settled before the site is — unwritable, and it leaves the shape wrong rather than fixing it. Reporting a hole is worse than not having one.

**Warn only where the file has already named an exterior** ("if you started, finish", the ADR-0025 gate moved into `check`). Measured: 23 of 123 published examples would warn, against 86 under the rule adopted. It is the quieter rule and it catches the real forgetting — `flat-1ldk` and the whole of `office/main` L2 both fire under it. **It was put to the owner with both numbers and the broader rule was chosen**, on the ground that a face onto the outdoors with no boundary written is a forgetting whether or not the file has started naming. The cost is paid in the documentation: 177 of 252 muro blocks gained an exterior, 458 lines across 1,348 lines of example.

**Refuse older files with a VER code**, which is what ADR-0014 did for 0.1 → 0.2 and what ADR-0017 lays down. The population is qualitatively wider than any previous VER: not "files using a retired word" but **every file that has not closed its envelope**, including every file with no version line, which is read as 1.1. It would have made 90 of the published examples hard errors and broken every stored document downstream. Rejected as disproportionate, with the consequence recorded in decision 7 rather than hidden.

**Version-branch the derivation** so 1.3 and earlier keep the old reading. It honours the promise exactly, and it would be the first time semantics forked by version in this implementation; every version difference so far is handled by refusal, and two live semantics is a cost that never goes away. Rejected.

**Bind unfaced runs to the file's single declared exterior when there is exactly one.** It removes most of the documentation cost — one `space /out outside:1` closes a whole file. It is also wrong: bind every unfaced run to `/road` and `koyu site` counts a courtyard wall as road frontage. Rejected on that alone.

## Consequences and costs

**What was measured.** The Form of the nine complete buildings — some 2,500 spaces, up to 141,449 m2 — did not move by a byte, because none of them had a run left for the default to fill. Three files moved: the first three stages of the tutorial, where the outside has not been reached yet. Every committed drawing under `docs/img/` regenerates identical except those three and the two front-page snippets. `test/fingerprints.test.ts` holds the split.

**Cost 1: the version line no longer gates this rule.** A file that says `muro 1.1` is read with 1.4's exterior default. It is the first deliberate exception to "a file written this way keeps meaning this", it is written on the face of `docs/reference/muro/version.md`, and BND08 fires on exactly the set of files whose meaning changed.

**Cost 2: minimal files warn.** The five-line file in `defaults.md`, and stages 1 to 3 of the tutorial, all draw BND08. ADR-0020's caution — a diagnostic that fires on a normal state teaches people to ignore it — applies and was accepted with the measurement in hand. `scripts/gate.mjs` carries the one exemption this forced: a file under `examples/steps/` that has not named an exterior yet is a stage rather than a building, which is the same line the access rule already draws by having an empty population there.

**Cost 3: the relation identity of existing boundaries can shift.** `a|b@i` numbers by position in canonical boundary order, and the derived exterior walls sort among the declared ones, so `@i` moves for boundaries that sort after them. Derived interior walls already did this, so the mechanism is unchanged; the population is larger.

**Cost 4: 458 lines of scenery in the documentation.** 177 of 252 muro blocks gained `space /out outside:1` and a `boundary` line per space. The bundled buildings already wrote them, so the examples now read the way real muro is written — but a six-line example is now a ten-line one.

**What it bought.** The two skill examples were repaired, and the hole ADR-0025 found in the tower's second-floor corridor is closed by the language rather than by hand — `eval/fixtures/tower-uid`, which is frozen and still carries it, gains its wall from the derivation and goes from 542 boundaries to 543.
