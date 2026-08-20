---
title: TypeScript API
mode: reference
---

# TypeScript API

`@kensnzk/koyu` reads `.muro`, checks it, answers questions about it, derives form from it, judges it under a rule profile, and emits drawings. **Everything the CLI answers, this API answers.** The [`koyu` command](../cli/index.md), the `koyu-mcp` server and this API are three entrances to the same derivations; there is no answer that only one of them has.

```sh
npm install @kensnzk/koyu
```

There are no runtime dependencies. The only modules the package pulls are Node built-ins, and those are confined to `@kensnzk/koyu/node`. It needs **Node 22 or later** (`engines.node` is `>=22`).

## Twelve entrances

```ts
import { parse, checkDiagnostics, toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
import { areaM2, levelsSorted } from "@kensnzk/koyu/model";
import { derive } from "@kensnzk/koyu/form";
import { assess } from "@kensnzk/koyu/validate";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "@kensnzk/koyu/validate/builtin";
import { svgPlan } from "@kensnzk/koyu/draw";
```

**The import line says which contract you are relying on.** That is the whole point of the split: the face that freezes, the face that computes from external conditions, the face that concludes, the presentation that may change freely, and the Node-specific adapter never get mixed together.

| Entrance | What is in it | `node:fs` |
|---|---|---|
| `@kensnzk/koyu` | the minimum to begin the loop — compose, check, canonicalise | **not pulled** |
| `@kensnzk/koyu/model` | `Model` and the questions the model answers on its own | not pulled |
| `@kensnzk/koyu/diagnostics` | structural-consistency diagnostics and the code ledger | not pulled |
| `@kensnzk/koyu/graph` | adjacency, passability, routes, boundary segments | not pulled |
| `@kensnzk/koyu/form` | `derive`, the `Form` types, the [constructors of matter](../form/index.md), and [`sectionForm` / `elevationForm`](../form/section.md) — the one derivation of shape | not pulled |
| `@kensnzk/koyu/analysis` | the analysis protocol: run one analysis under an explicit context and profile | not pulled |
| `@kensnzk/koyu/diff` | the semantic difference between two models | not pulled |
| `@kensnzk/koyu/vocabulary` | the attribute ledger | not pulled |
| `@kensnzk/koyu/validate` | the rule SPI, the runner, `AssessmentReport` | not pulled |
| `@kensnzk/koyu/validate/builtin` | the rules, the rule set and the profile koyu ships | not pulled |
| `@kensnzk/koyu/draw` | `svgPlan`, `svgAxo`, `svgSection`, `svgElevation` and their option types; and the base every drawing is made from — [`planMarks`](../form/marks.md) for a plan, [`sceneOf`](../form/scene.md) for a 3D scene | not pulled |
| `@kensnzk/koyu/node` | `parseFile` and `parseFileWith`, nothing else | pulled |
| `@kensnzk/koyu/examples/*` | the source of a bundled building, for tests and evaluation | — |
| `@kensnzk/koyu/syntax` | the editor grammar (TextMate grammar as JSON), shared by VS Code and Shiki | — |

The first twelve are JavaScript module entrances: you `import` names from them. The last two are data, so the `node:fs` column does not apply. **This table is every subpath the package publishes.** A test binds each declared subpath to an appearance on this page.

**root is not a shorthand for the other eleven.** It re-exports no domain name at all — a caller who wants `areaM2` imports `/model`, and a caller who wants `derive` imports `/form`. A name absent from the table below is outside the promise of the root, however visible it is in the source.

**The root pulls neither `node:fs` nor `node:path`.** It runs unchanged in a browser, a web worker, or an edge runtime. Only the entrance that touches the filesystem lives under `/node`. The split exists to keep the parser itself pure: composition (resolving `import`) takes a "how do I read a layer" function from outside, and the filesystem is only one implementation of it. A browser passes a virtual file set (`parseFiles`) or its own loader (`parseWith`).

## Nothing judges unless you name it

`@kensnzk/koyu/validate` is the SPI and the runner; it holds no rules. `@kensnzk/koyu/validate/builtin` holds koyu's own pack as **a value**. Importing it registers nothing — there is no `registerRule`, no process-global registry, and no import-time side effect. You compose a registry, name a profile and a context, and pass them in.

```ts
import { assess } from "@kensnzk/koyu/validate";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "@kensnzk/koyu/validate/builtin";

const report = assess(model, {
  registry: createSchematicRegistry(),
  profile: SCHEMATIC_PROFILE_ID,
  context: { schema: "koyu-context/1", asOf: "2026-08-03", values: {} },
});
```

Because the catalog is a value rather than a registration, two profiles and two packs can run in the same process, in any order, without contaminating each other. An external pack implements the same `Rule` interface the built-in ones implement and gets no less access. See [the validation reference](../validate/index.md).

## The surface is written down

The package root does not use `export *`. The moment a module gains an export, a promise nobody declared would join a frozen surface. A promise has to be written out to be a promise.

So **this surface is exactly the set of names spelled out one by one in `src/index.ts`**. A name that is not there is not a promise, however visible it is in the source. The table below is that set, and `test/public-api.test.ts` holds it in set-equality with the implementation — **the count is not written down; the table is the source.**

**The whole promise is this table.** A test binds this table and the set in `src/index.ts` to each other, so adding an export without writing it here fails. Names go in collation order, and the grouping follows which module each name is exported from.

<!-- api-surface -->

