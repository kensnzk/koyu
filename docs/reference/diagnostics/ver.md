---
title: VER — the language version
mode: reference
---

# VER — the language version

There are four VER codes. All are errors.

| Code | Severity | What it says |
|---|---|---|
| VER01 | error | A koyu 0.1 file has a touching pair with no boundary declared |
| VER02 | error | A koyu 0.3-or-earlier file has a habitable-room type with no `daylight` |
| VER03 | error | A koyu 0.4-or-earlier file uses 0.5 vocabulary |
| VER04 | error | A koyu 0.5-or-earlier file uses 1.0 vocabulary |
| VER05 | error | a koyu 1.0-or-earlier file writes exterior / void in the type position |

## Declaring the version

```muro-part
koyu 1.1
```

These versions are accepted: **0.1 / 0.2 / 0.3 / 0.4 / 0.5 / 1.0 / 1.1**. Anything else stops at the parser, before any semantic check runs.

```text
Unsupported koyu version: 0.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1)
```

The declaration is written **once**, in the base layer (the entry). By convention it goes on the first line. Writing it in an imported layer is an error — silent overwriting by composition order is forbidden.

**A file with no version declaration is read under the latest semantics (1.1).** So no VER code ever fires for it. VER only concerns files that declare a version in order to pin their meaning.

## When an older version is accepted

**An older version is accepted only where the meaning is preserved.** When a newer implementation reads a file written against an older version, there are only two roads.

- Old and new mean the same thing — read it as written
- The meaning changes — **never read it silently under the new meaning**. Raise an error and present the two choices

The four VER codes stand at that second place. That is why every message takes the form "fix this, or raise the version".

## VER01 — a default boundary is derived under 0.1 {#ver01}

`error`

```muro-bad
koyu 0.1
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a hall X1..X2 Y1..Y2
space /L1/b hall X2..X3 Y1..Y2
```

```text
A koyu 0.1 file has a touching pair with no declared boundary: /L1/a | /L1/b — in 0.2 a default wall is derived and the meaning changes. Declare the boundary, or raise the version to koyu 0.2
```

**Cause** — under 0.1, "these touch but no boundary is declared" was a warning and no boundary grew. From 0.2 on, a pair of spaces touching in plan with no declared boundary between them derives **a default `wall` boundary**. An undeclared contact came to mean "wall" rather than "undefined". The same file becomes a different building depending on the version.

**Fix** — take one of the two choices the message presents.

- Read it under the new meaning → make the first line `koyu 0.2`
- Keep 0.1's meaning → write an explicit `boundary` for the pair named

This code's body mentions `0.2` because it is the rule that sits on the seam between 0.1 and 0.2.

## VER02 — a habitable-room type with no daylight under 0.3 {#ver02}

`error`

```muro-bad
koyu 0.3
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

```text
A koyu 0.3 file has a room with no daylight: /L1/a — 0.4 does not infer the daylight scope from the type, so it falls out of the check. Write daylight:1 (in scope) or daylight:0 (out of scope), then raise the version to koyu 0.4
```

**Cause** — up to 0.3, five types — `unit`, `room`, `ldk`, `bedroom`, `living` — were **inferred** to be in the daylight scope. From 0.4 nothing is inferred from the type ([DAY01](./day.md)). Raise the version without writing `daylight` and the space drops silently out of scope, and `koyu light` returns output indistinguishable from "every room passes".

**Fix** — say whether the space named is tested, then raise the version.

- It is tested → add `daylight:1`
- It is not (you meant a store, a closet, a non-habitable room) → add `daylight:0`
- Either way, make the first line `koyu 0.4` once you are done

A space that already carries `daylight` means the same thing in both versions, so this code does not fire for it.

## VER03 — 0.5 vocabulary in a 0.4-or-earlier file {#ver03}

`error`

```muro-bad
koyu 0.4
grid X 0 3000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
```

```text
A koyu 0.4 file uses a 0.5 word: /L1/s carries stair: (a vertical circulation) — raise the version to koyu 0.5
```

**Cause** — an implementation at 0.4 or earlier does not know the four words introduced in 0.5. It skips them, and **the shape is silently not generated**.

| 0.5 word | How the body names it |
|---|---|
| A vertical-circulation declaration (`stair:` `ramp:` `escalator:` `lift:`) | `/L1/s carries stair: (a vertical circulation)` |
| A drawn line (`line`) | `/L1/a \| /L1/b carries line (a drawn line)` |
| A column (`column`) | `column` |
| A basement (`underground:`) | `level B1 carries underground:` |

**Fix** — make the first line `koyu 0.5`. If you are not using the new words, 0.4 is fine as it is.

## VER04 — 1.0 vocabulary in a 0.5-or-earlier file {#ver04}

`error`

```muro-bad
koyu 0.5
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out yard
boundary /L1/a /out t:150
  door w:800 edge:S name:D1
