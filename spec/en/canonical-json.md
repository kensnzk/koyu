**English** · [日本語](../canonical-json.md)

# Machine-format reference — the canonical JSON

As of koyu v1.0.0-rc.1. Emitted by `koyu json <entry>` / `toCanonical(model)`.

**What is this for?** It is **the definition of what makes two buildings the same, written down.**
The authored form (.muro) is free in line order and spelling, so whether two files are the same
building is not decided by their text. The canonical form gives that question a single answer —
the same composition always yields the same bytes, and a different composition always yields different bytes.

That narrows its uses to two: **the yardstick that shows the semantic diff (`koyu diff`) is right**
(asking the diff itself proves nothing, so an independent judgement is needed — the tests are written
against this), and **an exit for programs that have no .muro parser** (Ugatsu's export, MCP's `canonical_json`).

**It is not a substrate.** `semanticDiff` takes Models and never goes through the canonical JSON.
Layer composition happens in `parse-file.ts`, over .muro layers, before canonicalisation.
There is no reader (`fromCanonical`); the only way into the system is `parse` — one authored source is enough.

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).

## Two versions — the format's and the language's

What the document names first is **the version of this format itself**. `koyu` comes next and is the language version, not the format version.

| Key | Version of what | When it rises |
|---|---|---|
| `format` | **the spelling of the canonical JSON** — the set of keys, their order, the collation, the normalization, the spelling of numbers. Currently `koyu-canonical/1.0` | the minor when a key is added (the bytes of a document that does not carry it are unchanged), the major when an existing spelling changes (the bytes of existing documents change) |
| `koyu` | **the language version of the source** ([language.md](language.md) §2), passed through. **It is absent when nothing was declared** | when the semantics of the language change (ADR-0017) |

They are two because **the same semantics may be re-spelled with different keys**. Adding the boundary's direction (the `a` key) changed the spelling without changing a single word of the language. Conversely the language version may rise while the spelling stays put.

**A source with no version declaration is not stamped with one.** The default language version is "the newest this tool knows" (language.md §2), so stamping it would make the document claim a version its author never wrote — and **the bytes of the same input would change** on the day the tool's default moves. Determinism is a promise this format makes; it is not left to a tool's default. A source that wants its meaning pinned writes `koyu 1.0`.

## The stability rules (why this format exists)

