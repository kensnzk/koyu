---
title: Language versions
mode: reference
---

# Language versions

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";

const SUPPORTED_LANGUAGE_VERSIONS: readonly string[]
const DEFAULT_LANGUAGE_VERSION: string
```

```ts
console.log(SUPPORTED_LANGUAGE_VERSIONS, DEFAULT_LANGUAGE_VERSION);
```

```text
[ '0.1', '0.2', '0.3', '0.4', '0.5', '1.0' ] 1.0
```

**Six versions are accepted, and the default is `1.0`.**

## The language's version, not the tool's

The `koyu 1.0` written on the first line of a `.muro` is **the version of the language's meaning.** It is not the package version (`version` in `package.json`), and it is not the format version [canonical JSON](canonical.md) announces (`koyu-canonical/1.0`).

**The three move independently.** The tool can rise without the meaning of the language moving, and the language can rise without the spelling of the canonical form moving.

## The array order is the version order

**The index into `SUPPORTED_LANGUAGE_VERSIONS` is the ordering of versions.** Compare versions by that index.

```ts
import { SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";

const older = (a: string, b: string) =>
  SUPPORTED_LANGUAGE_VERSIONS.indexOf(a) < SUPPORTED_LANGUAGE_VERSIONS.indexOf(b);
```

**Do not compare them as strings.** The six spellings currently in the array happen to sort lexicographically into the right order, but that is an accident of these six, not a rule. It breaks as soon as versions are added.

## What omission means

**Omit the version declaration and the file is read with the newest meaning, always.**

```ts
import { parse } from "@kensnzk/koyu";

const n = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2`);
console.log(n.version, n.versionDeclared);
```

```text
1.0 undefined
```

`version` gets the default, but `versionDeclared` is not set. **The two say different things**: the first is "which meaning it was read with", the second is "did the author write a version". Whether [canonical JSON](canonical.md) emits the `koyu` key follows from the second.

**Omission means "read with the newest version", not "meaning is stable across versions".** Write the version into any file whose meaning you want pinned.

## Versions that are not accepted

A spelling absent from the array is a `SourceError` at parse time.

```ts
try { parse(`koyu 9.9\ngrid X 0 3600`); } catch (e) { console.log((e as Error).message); }
```

```text
line 1: Unsupported koyu version: 9.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0)
```

## Older versions are accepted only where meaning is preserved

**A file that declares an older version is read with that version's meaning.** But if it uses a word that version did not have, a diagnostic says so.

| Code | What it objects to |
|---|---|
| `VER01` | `koyu 0.1` relying on derived default boundaries |
| `VER02` | `koyu 0.3` or earlier, with no `daylight` on a type that used to be inferred |
| `VER03` | a `koyu 0.4`-or-earlier file using a 0.5 word (vertical circulation, drawn lines, columns, underground) |
| `VER04` | a `koyu 0.5`-or-earlier file using a 1.0 word (`over`, `drop`, set edits) |

```ts
import { checkDiagnostics, parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 floor:オーク
import ./finish.muro`,
  "finish.muro": `over /L1/a floor:タイル`,
}, "main.muro");

console.log(m.version, m.versionDeclared);
for (const d of checkDiagnostics(m)) console.log(d.code, d.severity, d.message, `(${d.file}:${d.line})`);
```

```text
0.5 true
VER04 error A koyu 0.5 file uses a 1.0 word: over /L1/a floor:タイル (a composition override) — raise the version to koyu 1.0 (finish.muro:1)
```

**The source is the layer that wrote the word.** `main.muro` declared the version, but the complaint points at line 1 of `finish.muro` — which is where the fix belongs.

**The version is declared once, in the base layer.** It is not something that can appear anywhere in a composition.

## When the version rises

A change to the meaning of the language raises the language version. So **a new entry in this array means meaning moved.** Conversely, a package release on its own never changes how a `.muro` is read.

The bundled buildings under `examples/` are always written at the newest version.

## See also

- [Writing the version](../muro/version.md) — how to write `koyu <version>`
- [Canonical JSON](canonical.md) — the format version and the `koyu` key
- [Diagnostics reference](../diagnostics/index.md) — fixing `VER01` through `VER04`
