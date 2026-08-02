---
title: band — dividing a space by dimension and order
mode: reference
---

# band — dividing a space by dimension and order

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

`band <axis> <X?..X?> <Y?..Y?>`, with indented `space` lines beneath it. **A band writes dimension and order rather than position.** The position is derived from them.

It helps to see it as the horizontal counterpart of stacking up [levels](level.md). Just as a section is built by stacking storey heights instead of writing `level L1 0` and `level L2 3400`, a band is built by listing widths instead of writing `X1..X2` and `X2..X3`.

Bands coexist with regions and neither is imposed. The six lines above give **the same model** as this.

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/hall hall X2..X3 Y1..Y2 name:玄関
```

## The band line

| Position | Meaning |
|---|---|
| 1st positional | The direction of division. `X` = west to east, `Y` = south to north. The same spelling as in `grid X 0 6400 …` |
| 2nd and 3rd positionals | The extent of the band: one `X?..X?` and one `Y?..Y?`, in either order, with the same lexis as a [space](space.md) region |

**No `key:value` may be written on this line.** A band does not survive into the model, so there is nowhere for an attribute to live. Attributes go on the member `space` lines.

```text
✖ b4.muro:line 4: Only the axis and the extent may be written on a band line (attributes go on the member space lines): name:帯
```

A `+` union cannot be written either. A band divides one rectangle in one direction.

### The extent is written ascending

On a space region, `X2..X1` is another spelling of the same rectangle and is normalized to ascending order. **On a band, a descending spelling is refused.** The order of the members carries meaning — the one written first lands on the low-coordinate side — so quietly normalizing the spelling would quietly reverse the order.

```text
✖ b1.muro:line 4: A band range is written in ascending order (members run west to east / south to north): X3..X1
```

## Members

An indented `space` line is a member of the band. Apart from carrying a width `w:` in place of a region, it is an ordinary `space` line: path, type, attributes and level spans are all written as usual.

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

- `w:` is **the dimension along the band's direction**, in mm. It is relative to the axis, so it is neither always a width nor always a depth. The value is a positive integer or `rest`; decimals cannot be written.
- A member cannot carry `level:`. A band is one run on one level.
- A member cannot carry an [area](area.md). A member's region is derived, so an extent inside it cannot be written in advance.
- When a member carries a level span, **all members must expand onto the same level**.

```text
✖ b8.muro:line 5: level: may not be written on a band member (a band is a run on one level): level:L1
✖ b9.muro:line 6: area may not be written on a band member (its region is derived — write a room that needs area by position)
```

`w:` cannot be written on a `space` outside a band. That refusal is what stops a member whose indentation was lost from passing silently as "a space with no region".

```text
✖ b5.muro:line 4: w: may not be written on space (a space written by width sits indented under band)
```

## A closed band is the default

**Every member carries a dimension, and the parser reconciles their sum against the width of the band.** It is the same arithmetic as "the partial dimensions sum to the overall" on a drawing, and it is the only defence that catches a mistyped dimension where it was typed.

A sum that falls short is an error.

```muro-bad
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600
  space /L1/hall hall w:1000
```

```text
✖ b2.muro:line 4: The dimensions sum to 4600mm against a band width of 5400mm, 800mm short (fix a dimension, or make one of them w:rest)
  /L1/ldk w:3600
  /L1/hall w:1000
```

A sum that overshoots is an error too.

```text
✖ b3.muro:line 4: The dimensions sum to 6000mm against a band width of 5400mm, 600mm over
  /L1/ldk w:4000
  /L1/hall w:2000
```

**There is no solver.** Additions and a single subtraction, in declaration order, always running from the low coordinate to the high one.

### w:rest — absorbing the remainder

Where the remainder is not a design decision, and only there, a member may be `w:rest`. At most one per band, at any position.

```muro-part
band X X1..X3 Y1..Y2
  space /L1/a room w:8000
  space /L1/b room w:rest
```

Two is an error.

```text
✖ b6.muro:line 7: Only one member per band absorbs the remainder (w:rest): /L1/b, /L1/c
```

So is a `rest` with nothing left for it, because a space of zero width is not a form.

```text
The other dimensions use up the band width of 5400mm, leaving zero for /L1/b (w:rest)
```

## Every fault is a parse error

A broken band produces not one rectangle. That is a problem of form, so no diagnostic code is reserved for it: a broken band stops in the parse. In `check --json` it surfaces as [SYN01](../diagnostics/syn.md).

## A band does not survive into the model

A band is expanded into ordinary spaces at parse time and **survives neither in the model nor in the canonical JSON**. A version written with bands and one written with positions give the same canonical JSON, so changing only the way it is written produces no difference.

```text
$ npx tsx src/cli.ts json band.muro
  "spaces": {
    "/L1/hall": {
      "type": "hall",
      "at": [
        "X2",
        "Y1",
        "X3",
        "Y2"
      ],
      "attrs": {
        "name": "玄関"
      }
    },
    "/L1/ldk": {
      "type": "ldk",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "name": "LDK"
      }
    }
  },
```

## How a derived cut is spelled — the floor rule

The expanded spaces are spelled as grid references. **Both ends of the band, and both ends across it, keep the spelling as written; only the interior cuts are spelled out.**

There is one rule for the interior: the offset from the largest grid line **at or below** the coordinate. An offset of zero leaves just the grid name, and a coordinate before the first grid line takes a negative offset.

```muro
grid X 0 6400 12800
grid Y 0 5600
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/a room w:8000
  space /L1/b room w:rest
```

The cut at 8000 is spelled `X2+1600`.

```text
$ npx tsx src/cli.ts json b7.muro
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2+1600",
        "Y2"
      ]
    },
    "/L1/b": {
      "type": "room",
      "at": [
        "X2+1600",
        "Y1",
        "X3",
        "Y2"
      ]
    }
  },
```

**A spelling that subtracts from the grid line above (`Y2-1800`) never arises from derivation.** Rewrite a region written in that idiom as a band and the geometry is identical while the spelling changes, which shows up in the semantic diff.

A derived cut that is not an integer number of millimetres is an error too — a position that cannot be spelled as a grid reference cannot be written.
