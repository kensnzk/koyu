---
title: Notation format comparison
mode: explanation
---

# Notation format comparison

"Couldn't this have been JSON or YAML?" is the first question. New syntax has a price — a parser, editor support, syntax highlighting, and the effort a reader spends learning it.

**It is a DSL anyway because one design criterion was fixed.**

> **Can an LLM read it in one context and correctly edit part of it?**

From that criterion follow being text-native, referring by human-readable hierarchical paths, being a set of small files rather than one enormous one, and declaring units and coordinate system once at the top. **And so does the authored format being a DSL.**

koyu does have a machine format — canonical JSON. **Two spellings sharing one semantics** is the design; JSON is not being refused ([Canonical JSON](../reference/json/index.md)).

## The same two rooms, written both ways

Here is the body of the bundled `two-rooms.muro`, comments removed.

```muro
koyu 1.0
name 二室
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B daylight:1
space /out exterior name:外部
boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000
boundary /L1/a /out t:150 spec:EW1 fire:60
  window w:2600 h:1100 edge:S name:腰窓
boundary /L1/b /out t:150 spec:EW1 fire:60
  door w:900 h:2100 edge:S name:玄関
  window w:2600 h:1100 edge:E name:腰窓
```

The same content written straightforwardly in YAML:

```text
koyu: "1.0"
name: 二室
unit: mm
grid:
  X: [0, 3600, 7200]
  Y: [0, 4500]
levels:
  - name: L1
    z: 0
    h: 2400
    slab: 150
spaces:
  - path: /L1/a
    type: room
    region: {x: [X1, X2], y: [Y1, Y2]}
    name: 居室A
    daylight: 1
  - path: /L1/b
    type: room
    region: {x: [X2, X3], y: [Y1, Y2]}
    name: 居室B
    daylight: 1
  - path: /out
    type: exterior
    name: 外部
boundaries:
  - a: /L1/a
    b: /L1/b
    t: 120
    spec: PW1
    openings:
      - kind: door
        w: 780
        h: 2000
  # …two more boundaries and three more openings follow
```

Measured with o200k_base:

| Format | Bytes | Lines | Tokens | vs DSL |
|---|---:|---:|---:|---:|
| DSL (body) | 496 | 16 | **220** | 1.0x |
| YAML (same content) | 947 | 61 | 414 | **1.9x** |
| Canonical JSON (machine format) | 2,164 | 140 | 729 | 3.3x |

**3.8× the lines and 1.9× the tokens.** And what has been added is not architectural information — it is `path:`, `type:`, `region:`, `openings:`, `kind:`, keys that exist only to spell out the structure.

## One line is one decision

What is decisive on the DSL side is not token count but **how the structure reads**.

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
```

**One line is one space, and one design decision.** The positional order (path, type, X range, Y range) is the order architecture says them in, and attributes follow.

Indentation carries containment.

```muro-part
boundary /L1/b /out t:150 spec:EW1 fire:60
  door w:900 h:2100 edge:S name:玄関
  window w:2600 h:1100 edge:E name:腰窓
```

**That the openings belong to the boundary is said by the indentation, not by an `openings:` key.** The structure — a relation, and intervals placed on it — is the shape on the page.

## Diagnostics can point at a line

This is what pays off most in practice.

```text
✖ b3.muro:line 7: Duplicate boundary: /L1/a | /L1/b (first seen at b3.muro:line 6)
```

**An error points at a file and a line.** The author looks at that line and fixes it. So does an agent: it receives a line number and rewrites that line.

YAML has line numbers too, but **the granularity of what can be pointed at differs.** If one space is spread over six lines, "this space is wrong" points somewhere among six lines. **With one line per decision, the granularity of the diagnostic matches the granularity of the decision.**

## The diff speaks the language of composition

Move one grid line.

```sh
npx tsx src/cli.ts diff tr-a.muro tr-b.muro
```

```text
± grid X X2 3600 → 4200
± /L1/a: area 16.20 m2 → 18.90 m2
± /L1/b: area 16.20 m2 → 13.50 m2
```

**"X2 moved, a grew, b shrank."** Not a list of coordinates.

That is not a direct effect of being a DSL, but it pairs with the decision to **write position as a grid reference**. In a format where raw coordinates can be written, moving one grid line changes dozens of coordinates at once and the diff becomes unreadable.

## Position is written in words

```muro-part
space /L1/a room X1..X2 Y1..Y2
  door w:900 at:X2+450 edge:S
```

`X2+450` means "450 mm from grid line X2". **Not a coordinate but the way the decision is stated.**

`X1..X2` is the same: "from grid X1 to grid X2". Move the grid line and the region follows; the source does not change by one character.

**A general-purpose format could express this** — write `"region": {"x": ["X1", "X2"]}`. But at that moment it is **a DSL embedded inside a general-purpose format.** Rather than hiding a private grammar inside strings, it reads better to put the grammar in the open.

## There are words that fold repetition

A large building has not many different things but **many of the same thing.** A DSL can carry words shaped to that fact.

```muro-part
level L4..L10 pitch:3000
space /L2..L9/A/ldk ldk X1..X3 Y1..Y2
band X X2..X4 Y4-3200..Y5
  space /L14..L19/s01 room w:5000 name:スイート01
  space /L14..L19/s02 room w:5000 name:スイート02
  space /L14..L19/s03 room w:rest name:スイート03
```

In the bundled complex, 21 levels of core come from 9 lines and 78 hotel rooms come from a 13-line band declaration ([Comparison with IFC and USD](vs-ifc.md)).

Doing this in a general-purpose format takes anchors and aliases, or an external templating mechanism. **And the folded result is then no longer readable by a YAML parser alone.**

**The entry criterion is explicit — only deterministic expansion gets into the notation.** Only what contains no choice and no conditional. "The corridor is 1.8 m; divide the remainder equally among dwellings" is deterministic and gets in. "Put the dwellings as far south as possible" is optimisation and does not — an agent solves that and writes the solution into the source. **Formulae get in; macros do not.**

## The machine format is separate

**Because the authored format and the machine format are separated**, the price of being a DSL is small.

| | Authored (`.muro`) | Machine (canonical JSON) |
|---|---|---|
| Who reads it | humans and LLMs | programs |
| What it holds | the written composition | the result of composition |
| Version | the language version | the spelling version |
| Stability | write it however you like | **same input, same bytes** |

An outside tool that wants to read koyu reads the canonical JSON. **It never has to implement a private grammar.**

## The price

Stated honestly.

- **You write the parser yourself.** koyu has zero runtime dependencies, so it is hand-written.
- **You provide editor support yourself.** There is one syntax-highlighting grammar definition, and tests bind it to the implementation and the ledger.
- **Readers must learn the syntax.** The amount is small — 16 kinds of unindented line and 9 kinds of indented line, with no nesting, no brackets and no terminators ([The whole syntax of .muro](../reference/muro/index.md)).
- **General-purpose tooling (YAML linters, schema validation) does not apply.** In its place `check` carries 65 diagnostics.

**Whether that price is worth paying is judged against the design criterion.** A whole building fits in one context, an agent can edit it line by line, and diffs read in the language of composition — if those three hold at once, the choice pays.

## Next

- [Canonical JSON](../reference/json/index.md) — the machine format
- [The whole syntax of .muro](../reference/muro/index.md)
- [Comparison with IFC and USD](vs-ifc.md)
- [koyu diff](../reference/cli/diff.md)
