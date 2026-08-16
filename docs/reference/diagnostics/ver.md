---
title: VER — the language version
mode: reference
---

# VER — the language version

All VER codes are errors.

| Code | Severity | What it says |
|---|---|---|
| VER01 | error | A koyu 0.1 file has a touching pair with no boundary declared |
| VER02 | error | A koyu 0.3-or-earlier file has a habitable-room type with no `daylight` |
| VER03 | error | A koyu 0.4-or-earlier file uses 0.5 vocabulary |
| VER04 | error | A koyu 0.5-or-earlier file uses 1.0 vocabulary |
| VER05 | error | a koyu 1.0-or-earlier file writes exterior / void in the type position |
| VER06 | error | The file declares a version newer than this build reads |
| VER07 | error | The file declares a version in which a key it writes is retired |

**VER06 is the one that points at the tool rather than the file.** Five of the others say the same kind of thing — this file is written in an old version, and reading it under a newer one would change what it means. VER06 says the opposite: the file is fine and the reader is behind.

**VER07 reads those five from the other end.** They fire when a file declares an old version and writes a word that version does not yet have; VER07 fires when a file declares a new version and writes a word that version no longer has. Both say the same thing: the declared version and the vocabulary have to agree.

## Declaring the version

```muro-part
muro 1.3
```

These versions are accepted: **0.1 / 0.2 / 0.3 / 0.4 / 0.5 / 1.0 / 1.1 / 1.2 / 1.3**. Anything else stops at the parser, before any semantic check runs.

```text
Unsupported koyu version: 0.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1, 1.2, 1.3)
```

The declaration is written **once**, in the base layer (the entry). By convention it goes on the first line. Writing it in an imported layer is an error — silent overwriting by composition order is forbidden.

**A file with no version declaration is read as 1.1, and always will be** ([the version line](../muro/version.md)). So VER01–VER05 never fire for it: those codes concern files that declare a version in order to pin their meaning to a point in the past.

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

## VER06 — the file is newer than this build of koyu {#ver06}

`error`

```muro-bad
muro 9.9
unit mm
```

```text
This file is written in muro 9.9, and this build of koyu (0.22.0) reads up to 1.3. The file is not the problem — upgrade koyu
```

**Cause** — the declared version is later than every version this build accepts. That is not a mistake in the file. Someone wrote it with a newer koyu, and this one has not learnt that language yet.

**The fix** — install a newer koyu. `koyu --version` says what this build reads:

```text
koyu 0.22.0 — reads muro 0.1–1.3 (newest 1.3; a file with no version line is read as 1.1)
```

**Why it is a separate code from an unreadable version.** A version that never existed is a different situation with the opposite advice, and it keeps the `SYN01` it always had:

```text
Unsupported koyu version: 0.6 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1, 1.2, 1.3)
```

Both used to print that second sentence, so nothing downstream could tell a stale build from a corrupt file without reading English prose. The split is *later than anything I know* against *not a version I have*, which is answerable; *real* against *fake* is not, and `9.9` is treated as the future because that is the more useful of the two readings.

**This one is raised while reading the file, not while checking it.** A version this build cannot read is a version it cannot parse under, so it stops at parse time and `check --json` reports it as the single diagnostic — the same path `SYN01` takes.

## VER07 — the file declares a version in which a key it writes is retired {#ver07}

`error`

```muro-bad
muro 1.3
grid X 0 4000 8000
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ use:exclusive
space /L1/A/ldk ldk X1..X2 Y1..Y2 name:LDK
```

```text
✖ ver07.muro:line 5: A muro 1.3 file carries use: on zone /L1/A — use is retired after muro 1.2. Write a namespaced key of your own (lease.category:, fire.compartment:, dept.name:) instead, or keep the file at muro 1.2
```

**Cause** — `use` is retired after muro 1.2. It was never an architectural use: it held one grouping per space, so a tenancy, a fire compartment and a department all competed for the same key, and whichever you wrote shut the others out. A room's purpose is the [type position](../muro/space.md); every other division of the building is a namespaced key, and a space may carry as many of those as it likes.

**The fix — write a namespaced key of your own.** The name is yours; core reads none of them.

```muro
muro 1.3
grid X 0 4000 8000
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ lease.category:exclusive fire.compartment:c3
space /L1/A/ldk ldk X1..X2 Y1..Y2 name:LDK
```

[`koyu stats --by <key>`](../cli/stats.md) totals floor area by any key you name, so the figures `By use:` used to give come back the moment you ask for them — and so do the ones it could never give.

**The other way out is to keep the file at muro 1.2.** A file that declares 1.2 or earlier goes on writing `use:`, goes on inheriting it from its zones, and goes on meaning exactly what it meant. Nothing migrates on its own.

**Why the key stays in the ledger.** Taking the row out of `ATTR_LEDGER` would make `use:` unknown at *every* version at once, because the ledger check does not read the version — so a muro 1.1 file would start failing with [ATT03](att.md#att03) for a word 1.1 legitimately has. The row is what keeps the old reading alive; VER07 is what stops the new one.

## Why declare a version at all

With no declaration a file is read as 1.1 and stays there, so VER01–VER05 never fire. **You declare a version for one of two reasons: to pin a file's meaning to a point in the past, or to opt into semantics newer than 1.1.** Having pinned it, mixing in newer vocabulary gets stopped — which is what those five codes are for.

Put the other way round: **when you want to use newer notation, raising the version is the correct fix.** Every message shows you that one line.

## Related

- [DAY — the daylight scope](./day.md) — the declaration VER02 points at
- [RUN — vertical circulation](./run.md) / [LIN — drawn lines](./lin.md) / [COL — columns](./col.md) — the 0.5 words VER03 points at
- [SYN — syntax and composition](./syn.md) — unsupported versions, declaring twice, declaring outside the base layer
- [koyu check](../cli/check.md)
