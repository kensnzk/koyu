---
title: Errors
mode: reference
---

# Errors

```ts
import { SourceError, srcRef } from "@kensnzk/koyu";
```

## Only parsing throws

**The only things that throw are the [five parse functions](parsing.md) and [the drawing functions](draw.md).**

| Surface | How failure arrives |
|---|---|
| `parse` `parseFiles` `parseWith` `parseFile` `parseFileWith` `tokenize` | throws a `SourceError` |
| `svgPlan` `svgAxo` | throws a plain `Error` (no position) |
| `checkDiagnostics` `check` | **never throws.** Always a `Diagnostic[]` / `CheckResult` |
| `validate` | **never throws.** Always a `Finding[]` |
| `placeOpening` `placeBand` | **never throw.** A `BandError` comes back as a value |
| `newUids` | a `RangeError` on a bad argument |

**"I could not read it" and "I read it and it contradicts itself" arrive differently.** The first stops with an exception; the second is a list of diagnostics.

## SourceError

```ts
class SourceError extends Error {
  line: number;    // the source line
  raw: string;     // the body without position information
  file?: string;   // the source layer under composition (a resolved absolute path)
  // name is "SourceError"
  // message is `${file ? file + ":" : ""}line ${line}: ${raw}`
}
```

Syntax errors and composition errors arrive this way. **`message` is the finished sentence; `raw` is the body without the position prefix.** To format it your own way, use `raw`, `line` and `file`.

```ts
import { SourceError, parse } from "@kensnzk/koyu";

try {
  parse("grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X9 Y1..Y2");
} catch (e) {
  if (e instanceof SourceError) {
    console.log({ name: e.name, line: e.line, raw: e.raw, file: e.file, message: e.message });
  }
}
```

```text
{
  name: 'SourceError',
  line: 4,
  raw: 'Undefined grid line name: X9',
  file: undefined,
  message: 'line 4: Undefined grid line name: X9'
}
```

Go through composition and `file` is filled in.

```ts
import { parseFile } from "@kensnzk/koyu/node";

try { parseFile("examples/house/L1.muro"); } catch (e) {
  if (e instanceof SourceError) console.log(e.message.replace(process.cwd() + "/", ""));
}
```

```text
examples/house/L1.muro:line 3: Undeclared level: level:L1
```

Only one layer of a split building was read, so the `level` declared in the base layer is missing. **What you pass is always the one entry file.**

`file` holds the **resolved absolute path** (the output above strips the working directory for readability). It is the same value as the `file` field on a diagnostic.

### Files that could not be read

A failure to resolve an `import` is also a `SourceError`.

| `raw` | `line` | When |
|---|---|---|
| `Cannot read file: <entry>` | `0` | the entry itself cannot be read |
| `Cannot read file: <ref>` | the line of the `import` | a layer along the way cannot be read |

Importing a key absent from the table in `parseFiles`, and a loader throwing in `parseWith`, both arrive in this shape. **Only the entry failure carries line 0** — nothing could be read, so there is no line to blame.

### Copying into a diagnostic

`koyu check --json` catches this exception and copies it into a diagnostic coded `SYN01`. **The API does not** — an exception is caught as an exception.

```ts
import { SourceError, checkDiagnostics } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

function readAndCheck(path: string) {
  try {
    return { ok: true as const, diagnostics: checkDiagnostics(parseFile(path)) };
  } catch (e) {
    if (e instanceof SourceError) {
      return { ok: false as const, line: e.line, file: e.file, message: e.raw };
    }
    throw e;
  }
}
```

## srcRef

```ts
function srcRef(line: number, file?: string): string
```

A small helper that spells a position in the same format, for diagnostics and for errors of your own.

```ts
import { srcRef } from "@kensnzk/koyu";
console.log(srcRef(12), "|", srcRef(12, "L1.muro"));
```

```text
line 12 | L1.muro:line 12
```

A `SourceError`'s `message` is exactly this format followed by the body.

## Exceptions from drawing

`svgPlan` and `svgAxo` throw a **plain `Error`**. It is not a `SourceError`, so it has neither `line` nor `file`.

| Message | When |
|---|---|
| `No level is defined` | `svgPlan` with no `level` and a model with no level |
| `There is no space with a region on level <name>` | `svgPlan` on a level with no space that has a region |
| `There is nothing to draw` | `svgAxo` when no solid is generated |

**Uncaught, these become raw stack traces.**

## See also

- [Parsing and composition](parsing.md) — the five entrances that throw
- [Diagnostics](diagnostics.md) — how the non-throwing side reports
- [Drawing](draw.md) — the other surface that throws