drop /L1/b
over /L1/a /out
  - door D1
```

```text
A koyu 0.5 file uses a 1.0 word: drop /L1/b (a composition removal) — raise the version to koyu 1.0
A koyu 0.5 file uses a 1.0 word: over /L1/a /out (a composition override) — raise the version to koyu 1.0
A koyu 0.5 file uses a 1.0 word: - door D1 (a set edit under over) — raise the version to koyu 1.0
```

**Cause** — an implementation at 0.5 or earlier does not know the composition edits introduced in 1.0.

| 1.0 word | How the body names it |
|---|---|
| An override (`over`) | `a composition override` |
| A removal (`drop`) | `a composition removal` |
| A set edit under `over` (`+` `-` `=`) | `a set edit under over` |

The reasoning matches VER03, but the consequence is worse. An older implementation cannot read the line as a word at all: neither the override nor the removal happens, and **the file silently becomes a different building**.

**One diagnostic per edit.** The example has three edit lines, so three diagnostics.

**Fix** — make the first line `koyu 1.0`. If you are not using composition edits, 0.5 is fine as it is.

## VER05 — a 1.0-or-earlier file writes `exterior` / `void` in the type position {#ver05}

`error`

```muro-bad
koyu 1.0
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior name:外部
boundary /L1/a /out edge:S t:120
  door w:900
```

```text
A koyu 1.0 file writes exterior in the type position: /out — 1.1 reads no meaning from the type, so this space silently stops being outside (it becomes indoor floor area). Write outside:1 instead, then raise the version to koyu 1.1
```

**Cause** — up to 1.0, `exterior` and `void` written in the type position were read structurally. 1.1 **never reads the type position** ([space](../muro/space.md)). So the same bytes mean a different building: the exterior becomes indoor floor area, and a floor is generated in the void. Measured on the mixed-use example, the gross floor area went from 31,606.24 m2 to 33,004.00 m2.

That happens silently, which is why it is **an error and not a warning** — the same reasoning as the four codes before it.

**The fix** — the message offers two.

| Rewrite it | Or raise the version |
|---|---|
| `space /out exterior` → `space /out yard` | make the first line `koyu 1.1` |
| `space /L2/hole void X1..X2 Y1..Y2` → `space /L2/hole X1..X2 Y1..Y2 void:1` | |

The same code watches the other direction. Writing `outside:` / `void:`, or omitting the type, in a 1.0-or-earlier file is 1.1 spelling and is stopped just the same — the declared version and the vocabulary have to agree.

## Why declare a version at all

With no declaration a file is read under the latest semantics, and VER never fires. **You declare a version when you want a file's meaning pinned to a point in the past.** Having pinned it, mixing in newer vocabulary gets stopped — which is what these four codes are for.

Put the other way round: **when you want to use newer notation, raising the version is the correct fix.** Every message shows you that one line.

## Related

- [DAY — the daylight scope](./day.md) — the declaration VER02 points at
- [RUN — vertical circulation](./run.md) / [LIN — drawn lines](./lin.md) / [COL — columns](./col.md) — the 0.5 words VER03 points at
- [SYN — syntax and composition](./syn.md) — unsupported versions, declaring twice, declaring outside the base layer
- [koyu check](../cli/check.md)
