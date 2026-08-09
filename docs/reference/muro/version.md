---
title: koyu — the version line
mode: reference
---

# koyu — the version line

```muro-part
koyu 1.1
```

**One line declaring which version of the semantics this file is read under.** These are the accepted versions, and the order is the order of old to new.

```text
0.1   0.2   0.3   0.4   0.5   1.0   1.1
```

**Omitted, the file is read as `1.1` — and always will be.** The reading of an undeclared file is frozen; it does not follow the newest version.

That is a promise about the future, so it is worth saying plainly: **when a version later than 1.1 exists, a file with no version line will still be read as 1.1.** Newer semantics are opt-in, and the way you opt in is by naming the version.

It used to follow the newest, which meant an undeclared file was re-read under new semantics every time the tool moved, silently — nothing reports the absence of a declaration. The 1.0 → 1.1 move stopped reading `exterior` out of the type position, and undeclared files written in the old dialect lost their outside spaces without a word. Freezing removes that rather than warning about it.

The cost is the same statement from the other side: **an undeclared file never gets new notation.** Write the line to move forward.

## Newer means later in that list, not later in the alphabet

**`1.1` is newer than `0.5`.** Compared as strings, `"0.5" > "1.0"`, so leaving the comparison to the spelling would make the newest version look like the oldest. The order is always decided by the index in the list above.

## How the line is written

Exactly two tokens: `koyu <version>`.

| Written | Result |
|---|---|
| `koyu 1.1` | accepted |
| `koyu` | `koyu takes a version: koyu 1.1` |
| `koyu 1.1 latest` | `Extra tokens on the koyu version declaration: latest` |
| `koyu 0.6` | `Unsupported koyu version: 0.6 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1)` |

**It is declared in the base layer only, and only once.**

- In any other layer: `The koyu version is declared only in the base layer (the entry)`
- Twice: `The koyu version is declared once (already 1.1)` — **declaring the same version twice is also an error.** The discipline matches `grid`: it forbids a silent override decided by composition order
- The position in the file is free; it need not be the first line

## An older version is accepted only where the meaning is preserved

**A file that declares an older version passes only if it means the same building it meant to a processor of that version.** Where the same text would mean a different building, `check` stops and offers two ways out — write the meaning explicitly, or raise the version.

Four diagnostics say this. All four are errors, and `check --json` carries the code.

### VER01 — a default boundary is derived under 0.1

From `0.2` onward, a touching pair of spaces with regions on the same level gets a derived `wall` boundary when none is declared. In a file declaring `0.1`, such a pair means a different building depending on whether the boundary exists.

```text
A koyu 0.1 file has a touching pair with no declared boundary: /L1/a | /L1/b — in 0.2 a
default wall is derived and the meaning changes. Declare the boundary, or raise the
version to koyu 0.2
```

**The fix**: declare the boundary, or raise the version to `koyu 0.2` or above.

### VER02 — daylight scope was inferred from the type before 0.4

Up to `0.3`, the types `unit`, `room`, `ldk`, `bedroom` and `living` were inferred to be in scope for the daylight check. From `0.4` the scope is the declaration `daylight:1` alone, so a space of one of those types with no `daylight` silently drops out of the check the moment the version is raised.

```text
A koyu 0.3 file has a room with no daylight: /L1/a — 0.4 does not infer the daylight scope
from the type, so it falls out of the check. Write daylight:1 (in scope) or daylight:0
(out of scope), then raise the version to koyu 0.4
```

**The fix**: write `daylight:1` (in scope) or `daylight:0` (out of scope), then raise the version to `koyu 0.4` or above.

### VER03 — a 0.5 word in a file declaring 0.4 or older

A processor of `0.4` or earlier does not know the words introduced in `0.5`. Where it does not know the word, the shape is simply never generated. There are five.

| Word | Where it is written |
|---|---|
| `stair:` `ramp:` `escalator:` `lift:` | a vertical circulation on a space |
| `line` | a drawn line under a boundary |
| `column` | a column declaration |
| `underground:` | a level below ground |

```text
A koyu 0.4 file uses a 0.5 word: /B1/st carries stair: (a vertical circulation) — raise the
version to koyu 0.5
```

**The fix**: raise the version to `koyu 0.5` or above.

### VER04 — a 1.0 word in a file declaring 0.5 or older

A processor of `0.5` or earlier does not know the composition words introduced in `1.0`. **It cannot read those lines as words at all, so neither the override nor the removal happens — it silently becomes a different building.** There are three.

| Word | What it does |
|---|---|
| `over` | overrides a space, zone, boundary, level or asset |
| `drop` | removes a space, a boundary or a column declaration |
| `+` `-` `=` under `over` | adds to, removes from, or replaces a member of a set (openings, `seg`, `area`) |

```text
A koyu 0.5 file uses a 1.0 word: over /L1/a name:居室 (a composition override) — raise the
version to koyu 1.0
```

**The fix**: raise the version to `koyu 1.0`.

## What the version covers

The version belongs to **the language, its semantics and the rules of composition**. It promises that what could be read under this version stays readable with the same meaning, and it is counted separately from the version of the implementation. Therefore:

- A change to what the language means raises the version. The same text never starts meaning a different building without one
- **Adding a judgement does not move it.** Rules about architectural validity live on the `koyu validate` face, and adding one changes the meaning of no existing file
- Drawing is not covered either. The look of the SVG produced from the same shape may change

The bundled examples are always written at the newest version. A change that raises the version brings the examples along in the same change.
