---
title: Canonical JSON
mode: reference
---

# Canonical JSON

**This is the definition of "what makes two buildings the same", written down.**

A source file (`.muro`) is free in its line order and its spelling, so whether two files are the same building is not decided by the text. The canonical form gives that question one answer — **the same composition always yields the same bytes; a different composition always yields different bytes.**

```sh
npx tsx src/cli.ts json examples/two-rooms.muro
```

```json
{
  "format": "koyu-canonical/2.0",
  "muro": "1.2",
  "name": "二室",
  "unit": "mm",
  "grid": {
    "X": [
      0,
      3600,
      7200
    ],
    "Y": [
      0,
      4500
    ]
  },
  "levels": {
    "L1": {
      "z": 0,
      "h": 2400,
      "slab": 150
    }
  },
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "daylight": 1,
        "name": "居室A"
      }
    }
  }
}
```

(The real output continues. The key-by-key listing is in [the schema](schema.md).)

## Two uses

**One: a yardstick for checking that the semantic diff is right.** Asking `koyu diff` whether it is correct proves nothing, so an independent judgement is needed. The tests are written against this.

**Two: an exit for programs that have no `.muro` parser.** Outside viewers, exporters, and the MCP tool `canonical_json` read it.

**It is not a foundation.** The semantic diff takes a Model and never goes through the canonical form. Layer composition happens over the layers of `.muro`, and canonicalisation comes after. **There is no reader, and the only way into the system is `parse`** — a deliberate choice that there be one original.

## Two versions — of the format and of the language

The first thing the document announces is **the version of the format itself**. `koyu` comes next, and it is [the version of the language](../muro/version.md), not of the format.

| Key | Version of what | Raised when |
|---|---|---|
| `format` | **the spelling of canonical JSON** — the set of keys, their order, the collation, the normalisation, the spelling of numbers. Currently `koyu-canonical/2.0` | minor when a key is added; major when an existing spelling changes |
| `muro` | **the language version of the source**, passed through. **Absent if it was not written.** Spelled `muro` whatever word the source used — a file written `koyu 1.1` still says `"muro": "1.1"` | when the semantics of the language change |

They are separate because **the same semantics can be respelled with different keys**. Adding the `a` key, which preserves the written direction of a boundary, changed the spelling without changing one word of the language. The converse also happens: a language version can rise without the spelling moving.

**A minor bump still moves the bytes of every document.** `format` is the first key there is, so a document that gains none of the new keys still gains a new first line. Nothing about a minor bump is invisible; what "minor" promises is that no *existing* key changed its name, its place or its spelling.

**A source with no version declaration gets no version stamped.** Stamping one would claim a version the author never wrote. A source that wants its version recorded here writes the line — `muro 1.2` from 1.2 on, `koyu 1.1` and earlier before it.

## Three stability rules

### 1. The same composition always yields byte-identical JSON

Keys of record shape (top level, level, space, boundary, opening, `seg`, column) sit in **a fixed order this schema defines**; keys that come from the source (level names, paths, asset names, attribute keys) sit in **collation order**.

- `spaces` — by path
- `boundaries` — lexicographic by `between`, ties broken by canonical content order
- `zones` / `assets` / `polygons` — by key

**Arrays whose declaration order carries no meaning are also sorted by canonical content** — openings, `seg`s, the union of regions, the endpoints of a drawn line. Writing the same composition with the lines in another order yields the same bytes.

**A column's grid names `x`/`y` are the one exception: they go in grid order** ([schema](schema.md)), not collation order. So `x:X11,X2,X10` becomes `["X2","X10","X11"]` — for a grid line, position is the order it was declared in, not the spelling of its name. Only names that were never declared fall back to collation order.

**`columns` is the exception. The declaration order of columns is meaning, so it is never sorted.** Two columns never stand on the same grid intersection and the earlier declaration wins, so swapping two lines changes which columns actually stand. Sorting them would give two different buildings identical bytes, and the whole reason this format exists would be lost for columns. **For an array whose order carries meaning, the canonical order is the declaration order itself.**

