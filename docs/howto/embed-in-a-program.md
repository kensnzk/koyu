---
title: Embed koyu in a program
mode: howto
---

# Embed koyu in a program

How to read, check and question `.muro` files from your own program. An in-house tool that emits an area schedule, a gatekeeper that runs on commit, an editor running in a browser — all three are the same four steps.

**Everything the CLI answers, the API answers.** The `koyu` command, `koyu-mcp` and this API are three entrances to the same derivation; there is no answer that only one of them has. So there is no need to shell out to the CLI and strip its output with regular expressions.

The surface itself — which names are exported and what types they carry — is on [TypeScript API](../reference/api/index.md). This page is the **order and the judgement calls** of embedding.

Every output below was actually run.

## 1. Install

```sh
npm install @kensnzk/koyu
```

**Zero runtime dependencies.** The package pulls in nothing but Node's own modules, and even those are confined to `@kensnzk/koyu/node`. It needs Node 22 or newer.

## 2. Decide where the model comes from

This is the first design decision, and changing it later moves every entrance in your program.

| Where the building lives | Function | Entrance |
|---|---|---|
| The file system | `parseFile` | `@kensnzk/koyu/node` |
| Buffers in memory (editor, browser) | `parseFiles` | `@kensnzk/koyu` |
| HTTP, a database, anything else | `parseWith` | `@kensnzk/koyu` |
| A single text with no `import` | `parse` | `@kensnzk/koyu` |

**The root entrance does not pull in `node:fs`.** It runs as-is in a browser, a Web Worker or an edge runtime. Only the file-system entrance is split off into `/node`.

Whichever you pick, **the `Model` that comes out has the same shape.** Composition — resolving `import` — takes "how to read a layer" as a function from outside, and fs is only one implementation of it.

## 3. Make one full pass

Load, check, judge, sum the areas. That is the whole cycle.

```ts
import { checkDiagnostics } from "@kensnzk/koyu";
import { areaM2, isIndoor } from "@kensnzk/koyu/model";
import { assess } from "@kensnzk/koyu/validate";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "@kensnzk/koyu/validate/builtin";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/house/main.muro");

const errors = checkDiagnostics(model).filter((d) => d.severity === "error");
console.log(`${model.name} — ${model.spaces.size} spaces, ${errors.length} errors`);

// The grounds are named, never inferred: one registry, one profile, one date.
const report = assess(model, {
  registry: createSchematicRegistry(),
  profile: SCHEMATIC_PROFILE_ID,
  context: { schema: "koyu-context/1", asOf: "2026-08-03", values: {} },
});
for (const f of report.findings) console.log(`${f.level} [${f.rule.id}] ${f.outcome.message}`);

let total = 0;
for (const s of model.spaces.values()) if (isIndoor(model, s)) total += areaM2(s) ?? 0;
console.log(`total floor: ${total.toFixed(2)} m2`);

process.exit(errors.length > 0 ? 1 : 0);
```

```text
小さな戸建住宅 — 13 spaces, 0 errors
total floor: 92.75 m2
```

`model.spaces` is a `Map<string, Space>` and `model.boundaries` is a `Boundary[]`. **The path is a space's identity**, and boundaries sit in an array as first-class relations belonging to neither space.

The area is summed by hand because **what the total means differs per program.** Whether semi-outdoor counts, how voids are treated, whether it splits by `use` — those are the caller's decisions, and `areaM2` supplies the material for them.

## 4. Do not mix the two answers

**This is the mistake embedding invites most.**

```ts
const errors = checkDiagnostics(model).filter((d) => d.severity === "error");
for (const f of report.findings) console.log(`${f.level} [${f.rule.id}] ${f.outcome.message}`);
```

- `checkDiagnostics` returns `Diagnostic { code, severity }` — it speaks only to **whether what is written contradicts itself as data.**
- `assess` returns an `AssessmentReport` whose findings carry `{ rule, level }` — it speaks to **whether it is sound as architecture, under the profile you named.**

**The field names alone make them different types.** Try to concatenate the arrays and the type falls apart. A green `check` does not mean a usable building — a building with no declared doors stays green and completely sealed. Never claim it works because it is green. What each one promises is on [The scope of the promise](../reference/scope.md).

**And an empty `findings` is not by itself a pass.** Read `report.summary.state`: it is `complete` only when nothing was left indeterminate and nothing errored. A rule that could not run has told you less than a rule that passed, and the report keeps the two apart precisely so a caller cannot confuse them.

