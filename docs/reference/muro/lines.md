---
title: How a line is read
mode: reference
---

# How a line is read

**One line, one statement.** A line of `.muro` has the shape

```text
keyword positional… key:value…
```

The only state the reader carries is "what was the last non-indented line" — there are no brackets, no terminators, no nesting. This page covers how that line is split into tokens and turned into values. For which lines exist at all, see [every construct](index.md); for how positions are spelled, [positions and regions](positions.md); for the rules on attribute keys, [the three tiers of attribute](attributes.md).

```muro
muro 1.2
name   街角   の 複合ビル
unit mm

grid X 0 6400 12800
grid Y 0 5600

level L1 0 h:2700 slab:200

space /L1/ldk  ldk  X1..X2 Y1..Y2 name:"居間 と 食堂" acme.note:"#3 と #4"
space /L1/hall hall X2..X3 Y1..Y2 name:玄関           # a trailing comment
space /out     name:外部 outside:1

boundary /L1/hall /out t:150 spec:EW1
  door w:900 h:2100 edge:S name:玄関戸
```

## Tokens

**Whitespace separates tokens, and any amount of it does.** The columns above are aligned to be read; the meaning does not change. A tab is whitespace too. Blank lines are ignored.

**There is no line continuation.** No trailing `\`, no folding onto the next line. A long line stays long — if you want to split the work, split it into layers and compose them with `import`.

**Positional arguments carry meaning by order.** In `space /L1/ldk ldk …` the first is the path and the second is the type; swap them and you get a different building or an error. How many positionals there are, and what they mean, differs per keyword.

## Comments

**A `#` outside quotes runs to the end of the line.** At the start of a line it erases the line; at the end it erases the tail.

```muro-part
# this whole line is a comment
space /L1/hall hall X2..X3 Y1..Y2 name:玄関   # and everything from here
```

To keep a `#` as part of a value, quote it. The value of `acme.note:"#3 と #4"` is `#3 と #4`.

## Quotes

**`"` is a toggle, not a wrapper.** It may appear anywhere inside a token, and between a pair of them whitespace and `#` become ordinary characters. The quote marks themselves do not survive into the value.

| Written | Value |
|---|---|
| `name:"居間 と 食堂"` | `居間 と 食堂` |
| `name:南"の"部屋` | `南の部屋` |
| `acme.note:"#3 と #4"` | `#3 と #4` |
| `h:"2400"` | the number `2400` — quoting does not stop numeric reading |

**An unclosed quote is an error.** If one is still open at the end of the line, the file stops with `Unclosed quote`.

## Indentation

**A line that begins with whitespace is subordinate to the non-indented line above it.** The depth carries no meaning — there is one level and no nesting. One space is enough to subordinate; none at all starts a new parent.

| Parent | Indented lines it takes |
|---|---|
| `boundary` | `door` `window` `seg` `line` |
| `stack` | `door` `window` `seg` — a `line` cannot be drawn on a vertical boundary, so it gives `LIN02` |
| `space` | `area` |
| `band` | `space` (a band member — it carries `w:` instead of a region) |
| `over` | `+` `-` `=` |

Indenting under a line that is not a parent is an error, and so is a word the parent does not take. Only `+`, `-` and `=` may sit directly under `over`; an indented `door` there does not pass.

**When the parent expands to several targets, the indented line reaches all of them.** A `door` under `boundary /L3..L10/a /L3..L10/b` hangs one leaf on each of eight storeys, and an opening or a `seg` under `stack` reaches every vertical boundary in the stack — where openings are not interpreted, so `check` says so as a warning.

## key:value

**The key is everything left of the first `:`; the value is what follows.**

- An empty value is an error — there is no bare `name:`
- An empty key is an error — `:x` cannot be read
- **The same key twice on one line is an error.** Letting the later one silently win hides typos and merge accidents

**The spelling decides the type.** A value matching `-?\d+(\.\d+)?` exactly becomes a number; anything else stays a string.

```text
h:2400        → the number 2400
h:2400.5      → the number 2400.5
h:24OO        → the string "24OO"  (those are letter O's)
name:0123     → the number 123     (the leading zero is gone)
uid:0123      → an error — a uid may not be a token of digits alone
```

A value that fails to read as a number where a number belongs never falls silently to a default. It stops on the spot with `The attribute h is written as a number: 24OO`, or it comes back as `ATT01` — see [the three tiers of attribute](attributes.md).

**Keys cannot be invented freely.** A key that is not in the ledger must carry a namespace (a dotted key such as `acme.note`); without one it is `ATT03`. Again, [the three tiers of attribute](attributes.md).

## Telling positionals from attributes

The parser sorts tokens by whether they contain `..`, start with `/`, or contain `:`. In almost every line the order is therefore free — `space /L1/a room name:居室 X1..X2 Y1..Y2` reads exactly like the version with the region first.

**There is one exception. The first non-`key:value` token on an opening is an asset reference, not a name.**

```muro-part
asset SD1 door w:800 h:2000 style:sliding name:片引き戸

boundary /L1/a /L1/b
  door SD1 at:0.3        # refers to the asset SD1
  door w:900 name:D2     # a name goes in name:
```

Write `door D2 w:900` and you are told that the asset D2 is undefined. **A name always goes in `name:`.**

## Normalisation and provenance

**The source is read as NFC.** `が` can be spelled as one code point or as "か + combining mark". Without normalising, two paths that look identical become two different spaces — with no duplicate-path error — and the machine format ends up with two indistinguishable keys. NFKC is not used: it would rewrite `㎡` and `①`, and that would not preserve what was written.

**Errors name the line.** Every diagnostic that has a position is printed as `<file>:line <N>: <message>`. When layers are composed, `<file>` is the file that wrote the line, not the entry.