1. **The same composition always emits byte-identical JSON.** The keys of a record shape (the top level, levels, spaces, boundaries, openings, segs, columns) are in **the fixed order this schema defines**, and the keys that come from the source (level names, paths, asset names, attribute keys) are in **collation order**. `spaces` are in path order, `boundaries` in lexicographic order of `between` (and, within an identical `between`, in canonical order of content), and `zones`, `assets`, and `polygons` in key order. **Arrays whose declaration order carries no meaning (openings, segs, areas, the rectangles of a region union, a column's `x`/`y` grid names, the endpoints of a drawn line) are also placed in canonical order of content** — writing the same composition with the lines in a different order yields the same bytes (ADR-0013).

   **`columns` is the exception — a column declaration's order is meaning, so it is never sorted** (ADR-0029). No two columns stand on the same grid intersection and the earlier declaration wins (ADR-0023), so swapping two lines changes which columns actually stand. Sorting them would make two different buildings emit identical bytes, and this format's whole reason for existing would be lost for columns. **When order carries meaning, the canonical order is the declared order.**
2. **It is the authored composition, after composing.** import, spans, stack, and **bands** are already expanded and do not survive. Default boundaries (derived — ADR-0014) do not appear: the canonical JSON holds only the authored composition, and the meaning (default walls included) lives in the Model after derivation. A consumer applies `deriveDefaultBoundaries` before reading meaning from it.
3. **It preserves the spelling that was written.** A position stays a grid reference (`"at": "Y2+1820"`), a region is a 4-tuple of grid names, and **the direction of a boundary is the `a` key** (the space written first — `edge`/`swing` are read from that side; added in ADR-0013 because without it the swing cannot be recovered from the JSON alone). The canonical form does not re-say things. The only exceptions are spellings that carry no meaning: a descending region (`X2..X1`) is normalized to ascending coordinates. A polygon's vertex list is geometry (a cycle) and is not reordered. The interior cut positions derived by a band (language.md §3) have no written spelling, so they are spelled by the **floor rule**: the offset from the largest grid line at or below that coordinate (the bare grid name when the offset is 0). The two ends of a band, and both ends across it, keep the spelling that was written.

## The norms for the bytes (collation, normalization, numbers)

"Byte-identical" in rule 1 means something only once the following four are settled as norms. **An implementation written in another language emits the same bytes by following them.**

1. **The encoding is UTF-8, the newline is LF, the indent is two spaces, and one newline ends the document.** Non-ASCII is emitted raw, never escaped (`"name": "居室"`). What is escaped is what JSON demands (`"`, `\`, control characters) and nothing else.
2. **The collation is ascending code point order, which is the ascending order of the emitted UTF-8 bytes.** Locale collation (anything like `localeCompare`) is not used. **JavaScript's `<` and its default `sort` cannot be used here** — those are UTF-16 code-unit order, which does not agree with code point order: 𠮟 (U+20B9F) is a surrogate pair, so under `<` it is smaller than 﨑 (U+FA11), while in UTF-8 `EF A8 91` (﨑) comes before `F0 A0 AE 9F` (𠮟). Both are characters in actual Japanese use, so the difference is not theoretical. The norm sits on "the bytes of this format itself" because that is the side an implementation in another language agrees with when written plainly. The implementation is `compareCanonical` (`src/core/model.ts`).
3. **Text is NFC.** The source is normalized to NFC as it is read, and **identity (paths, uids, names) is decided there** — a space whose name is spelled "か + dakuten" is the same space as one spelled with the composed `が`, and writing both is a duplicate-path error. Without normalization the document would carry two keys nothing can tell apart. **NFKC is not used** — it would rewrite `㎡` into `m2` and `①` into `1`, and that contradicts preserving the spelling that was written (rule 3).
4. **Numbers are spelled in their shortest round-trip form.** `0.30` is emitted as `0.3`. Nothing is rounded, padded, or converted. Magnitudes that need an exponent (`1e+23`, `1e-7`) come out in exponent form.

## The schema

```jsonc
{
  "format": "koyu-canonical/1.0",        // the format version (the version of this document's own spelling)
  "koyu": "1.0",                         // the language version (the declaration passed through; absent when the source omitted it)
  "name": "…",                          // optional
  "unit": "mm",
  "grid": { "X": [0, 6400, …], "Y": [0, 5600, …] },   // coordinate arrays (grid names X1.. are implicit)
  "levels": { "L1": { "z": 0, "h": 3600, "slab": 600 },
              "B1": { "z": -4200, "h": 3600, "slab": 600, "underground": 1 }, … },   // underground is declared, never inferred from a negative z (ADR-0022)
  "assets": { "SD1": { "kind": "door", "attrs": { "w": 800, "style": "sliding", … } }, … },   // optional
  "polygons": { "/site": [[-2600, -7000], [38000, -7000], …] },                               // optional
  "columns": [                                                                                // optional (ADR-0023). **In declared order** — the first-wins rule makes order meaning
    { "size": 900, "d": 1200, "levels": ["B2","B1","L1"], "x": ["X2","X3"], "y": ["Y2"], "attrs": { "spec": "SRC" } }, …
  ],
  "zones": { "/L3/A": { "attrs": { "name": "Aタイプ", "use": "exclusive" } }, … },            // optional
  "spaces": {
    "/L5/A/ldk": {
      "type": "ldk",
      "level": "L5",                     // only when level: was explicit (a membership differing from the path head — a maisonette). The default (the path head) is omitted
      "at": [["X1+3200","Y1","X2+3200","Y1+4000"], ["X2+3200","Y1","X3","Y1+2400"]],  // a flat 4-tuple when there is a single rectangle
      "attrs": { "name": "LDK", "floor": "オーク" },
      "areas": [{ "at": ["X1","Y1-4600","X2","Y1-2600"], "attrs": { … } }]            // optional
    }, …
  },
  "boundaries": [
    {
      "between": ["/L5/A/hall", "/L5/corridor"],    // two paths, ascending
      "a": "/L5/A/hall",                             // the direction as written — edge/swing are read from the a side
      "kind": "wall",                                // wall|open|stair|shaft|void
      "t": 180, "air": true, "edge": "S",            // each optional
      "attrs": { "spec": "RC" },                     // optional
      "line": ["X3,Y1", "X3+600,Y2-900"],            // optional (ADR-0022). The endpoints of a drawn line — the grid-word spelling as written.
                                                     // A segment has no direction, so the pair is canonicalised into ascending resolved coordinates
      "openings": [{ "kind": "door", "ref": "D1", "w": 900, "h": 2100,
                     "at": "X4",                     // a number for a ratio, a string for a grid reference
                     "edge": "S", "hinge": "E", "swing": "b",   // optional
                     "attrs": { "name": "玄関", "style": "hinged" } }],
      "segs": [{ "w": 1800, "at": "X5", "edge": "S", "attrs": { "spec": "受付ガラス" } }]
    }, …
  ]
}
```

Omission rules: a key with no value (koyu, h, slab, t, edge, attrs, line, and so on) is not emitted. An empty block (assets/polygons/columns/zones/areas/openings/segs) is not emitted either. An attribute value in numeric form is a number; anything else is a string. `underground` is emitted as `1` only when true.

## The implementation is the norm

`toCanonical()` in `src/core/model.ts` is the norm, and this document is a copy of it. If the two diverge, decide on the spot which one to change, and bring the spec into line.
