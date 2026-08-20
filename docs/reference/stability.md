---
title: Stability — what will not break
mode: reference
---

# Stability — what will not break

**1.0 is not the completion of features. It is the fixing of the surfaces promised not to break.**

## The version lines

Each is counted independently. Mixing them makes it impossible to say which promise was broken.

| Version | What it attaches to | Currently |
|---|---|---|
| **The muro version** | **the language, its semantics and the rules of composition.** "A file written this way keeps meaning this" | **1.4** |
| **The koyu version** | **the implementation.** "This implementation's surfaces will not break." It declares which muro it implements — `koyu --version`, `package.json`'s `muro` field, and the MCP `serverInfo` all say so, from one ledger | **0.26.0** |
| **The canonical JSON format version** | **the spelling.** The set of keys, their order, collation, normalisation, number notation | `koyu-canonical/2.0` |
| **The assessment context version** | **the input `koyu validate` takes** — the effective date and the external values a judgement is made against | `koyu-context/1` |

A `.muro` file declares only [the language version](muro/version.md). It announces semantics, not the maturity of a processor.

**A version is carried where something checks it, and nowhere else.** `koyu-context/1` is on this list because `validate` reads the string on arrival and refuses an input that does not match it. The shapes `validate` *returns* — `koyu-assessment`, `koyu-analysis` — carry no version at all: nothing reads them back, and judgement is [the face that does not freeze](../why/three-domains.md), so a version on it would announce a stability nobody intends to keep.

```muro-part
muro 1.4
```

**A separate format version is needed because the same semantics can be respelled with different keys.** Adding the `a` key, which preserves the written direction of a boundary, changed the spelling without changing one word of the language. The converse also happens: a language version can rise without the spelling moving.

## The two lines need not arrive together

As things stand, **muro has reached 1.4 and koyu is still 0.x.**

That is not a lag; it is what having two promises means. muro 1.0 says "what could be read at this version stays readable with the same meaning"; koyu 1.0 would say "this implementation's surfaces will not break". **The language is settled and the implementation has promised no freeze at all** — the first can settle first, and it did.

Outside viewers carry their own versions and declare which muro they follow.

## What "meaning-preserving" means

Whether a change raises the language version depends on whether it is **meaning-preserving**. The word has a fixed meaning here.

> **Meaning-preserving means the derived artefacts — canonical JSON, the graph, the tallies, the SVG — are unchanged. It does not cover the number of diagnostics.**

So **adding a check never moves the language version.** If the derived artefacts of an unambiguous source do not change by a single byte, the change is inside the definition. Conversely, a change that makes the same text mean a different building always raises the version.

An older declared version is **accepted only where the meaning is preserved**. Combinations where the same text would mean a different building are stopped as errors by [VER01–05](diagnostics/ver.md), which offer two ways out: write the meaning explicitly, or raise the version.

**One rule is exempt, and says so on its own page.** The rule that makes a face onto the outside a wall reaches every accepted version rather than being gated by the version line ([the version line](muro/version.md)). It is the only such exemption, and [BND08](diagnostics/bnd.md#bnd08) reports every file it reaches.

## The eight surfaces that freeze

| Surface | What is promised |
|---|---|
| **The grammar and semantics of muro 1.4** | what could be read at this version stays readable with the same meaning |
| **The rules of composition** | layer strength order, resolution of single values, editing of sets, provenance. The same input always gives the same result |
| **[Identity](identity.md)** | same uid, same thing. The rules for paths and names |
| **[The three attribute tiers and namespaces](scope.md)** | including the promise that the carried tier is not read |
| **[The machine format](json/index.md)** | **it announces its format version.** The same input gives the same bytes — collation and normalisation are fixed. It holds the result of composition and holds no shape |
| **[The derivation rules](form/index.md)** | written out, with a reference implementation offered as API |
| **Structural diagnostics** | codes and severities. The meaning of green matches [the definition of scope](scope.md) |
| **The public API and the CLI** | parse, compose, canonicalise, question, derive. [The commands](cli/index.md), their arguments, their exit codes |

One point about diagnostics deserves emphasis. **Severity is an immutable property of a code.** The same code is never an error in one case and a warning in another. To change the weight, a new code is cut and the old spelling is retired.

## What does not freeze

**These may exist; it is explicit that they are outside the freeze.**

- **Shape generation and drawing** — `svgPlan`, `svgAxo`, `svgSection`, `svgElevation`, the CLI `plan` / `axo` / `section` / `elevation`, the MCP `plan_svg` / `section_svg` / `elevation_svg`. The CLI **surface** (subcommand names, arguments, exit codes) freezes; **the contents of the SVG do not**
- **[Architectural judgement](validate/index.md)** — the fifteen rules and the output of `koyu validate`. This face grows
- **[The MCP toolset](mcp/index.md)** — treated as a face that grows by addition
- **Round-tripping with and importing external formats**
- **Surfaces for people** — editor support, authoring
- **The meaning of carried-tier attributes**

### What must not change is the Form, not the SVG

Drawing only draws [`Form`](form/index.md). So **the look of the SVG may change at any time.** Colour, line weight, line style, drafting conventions for symbols, page margins — none of that is on a frozen surface.

**What freezes is `Form`** — coordinates, thickness, z ranges, direction, subject identity, plan classification. Two `Form`s out of one composition is a defect; two SVGs out of one `Form` is not.

That drawing only draws is machine-enforced. Tests check that the drawing side pulls in none of the parts that assemble shape, that no [derivation constant](form/constants.md) is spelled inside the drawing code, and that the black bands in a plan are exactly the "cut intervals" of `Form`.

## Neighbouring pages

- [Scope](scope.md) — what a green `check` means
- [Identity](identity.md) — the two tiers of the uid guarantee
- [What koyu does not hold](not-held.md) — what is given up instead of frozen
- [Form](form/index.md) — the thing on the frozen side
- [Canonical JSON](json/index.md) — the face that announces a format version
- [The koyu version line](muro/version.md) — the version a file declares
- [VER diagnostics](diagnostics/ver.md) — when an older version is accepted
