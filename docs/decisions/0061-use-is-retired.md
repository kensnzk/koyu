# ADR-0061: `use` is retired — a room's purpose is its type, and every other division of the building is a namespaced key

- Status: adopted
- Date: 2026-08-13
- Ships in: koyu 0.21.0, language version muro 1.3

## Context

`use` was introduced by [ADR-0005](0005-zones-and-unions.md) alongside `zone`, and that ADR states what it was for:

> `zone /L2..L9/A name:Aタイプ use:exclusive` … 「共用と専有の面積比」は住戸を間取りに割った後も1行も変えずに答えられる。

The ratio of common to exclusive area. [ADR-0008](0008-vocabulary-and-level-attr.md) then gave it the one inheritance rule in the language, and [ADR-0020](0020-daylight-scope-is-declared.md) recorded why:

> ADR-0008 が `use` にだけ継承を与えたのは、**`use` が集計軸 (住戸全体に一様)** だからで、採光の対象性は室ごとに違う。

So `use` was never an architectural use. It was a grouping key, and its name has said otherwise since the day it was written. That is the whole of the defect, and it had two consequences.

**The name taught the wrong thing.** `docs/reference/muro/space.md` defined the key as "The aggregation axis (`rentable`, `exclusive`, `common`, …)". Anything reading koyu's own reference to learn what `use` holds learned a lease vocabulary. Downstream generators copied the bundled examples, where all 375 `use:` declarations were `common`, `rentable`, `exclusive` or `parking`, and produced more of the same.

**One key held one grouping, so the axes fought over it.** This is the sharper failure, and it was already visible in shipped code. `src/validate/builtin/access.ts` branched on four `use` values:

| Read | Value | What kind of thing it is |
|---|---|---|
| `:104`, `:144` | `common` | a lease division |
| `:127` | `rentable` | a lease division |
| `:133` | `parking` | a room's purpose |

A parking space is *also* either rentable or common, so those cannot share one key — and because a space could carry only one `use`, writing either answer shut the other out. The same key was the only place to put a fire compartment, a department or a plant system, so none of them could be written at all.

**Nothing guarded the values.** `use: free()` declares no value domain, so `ATT01` and `ATT02` cannot fire on it. `use:commonn` passed `check --strict` and silently removed a space from two access rules.

### What Revit and IFC do

Neither models this the way koyu did, and both split it the same way.

`IfcSpace` has **no "use" attribute at all**. Its `PredefinedType` (`IfcSpaceTypeEnum`) is seven words and is not a vocabulary of purposes. A room's purpose is carried as a **classification reference** — OmniClass table 13, Uniclass SL. Grouping is `IfcZone`, and **a space may belong to many zones at once**: a fire compartment, a plant system, a department and a tenancy are four zones over the same room. The building's own occupancy is `Pset_BuildingCommon.OccupancyType`, on `IfcBuilding`, once.

Revit's Room carries `Name`, `Number` and `Department`, and the rentable split is not on the Room at all: it lives in a separate **Area Scheme**, where Revit ships "Gross Building" and "Rentable" (BOMA) as two schemes over the same building.

Both say the same two things. The room's purpose belongs on the room. The lease division is not the room's purpose and does not belong there.

## Decision

**1. A room's purpose is the type position, and the documentation now says so.** This is not a change of behaviour — core has read no type word since [ADR-0051](0051-structure-leaves-the-type-position.md), and `test/vocabulary.test.ts` holds that by machine. It is a change of what the type position is *for*, which no page had ever stated. `space.md` said only that the word is free and unread.

**2. Every other division of the building is a namespaced carried key.** `lease.category:` `fire.compartment:` `dept.name:`. This introduces no mechanism: [ADR-0033](0033-attribute-tiers.md) already established that a dotted key is carried tier, that anyone may write one, and that core gives it no meaning. A space may carry as many as it likes, which is the property `use` could not have.

**3. `use` is retired after muro 1.2, and the language version rises to 1.3.**

**4. The ledger row stays.** This is the part that is easy to get wrong. `checkAttrValues` reads `attrSpec` and never sees `model.version`, so deleting `use: free()` from `ATTR_LEDGER` would make `use:` unknown at *every* version at once — a muro 1.1 file would begin failing `ATT03` for a word 1.1 legitimately has, and `stability.md`'s promise that a file keeps its meaning would break on the first line of the change. Measured before writing anything: a key absent from the ledger produces `ATT03` under `muro 1.2`, under `koyu 1.1`, and under no version line at all.

So `AttrSpec` gains `retired?: { after, instead }`, and the ledger itself says the key is writable up to 1.2. `instead` sits beside `after` so that no state exists where a key is retired with nothing offered in its place.

**5. A new diagnostic, VER07.** Not VER06 — that is taken by "the file declares a version newer than this build reads", which `parse` throws.

VER07 is VER03 and VER04 read from the other end. Those fire when a file declares an old version and writes a word that version does not yet have; VER07 fires when a file declares a new version and writes a word that version no longer has. **Its guard runs the other way round from the three above it in `checkLanguageVersion`:** they ask `olderThan(model.version, X)`, with the file's version on the left; this one asks `olderThan(spec.retired.after, model.version)`, with the ledger's version on the left. Written the familiar way it would fire on every file that is not exactly 1.2.

