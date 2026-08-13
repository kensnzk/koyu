---
title: SYN — syntax and composition
mode: reference
---

# SYN — syntax and composition

There is only one SYN code.

| Code | Severity | What it says |
|---|---|---|
| SYN01 | error | A syntax or composition error |

**SYN01 is not an individual code.** It is a copy, gathered into one, of the exception the parser threw. Since the file never became a model, not one semantic check ran — with even a single syntax error, the result of `check` is exactly "one SYN01".

## It appears only under --json

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X9 Y1..Y2
```

```sh
koyu check bad.muro --json
```

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: X9",
  "line": 4,
  "file": "<absolute path>/bad.muro"
 }
]
```

A `check` without `--json`, and every other subcommand, print the exception as-is and exit 1.

```sh
koyu check bad.muro
```

```text
✖ <absolute path>/bad.muro:line 4: Undefined grid line name: X9
```

The single SYN01 exists only **so that valid JSON can still be returned**. A machine running `check --json` should not have syntax errors come back in a different shape from everything else.

## Common bodies and their fixes

### Grids and levels

| Body | Cause | Fix |
|---|---|---|
| `Undefined grid line name: X1` | `grid X` has not been written yet | Write `grid X` / `grid Y` **before** any line that uses a grid line. `grid` and `level` cannot be forward-referenced (a `boundary` can) |
| `Undefined grid line name: X9` | That grid line exceeds the number in the grid | With `grid X 0 3600 7200` only X1–X3 exist |
| `grid coordinates are written in ascending order` | The coordinates descend | Reorder them ascending |
| `grid X is declared once (in the base layer when composing)` | Several layers carry `grid X` | Consolidate into the base layer (the entry) |
| `Undeclared level: level:L9` | What `level:` points at does not exist | Declare `level L9 …`, or fix the spelling |
| `Duplicate level: L2` | The same level name declared twice (including a clash with a range declaration) | Delete one |
| `The level height (z) is not a number:` | No z was written, as in `level L1` | `level L1 0` |
| `A level range requires pitch: (the storey height in mm): L1..L3` | A range declaration with no storey height | `level L1..L3 0 pitch:3000` |
| `level carries spec:, which is not in the ledger (level reads h / slab / pitch / underground)` | An unknown key on `level` | `level` reads only those four. Put other information on a space or a zone |
| `The range includes an undeclared level (declare level first): L1..L2` | A `stack` or `column` naming an undeclared level | Write the `level` first |

### Spaces, boundaries, zones

| Body | Cause | Fix |
|---|---|---|
| `A region is given as two ranges, X?..X? and Y?..Y?` | A region needs **two** ranges, one on X and one on Y, and only one is written | Write the other axis: `space /L1/a room X1..X2 Y1..Y2`. **A forgotten type is not the cause** — the type is optional |
| `space /L1/a requires a type (a word from the vocabulary)` | Neither type nor region | Add the type |
| `Duplicate space path: /L1/a (first seen …)` | Two spaces at the same path | The path is the identity. Change one of them |
| `boundary takes the form boundary /pathA /pathB [attributes...]` | The second path is missing | A boundary is a relation joining two spaces |
| `zone takes the form zone /path [attributes...]` | No path | |
| `Unknown keyword: wall` | That keyword does not exist | A wall is a relation, not a thing. Use `boundary` |
| `The attribute h is written as a number: 24OO` | A numeric attribute on `level` does not read as a number | Write a number with no unit |

### Indentation

Openings, `seg` and `line` are written **indented** under a boundary; `area` and band members under a space.

| Body | Cause | Fix |
|---|---|---|
| `Unknown keyword: door` | The `door` line is not indented | Put whitespace at the head of the line so it is subordinate to its `boundary` |
| `door is written indented directly under boundary` | It is indented, but the preceding unindented line is not a `boundary` | Make the parent a `boundary` (the case above had it under a `space`) |
| `area is written indented directly under space` | The indented `area`'s parent is not a `space` | |
| `Only door / window / seg / line / area / space (a band member) may sit on an indented line: note` | Some other word on an indented line | Only those six may be indented |
| `Only + (add) / - (remove) / = (replace) may sit directly under over: door` | Something other than a set edit under `over` | Write it as `- door D1` |
| `One boundary carries one line: /L1/a \| /L1/b` | A second `line` under one boundary | Split it into two boundaries |

### Openings and attributes

| Body | Cause | Fix |
|---|---|---|
| `door requires a width w:(mm) (the asset may supply it)` | The opening has no `w:` | Write `door w:800`, or reference an asset that carries a width (`door SD1`) |
| `Duplicate attribute key: name` | The same key twice on one line | Consolidate into one. The later one is never silently taken |
| `Unclosed quote` | An odd number of `"` | Close it |
| `An attribute is written key:value: 居室` | A token with no `:` is in an attribute position | Make it `key:value`. To include whitespace in a value, wrap it in `"…"` |

### Versions and composition

| Body | Cause | Fix |
|---|---|---|
| `Unsupported koyu version: 0.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 1.1, 1.2, 1.3)` | A version that does not exist | Use one the parser accepts |
| `The koyu version is declared only in the base layer (the entry)` | A version in an imported layer | Move it to the base layer |
| `The koyu version is declared once (already 1.0)` | The version written twice | Delete one |
| `Cannot read file: ./assets.muro` | The `import`'s relative path is wrong | A path is resolved **relative to the file it is written in** |

## How far misspellings are caught

**A misspelled attribute key is caught.** `nmae:居室A` is not carried through as a free attribute; it is an [ATT03](./att.md) error. A key not in the ledger cannot be written without a dot-separated namespace (`acme.nmae`).

**A misspelled type (the second positional) is not caught.** The type is an open vocabulary, so writing `bedroom` as `bedrom` is not an error.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a bedrom X1..X2 Y1..Y2
```

That file is green. A type is used for little more than an aggregation axis and the paleness of a drawing, and **core never reads that position at all**, so there is nothing to close.

**Facts of composition are not kept in the type position.** Outside, void and daylight all live in a declaration — `outside:1`, `void:1`, `daylight:1` are keys in the [ledger](../muro/attributes.md), so one character off stops at [ATT03](./att.md#att03). `outsid:1` is an error; nothing quietly stops being outside. It used to be otherwise: `exterior` sat in the type position, and `exteriorr` doubled the gross floor area while passing green.

The [validation](../validate/index.md) face does read a few type words when it judges. That face **does not freeze**, and its spellings are not guarded ([scope](../scope.md)).

## The real work starts once syntax passes

SYN01 disappearing means only that the file became a model. From there the semantic checks — the other 67 codes — run.

```sh
koyu check house.muro --strict
```

`--strict` makes warnings exit 1 as well. That is the one to put in a CI gate.

## Related

- [ATT — attributes](./att.md) — misspelled attribute keys (ATT03)
- [VER — the language version](./ver.md) — the four checks that run once the version is accepted
- [LIN — drawn lines](./lin.md) — a second `line`
- [koyu check](../cli/check.md)