**Split your exit codes the same way.** A broken composition and an architectural finding are two different events for the caller.

## 5. Catch the load failure

Syntax and composition errors do not arrive as diagnostics. They are thrown, because they stop before a model exists at all.

```ts
import { SourceError } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

function load(path: string) {
  try {
    return parseFile(path);
  } catch (e) {
    if (e instanceof SourceError) {
      console.error(`${e.file ?? path}:${e.line}: ${e.raw}`);
      process.exit(2);
    }
    throw e;
  }
}

const model = load("broken.muro");
console.log(model.spaces.size);
```

```text
<absolute path>/broken.muro:2: Undefined grid line name: X1
```

`SourceError` carries `line`, `raw` (the message without the position prefix) and `file` (when composing). Its `message` is the three joined together, so use `raw` when you want your own format.

**Do not swallow it.** Letting it escape uncaught puts a raw stack trace in front of your user.

## Run it in a browser

Where there is no file system, hand it the contents directly.

```ts
import { parseFiles, checkDiagnostics } from "@kensnzk/koyu";
import { svgPlan } from "@kensnzk/koyu/draw";

const model = parseFiles({
  "main.muro": "koyu 1.0\nunit mm\ngrid X 0 3600 7200\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\nimport ./L1.muro",
  "L1.muro": "space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2",
}, "main.muro");

console.log(model.layers, model.spaces.size, checkDiagnostics(model).length);
console.log(svgPlan(model, { level: "L1" }).slice(0, 60));
```

```text
[ 'main.muro', 'L1.muro' ] 2 0
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="
```

`import` resolves inside that key space. Editor buffers can go straight in, so **re-composing and re-checking on every keystroke** is a design you can simply write. Composition starts from zero every time, but the largest bundled example (11 layers, 1,808 spaces, 141,448.56 m2 of floor) takes a fraction of a second, so there is no need to start with a cache.

To replace the reading itself, hand a loader to `parseWith`. HTTP, a database, and anything else, enter there.

## Derive form — never recompute it

The quadrilateral of a wall, the rectangle of a column, the prism of a stair, the position of an opening. **Do not write a program that computes these itself.** The moment the same rule has two implementations, the two drift apart.

There is one entrance to form and it is `derive`. If all you want is SVG, `svgPlan` and `svgAxo` sit on top of it. What comes back in what shape is on [Form](../reference/form/index.md).

The same holds for derivation generally — reachability is `doorsBetween`, adjacency is `neighbors`, floors and roofs are `slabs`, daylight inputs are `daylightInputs`, the site is `siteReport`. **Never keep the definition of an answer in two places.**

## Pin the version

The language version of what you read is on `model.version`. The accepted versions are in `SUPPORTED_LANGUAGE_VERSIONS`, and a file that declares no version is read with the semantics of `DEFAULT_LANGUAGE_VERSION`.

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";
console.log(DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS);
```

```text
1.1 [
  '0.1', '0.2',
  '0.3', '0.4',
  '0.5', '1.0',
  '1.1', '1.2',
  '1.3'
]
```

**The two numbers on that line are different facts.** `DEFAULT_LANGUAGE_VERSION` is how a file with **no** version line is read, and it is frozen at `1.1`; the newest accepted version is `1.3`. Reach for `NEWEST_LANGUAGE_VERSION` when you mean the latter.

**The language version and the implementation version move separately.** The version in `package.json` is the implementation's; what a `.muro` file declares is the language's. What is promised not to break is on [The frozen surfaces](../reference/stability.md).

## Send it out as canonical JSON

Inside your own program, hold the `Model` as it is. But **anything you hand out, store or compare goes through `toCanonical`.** It produces one byte-stable string, which is what makes hashing, diffing and comparison work at all.

Canonical JSON carries **only what was written.** Derived default walls are not in it, so a reader taking meaning back out applies `deriveDefaultBoundaries` first. The whole format is on [Canonical JSON](../reference/json/index.md).

## Related

- [TypeScript API](../reference/api/index.md) — the entrances and every name on the surface
- [The scope of the promise](../reference/scope.md) — what a green `check` means
- [Judgement — koyu validate](../reference/validate/index.md) — the rule ledger
- [Form](../reference/form/index.md) — the entrance to derived form
- [Canonical JSON](../reference/json/index.md) — the ground for external connections
- [Gatekeeping in CI](../reference/cli/ci.md) — designing exit codes when commands are enough