| Surface | Values | Types |
|---|---|---|
| Parsing and composition | `parse` `parseFiles` `parseWith` `tokenize` | `LayerLoader` |
| Structural consistency | `check` `checkDiagnostics` | `CheckResult` `Diagnostic` `DiagnosticCode` |
| Canonical form and versions | `DEFAULT_LANGUAGE_VERSION` `NEWEST_LANGUAGE_VERSION` `requireMuro` `SourceError` `SUPPORTED_LANGUAGE_VERSIONS` `toCanonical` | `Model` |

Four things put a name on the surface.

1. Something outside the package (the viewer, the eval harness, scripts, the editor extension) actually calls it.
2. It is needed so the API can answer what the CLI or MCP answers.
3. It is a derivation promised by name.
4. A test pins it as a contract.

Plumbing that only lets core modules reach each other is not surface. Types are on it only when they are needed to spell out the signature of a value that is on it.

## The first program

Read a file, check it, print areas. That is one full turn of the loop.

```ts
import { checkDiagnostics } from "@kensnzk/koyu";
import { areaM2 } from "@kensnzk/koyu/model";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/two-rooms.muro");

const diags = checkDiagnostics(model);
console.log(`${model.name} — spaces ${model.spaces.size} / diagnostics ${diags.length}`);
for (const d of diags) console.log(`${d.severity} ${d.code} ${d.message}`);

for (const s of model.spaces.values()) {
  console.log(`${s.path}\t${s.type}\t${areaM2(s) ?? "-"}`);
}
```

```text
二室 — spaces 3 / diagnostics 0
/L1/a	room	16.2
/L1/b	room	16.2
/out	exterior	-
```

`model.spaces` is a `Map<string, Space>` and `model.boundaries` is a `Boundary[]`. **A path is the identity of a space**, and a boundary belongs to neither space it joins — it is a first-class relation sitting in an array. See Model and its types.

**An empty diagnostic list does not mean the building works.** `checkDiagnostics` says only that what is written is not self-contradictory as data. A two-storey house with not one door declared stays sealed shut with an empty list. The architectural judgement is made separately by `assess`, under a profile you name.

## Depending on a language version rather than a package range

**What an application depends on is a muro version, not a koyu version.** An editor that writes `muro 1.1` needs a build that reads 1.1; which build that is, is this package's business. Expressing that as a semver range in `package.json` guesses at the answer, and the guess goes stale silently — the range keeps resolving while the language underneath it moves.

`requireMuro` states the real requirement, at startup, in one line.

```ts
import { requireMuro } from "@kensnzk/koyu";

requireMuro("1.1"); // the version this application reads and writes
```

If the installed build does not read it, the message names the fix rather than the symptom:

```text
This build of koyu (0.20.0) does not read muro 1.4. It is newer than anything this
build knows (it reads up to 1.2) — upgrade koyu.
```

**It says what this build knows, not what exists.** A build only carries the rows compiled into it, so a version released after it looks exactly like a version that never existed — and claiming "no koyu reads this" would be asserting something no build is in a position to know. A version older than the newest, but absent, gets the list instead. A version that has been retired says so and points **backwards**: a newer koyu is what dropped it, so a newer koyu will not help.

`requireMuro` is on the root because asserting is the one thing a consumer *does* about versions. The ledger it reads is on `@kensnzk/koyu/model` with the rest of the model surface: `speaksMuro` is the same question without the throw, `koyuSince` answers the other direction — which release first read a version, and so what package range a language requirement implies — and `MURO_SUPPORT` is the ledger itself. `versionLine` is the sentence `koyu --version` prints.

**The same pair is on `package.json` as the `muro` field**, so a build script can check it without importing anything.

## Where to read a signature

**The package ships its own source.** `files` in `package.json` carries `src/` alongside `dist/`,
so `node_modules/@kensnzk/koyu/src/` holds every declaration with the comment that explains why it
is shaped the way it is — and `dist/*.d.ts` holds the types your editor already reads.

That is the place to look up a signature. This page used to be followed by fourteen more that
restated those declarations in prose, and they were a hand transcription of a machine source: the
moment `Space.type` became optional, `model.md` went on publishing `type: string` and `derive.md`
went on publishing a `FormSpace` without `outside` or `void`. Nothing caught it, because nothing
could — no test binds prose to a type.

**What this page holds instead is the set.** The table above is the whole surface, and
`test/public-api.test.ts` keeps it in set-equality with `src/index.ts`. A name in the table is a
promise; a name absent from it is not one, however visible it is in the source. For what each name
means, read the declaration.

## Three domains

The surface falls into three parts, and **the way it falls is itself part of the promise.**

| Domain | What it says | Frozen? |
|---|---|---|
| core | consistency of the composition, and the numbers and shapes derived from it | **frozen** — a change of meaning raises the language version |
| analysis | facts computed under a named context and profile, with no verdict | the protocol is frozen; an analysis carries its own revision |
| validation | architectural judgement (`AssessmentReport`) | not frozen — rules are added, sharpened, dropped |
| drawing | the content of the SVG | not frozen — looks change freely |

core **never passes judgement.** Areas, segments, convex pieces, solids — that is where core stops. Whether something is *enough*, or *complied with*, is validation's sentence. The split shows up in the types: core returns `Diagnostic { code, severity }` and validation returns outcomes carrying `{ status }` inside findings carrying `{ rule, level }`. The field names differ, so the two arrays cannot be confused for each other.

`planMarks` and `sceneOf` sit under the SVG rather than beside it. They carry no colour, no line
type and no word, so an outside viewer draws the same plan and the same scene koyu draws without
re-deriving a single shape — and without inheriting koyu's palette or koyu's language.

The bytes of the SVG that `svgPlan` and `svgAxo` return are outside the promise. **The same input yields the same form, but not the same bytes.** Colours, line styles, typefaces and symbols change without notice. To compare drawings mechanically, compare `toCanonical` or the value returned by `derive`.