There is one question to ask before sorting anything: **would reordering this array make it a different composition?** If yes, do not sort. Sorting is not tidying; it is a claim that the order has no meaning.

### 2. It is the written composition, after composition

`import`, spans, `stack` and bands are expanded and do not remain.

**Default boundaries do not appear.** Touching spaces default to a wall, but canonical JSON holds only the written composition; the meaning — including the default wall — belongs to the derived model. **Consumers must apply `deriveDefaultBoundaries` before reading meaning.**

So "1 boundary" from `koyu check` and `"boundaries": []` from `koyu json` do not contradict each other. The first counts derived meaning, the second counts written composition.

### 3. Written notation is preserved

Positions stay as grid references (`"at": "Y2+1820"`), regions stay as four grid names, and the direction of a boundary is kept as the `a` key — the space written first, from whose side `edge` and `swing` are read. **The canonical form does not retell.**

The only exceptions are spellings that carry no meaning.

- A reversed region (`X2..X1`) is normalised to ascending coordinates
- The endpoint pair of a drawn line is canonicalised to ascending resolved coordinates (**a segment has no direction**). The spelling stays a grid reference
- The vertex list of a `polygon` is geometry (cyclic) and is never reordered

The interior split positions a band derives have no written spelling, so they are spelled by **the floor rule**: the offset from the largest grid line at or below that coordinate (just the grid name when the offset is 0). Both ends of the band, and both ends across it, stay exactly as written.

## The byte-level norms

"Byte-identical" in rule 1 only means something once these four are fixed. **An implementation written in another language emits the same bytes by following them.**

### Encoding

**UTF-8, LF line endings, two-space indent, one newline at the end of the document.** Non-ASCII is emitted raw, never escaped (`"name": "居室"`). The only escapes are the ones JSON demands (`"`, `\`, control characters).

### Collation

**Ascending code point, which equals ascending order of the emitted UTF-8 bytes.** Locale collation (`localeCompare` and friends) is not used.

**JavaScript's `<` and default `sort` cannot be used here.** They order by UTF-16 code unit, which does not agree with code point order.

```text
𠮟 (U+20B9F)  surrogate pair D842 DF9F   UTF-8: F0 A0 AE 9F
﨑 (U+FA11)   single unit                UTF-8: EF A8 91
```

Under `<`, 𠮟 sorts before 﨑; in UTF-8, 﨑 comes first. Both are real Japanese characters, so the difference is not theoretical. The reference is placed on **this format's own bytes** because that is the side an implementation written plainly in another language will agree with. The implementation is `compareCanonical`.

**JavaScript has a second trap.** An object keeps integer-like keys (`"2"`, `"10"`) ahead of all others, in ascending numeric order, whatever order they were inserted in. So levels named `2` and `10` come out with `2` first even after a correct collation sort — collation order puts `10` first. **A container that preserves collation order must be one with no rule of its own about key order** (the implementation uses a `Map` and the serialiser follows its order). This format is meant to be implemented in other languages, and the traps differ by language. **Read the rule as "ascending code point", never as "whatever the language does by default".**

### Normalisation

**Text is NFC.** Sources are normalised to NFC on read, and **identity — paths, uids, names — is decided there**: a space spelled `が` as "か + dakuten" is the same space as one spelled with the composed `が`, and writing both is a duplicate-path error. Without normalisation, documents would carry two indistinguishable keys side by side.

**NFKC is not used.** It would rewrite `㎡` to `m2` and `①` to `1`, which violates rule 3.

### Numbers

**The shortest round-tripping representation.** `0.30` comes out as `0.3`. Nothing is rounded, padded, or unit-converted. Magnitudes that need an exponent (`1e+23`, `1e-7`) come out in exponent form.

## Neighbouring pages

- [The schema](schema.md) — key by key
- [koyu json](../cli/json.md) — how to get the output
- [koyu diff](../cli/diff.md) — comparing in the language of composition
- [The muro version line](../muro/version.md) — where the `muro` key comes from
- [Stability](../stability.md) — the three version lines kept apart