It is a check-time diagnostic rather than a parse-time one, because `use:common` parses perfectly well at 1.3 — what it fails is an acceptance condition, which is where VER01–VER05 live.

**6. `koyu stats --by <key>` replaces the `By use:` line.** The old line was "group by one key, and the key is decided for you". `--by` is the same feature with the key supplied by the caller: repeatable, resolved by the rule `use` had (own declaration, else the deepest zone whose path is a prefix), with a space carrying no value falling into an explicit `(unspecified)` bucket so the buckets add up to `Total`.

**There is no default key.** A default would reinstate exactly the privileged grouping being retired.

**7. `effectiveUse` becomes `effectiveAttr(model, space, key)`.** The whole content of `effectiveUse` was the string literal `"use"`; moving that literal to the caller is the change. **Core naming no key is what keeps the carried tier's promise intact** — the caller names it, core forms no opinion about what it means, and it would answer the same way for a key it has never seen. Asking is not reading.

**8. The vehicle population moves to the type position.** `koyu.schematic.access.parking` selected on `use:parking`; it now selects on `type === "parking" || type === "ramp"`. Where cars belong is the room's purpose, so the type says it; a key would have been a second place to write the same fact. The two lease-reading rules move to `lease.category`, which keeps their zone inheritance because `effectiveAttr` resolves any key the same way.

## Alternatives rejected

**Redefine `use` as the building's use — `office` / `residential` / `retail` / `hotel`.** This was the first proposal and it is wrong for the reason the repository owner gave: if `use` were the building's use you would write it once for the building, not on 300 rooms. IFC agrees — `Pset_BuildingCommon.OccupancyType` sits on `IfcBuilding`. Writing `use:residential` on every space in a residential building is not information, it is a constant restated 300 times.

**Redefine `use` as the room's purpose.** Then it answers the same question as the type position, and one of the two should go. That is this decision, arrived at from the other side.

**Keep `use` and add `lease.category` beside it.** This is the shape the work had before it was thought through, and it is a special case dressed as a fix: it gives the lease division a home and leaves fire compartments, departments and plant systems with none, so the next axis arrives as another ad-hoc key. Retiring the privileged key and pointing at the general mechanism costs one diagnostic and closes the whole class.

**Give `zone` multiple membership so every division is a zone.** This is what IFC does, and it was rejected because koyu's `zone` **counts**. Its area is the sum of the spaces beneath it, and membership by path prefix is what makes that sum well defined. Divisions that are not containment — a fire compartment is not a thing rooms are inside — are answered by a key plus `stats --by`, which totals without implying containment.

## Consequences, measured

**The buildings did not change.** `test/fingerprints.test.ts` pins a canonical hash and a `Form` hash for all 15 bundled entries, and its own rule is that the `Form` column is the meaning-invariant. After migrating 375 declarations across 30 files:

```text
canonical moved  10 of 15   — exactly the ten entries that were edited
canonical held    5 of 15   — steps/01 to steps/05, which write no version line and no use:
Form moved        0 of 15
```

**Both halves are load-bearing.** The five that held are `stability.md`'s promise measured rather than asserted: retiring a key changes nothing for a file that does not write it, down to the byte. The zero says the other ten did not become different buildings either.

**No validation rule silently stopped applying.** Applicability and outcome counts were taken on every bundled example before and after. `throughtenant` and `backofhouse` are identical everywhere — 42 and 46 outcomes on `complex`, 118 and 124 on `twin`, and so on. `parking` keeps its counts on `basement` (5), `complex` (5) and `twin` (7).

**One rule gained coverage, and that is the point.** `examples/tower/site.muro` declares `space /site/park parking …` and never carried `use:parking`, so the car-access rule had never asked about it — a space typed `parking` that no vehicle test could see. Under the type-position population the rule applies to it and it passes. This is the failure mode the change exists to remove: a judgement that quietly does not apply because the entrance to it was a value somebody forgot to write.

**The canonical JSON format version does not move.** `use` is an entry inside the open `attrs` dictionary, not a key of the format, so neither of `koyu-canonical`'s conditions is met. It stays `koyu-canonical/2.0`.

**Three conformance cases were added**, and two of them are the ones that would have caught the mistake in decision 4: `version-use-reads-at-1-2` and `version-omitted-reads-use` both write `use:` and both must stay green forever. `version-use-reads-at-1-2` also pins that inheritance is not materialised — the zone carries `use:exclusive` and the space beneath it carries only its `name`, because the value is resolved when asked rather than when written.

**The cost: `lease.category` is spelled without a guard.** A carried namespaced key is never checked, so `lease.categry:common` passes `check --strict` and quietly removes a space from two access rules. That is not new — it is the same exposure the free type words in `access.ts` already carry, and it is what the carried tier means. It is stated on `docs/reference/validate/access.md` rather than left to be discovered.

**The cost: downstream has to move.** `effectiveUse` is gone from `@kensnzk/koyu/model`, and two repositories import it — `Koyu-Architype/lib/muro/colors.ts`, which also keys fixed colours on `rentable` / `exclusive` / `common`, and `koyu-product/apps/product/lib/ugatsu/stats.ts`, which aggregates `byUse`. Neither is changed here. koyu is 0.x and has promised no freeze on its own surfaces, but the ledger row means their existing `.muro` files keep reading either way.
