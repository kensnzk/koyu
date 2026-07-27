**English** · [日本語](../scope.md)

# Scope — the three domains, and the surfaces that freeze

As of koyu v1.0.0-rc.1 / muro 1.0. **This document is the norm for what is promised and what is not.**
For the grammar see [language.md](language.md), for the semantics [semantics.md](semantics.md), for the ledger of verdicts [validation.md](validation.md).

The lines drawn here are stronger than those drawn in any other document. Where another page of the spec disagrees with this one, **this one is right**.

---

## 1. The three domains

koyu is made of three domains. **They are kept apart because the quality demanded of them differs.**

| Domain | Where | Size | Quality | Version |
|---|---|---|---|---|
| **core** | `src/core/` | small | **must be clean** | **freezes** |
| **validation** | `src/validate/` | grows | may be messy | does not freeze |
| **presentation and build** | `src/draw/` and [ugatsu](https://github.com/kensnzk/ugatsu) | grows | may be messy | does not freeze |

**The dependency runs one way.** Validation and presentation both depend on core; core depends on neither. core stands and runs by itself. This one-way rule is not held by a sentence but machine-checked by `test/domains.test.ts`.

Without the separation two things happen at once — **the mess seeps into core and freezes there, and core's caution stops validation and presentation from growing.** The separation itself is the condition under which validation and presentation are allowed to be messy. Mess in a domain that does not freeze is cheap, because it can be rewritten at any time. Mess in a domain that freezes stays forever.

> **koyu does not make coordinates. ugatsu does not make meaning.**

---

## 2. What core holds

The source language, its semantics, and the mouth it offers to machines.

- **the grammar and semantics of muro** — what may be written, and what what is written means
- **composition** — the strength order of layers, the resolution of single values, the editing of sets, provenance ([composition.md](composition.md))
- **identity** — uid and path, the identity of a relation ([§5](#5-identity))
- **derivation** — the rules that make **a unique form** from the authored composition, and their reference implementation ([§6](#6-the-contract-of-derivation))
- **the diagnostics of structural consistency** — the `Diagnostic[]` that `check` returns
- **the queries** — area, graph, route, opening area. **But they deliver no verdict** ([§4](#4-the-queries-deliver-no-verdict))
- **the machine format** — canonical JSON ([canonical-json.md](canonical-json.md))

---

## 3. The extent of the guarantee — what "the check passed" means

**The meaning of a green `koyu check` is defined as follows.**

> **For the structural layer and the interpreted layer, the declared invariants hold. About the carrier layer it says nothing. About soundness as architecture it says nothing.**

This is not a verdict but **part of reading**, and it sits at the same layer as a JSON parser rejecting broken JSON.

### 3.1 What is guaranteed

| Guarantee | Diagnostic |
|---|---|
| the uniqueness of paths and identities | UID01-03 / ZON02 / the duplicate-path error raised during composition |
| the existence of what is referenced | REF01 / an undefined asset / the zone a polygon corresponds to (SIT04) |
| the definition of levels | LVL01 / VRT02 |
| overlapping regions (in plan) | GEO01 / GEO02 |
| overlapping regions (in section) | HGT01 / HGT02 |
| that composition resolves determinately | A composition error (`SourceError` — [composition.md](composition.md)) |
| **the sufficiency of the information a form needs** | SUF01-04 |
| the soundness of relations | BND01-06 / VRT01-06 |
| the uniqueness of derivation (the form of openings, segs, lines, columns, vertical circulation) | OPN01-08 / SEG01-08 / LIN01-03 / COL01-02 / RUN01-05 |
| the domain of values of interpreted attributes | ATT01-03 / DAY01 |
| the soundness of the given data | SIT01 / SIT02 |

**Overlap in section (HGT01/HGT02) is in core because it is the sectional counterpart of overlap in plan (GEO01/GEO02).** The ceiling below and the floor above occupying the same z is the same kind of contradiction as two spaces whose regions overlap, and no unique form can be made from it. Architectural judgements about height — floor-to-floor heights, eaves heights, diagonal setback envelopes — are not guaranteed; those are the validation surface.

### 3.2 What is not guaranteed

**Daylighting, coverage ratio, floor area ratio, continuity of the envelope, whether a stair is comfortable to climb, whether a door can actually be installed, means of egress, road frontage — and every other kind of soundness as architecture.** And **the meaning of the attributes of the carrier layer**.

These do not fail to exist; they are **on another surface**. [validation.md](validation.md) and `koyu validate` hold them.

### 3.3 Do not claim it "works" on the strength of green

Even when `check` is green the building need not be usable. Because the default between touching spaces is a wall ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)), a two-storey building that declares not one door is **completely sealed while staying green**. Nor does an envelope grow by itself. Circulation is answered separately by `doors`, and verdicts by `validate`.

---

## 4. The queries deliver no verdict

core holds the queries of aggregation and of the graph. **But they deliver no verdict.**

| Query | What core returns | What validation says |
|---|---|---|
| daylighting | floor area and effective window area (`daylightInputs`) | whether 1/7 is met (`daylight.ratio`) |
| the site | site area, road frontage length, building footprint area, gross floor area, and their quotients (`siteReport`) | the 2 m frontage (`site.frontage`), escaping the site (`site.escape`) |
| vertical circulation | number of steps, riser, going, slope (`verticalRuns`) | crampedness (`stair.proportion`), slope (`run.slope`) |
| the envelope | the perimeter segments that face nothing (`envelopeGaps`) | whether that is a hole (`envelope.gap`) |
| circulation | the path of fewest doors and passability (`doorsBetween` / `passable`) | whether the outside can be reached (`access.unreachable` and the rest of `access.*`) |
| columns and openings | columns standing on the grid and openings placed on segments (`columnsFor` / `placeOpening`) | whether they overlap (`column.blocksdoor`) |

**The thresholds are on the architecture's side.** Neither 1/7 nor 2 m nor 240 mm is an invariant the authored composition must satisfy. Returning the number is core's work; drawing a line through the number is validation's.

---

## 5. Identity

**Only spaces and aggregations (space / zone) carry a uid. And it is not required.**

- **a space with a uid written on it** is canonically that uid. It is the same thing even when its path changes
- **a space without one** corresponds by path. Rename it and the correspondence is cut
- **the identity of a relation (boundary) is derived from the spaces at its two ends.** A uid cannot be written on a relation — a relation always lies between two spaces, so fixing both ends fixes the relation. Writing a uid per relation would make relations outnumber spaces, which is to cut away, by one's own hand, the aim that "one building fits in the machine's field of view"
- **the identity of an opening or of an inclusion (a column) is derived from the object that contains it and a name unique within it**

It is not required so that **the author can choose the strength of the guarantee**. Write one only on the spaces that must be pointed at across time.

> **Be responsible for identity, not for content.**

---

## 6. The contract of derivation

Not making the form and not being able to make it are different things. **From this description a unique form must be derivable.**

The assurance is first of all structural — the given data supplies coordinates, a relation supplies a seat in the shape of a shared face, and substance sits on that seat. **Substance is born holding a seat.** Three further things are fixed.

1. **The rules of derivation belong to the specification**, not to the implementation. If the rules differ from consumer to consumer, different buildings come out of the same source. Then it is not a source. The rules are held by [semantics.md](semantics.md) §2-4
2. **Sufficiency is checked.** Whether the information a form needs is present is part of structural consistency (SUF01-04). **It is a check of completeness, not a judgement of soundness**
3. **A reference implementation exists and is exercised by the tests.** `derive(model): Form` is the only entrance, and it **has no appearance** — it returns no color, no typeface, no line weight, no annotation string. `src/draw/` and ugatsu merely draw this `Form`

**"Several forms come out of one composition" is a defect.** What may be several is the **appearance**, not the form.

---

## 7. The three layers of attributes

| Layer | Examples | core's stance |
|---|---|---|
| **structural** | path, type, region, level, the other side of a relation, kind | **always read.** If it is broken, nothing is read |
| **interpreted** | `h` `w` `at` `daylight` `road` `site` `style` … | the ledger ([vocabulary.md](vocabulary.md)) defines the domain of values, and it **is read** |
| **carrier** | `acme.sensor` `bems.temp` `survey.measured` … | **not read.** Open, under a namespace |

**The carrier layer carries a namespace (dot separated).** It is written like `acme.sensor:23`. An unknown key without a namespace is **an error (ATT03)** — this keeps a one-letter slip such as `heigh:2400` from quietly having no effect, and it is the only shape in which "not looked at" can be told apart from "looked at and found sound".

Being open and being trustworthy are compatible as long as the boundary is declared. Without the declaration, **"not looked at" cannot be told apart from "looked at and found sound"**. "Nothing wrong" in that state means nothing. **Being able to carry something without judging it is a legitimate state, and saying so explicitly is the condition of that freedom.**

For the details see [vocabulary.md](vocabulary.md).

---

## 8. The eight surfaces that 1.0.0 freezes

**1.0.0 is not the completion of features. It is the fixing of the surfaces promised not to break.**

| Surface | What is promised |
|---|---|
| **the grammar and semantics of muro 1.0** | what this version could read will be read with the same meaning ever after |
| **the rules of composition** | the six in [composition.md](composition.md). The same input always yields the same result |
| **identity** | the rules of §5. Same uid, same thing |
| **the three layers of attributes and the namespace** | §7, including the promise that the carrier layer is not read |
| **the machine format** | **it names its format version** ([canonical-json.md](canonical-json.md)). The same input yields the same bytes — the collation and the normalization are settled as norms. It holds the result of composition and holds no form |
| **the rules of derivation** | §6. Written out as specification, with a reference implementation offered as API |
| **the diagnostics of structural consistency** | codes and severity. The meaning of green agrees with the definition in §3 |
| **the public API and the CLI** | parsing, composition, canonicalization, the queries, derivation. Commands, arguments, exit codes |

### What is not subject to the freeze

**These may exist; that they are not subject to the freeze is stated explicitly.**

- **the generation and drawing of form** — `svgPlan` / `svgAxo` / the CLI's `plan` and `axo` / MCP's `plan_svg`. The CLI's **surface** (subcommand names, arguments, exit codes) freezes, but **the contents of the SVG do not**
- **architectural verdicts** — the body of rules in [validation.md](validation.md) and the output of `koyu validate`. It is a surface that grows
- **the MCP tools** — treated as a surface that grows by addition
- **round trips to and from external formats, and import**
- **the surfaces for people** — editor support and authoring. ugatsu holds them
- **the meaning of the attributes of the carrier layer**

---

## 9. How the versions are counted

There are two lines of version.

- **the version of muro** — the language, its semantics, and the rules of composition. The **meaning** the machine format carries follows this version (it is another spelling of the same semantics)
- **the version of koyu** — the implementation. It declares which muro it implements

**The machine format carries a version of its spelling, which is neither of these two** — the `format` key ([canonical-json.md](canonical-json.md)). muro holds the semantics, but the same semantics may be re-spelled with different keys, so the spelling is counted separately.

ugatsu versions independently and declares the version of muro it follows. The validation surface carries no version and grows by addition.

**muro 1.0 and koyu 1.0.0 arrive together.** The implementation's surface cannot be frozen while the language's surface is unsettled, and neither can the reverse.

---

## 10. What is not held

- **geometry in the authored source** (the exception is given data — the `polygon` of the site shape)
- **a mechanism for placement** — inclusion supplies no seat. Columns and equipment carry only "which space contains them", and no form can be made from that
- **including architectural verdicts in the contract of the source**
- **the pursuit of professional-practice resolution.** Coverage is not a value — adding more takes the thing out of the machine's field of view and breaks the aim
- **round-trip compatibility.** An exit is built; a round trip is not
