**English** · [日本語](../canonical-json.md)

# Machine-format reference — the canonical JSON

As of koyu v0.11.0. Emitted by `koyu json <entry>` / `toCanonical(model)`. The authored form (.muro) is what people and LLMs work from; the canonical JSON is the footing for machines — diffs, hashes, layer composition, and external connections (RDF and so on) are built on top of it.

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).

## The stability rules (why this format exists)

1. **The same composition always emits byte-identical JSON.** Every object key is sorted; `spaces` are in path order, `boundaries` in lexicographic order of `between` (and, within an identical `between`, in canonical order of content), and `zones`, `assets`, and `polygons` in key order. **Arrays whose declaration order carries no meaning (openings, segs, areas, the rectangles of a region union) are also placed in canonical order of content** — writing the same composition with the lines in a different order yields the same bytes (ADR-0013).
2. **It is the authored composition, after composing.** import, spans, stack, and **bands** are already expanded and do not survive. Default boundaries (derived — ADR-0014) do not appear: the canonical JSON holds only the authored composition, and the meaning (default walls included) lives in the Model after derivation. A consumer applies `deriveDefaultBoundaries` before reading meaning from it.
3. **It preserves the spelling that was written.** A position stays a grid reference (`"at": "Y2+1820"`), a region is a 4-tuple of grid names, and **the direction of a boundary is the `a` key** (the space written first — `edge`/`swing` are read from that side; added in ADR-0013 because without it the swing cannot be recovered from the JSON alone). The canonical form does not re-say things. The only exceptions are spellings that carry no meaning: a descending region (`X2..X1`) is normalized to ascending coordinates. A polygon's vertex list is geometry (a cycle) and is not reordered. The interior cut positions derived by a band (language.md §3) have no written spelling, so they are spelled by the **floor rule**: the offset from the largest grid line at or below that coordinate (the bare grid name when the offset is 0). The two ends of a band, and both ends across it, keep the spelling that was written.

## The schema

```jsonc
{
  "koyu": "0.3",                        // language version (the declared value, passed through. The schema version is contracted by the tool version — this document's header)
  "name": "…",                          // optional
  "unit": "mm",
  "grid": { "X": [0, 6400, …], "Y": [0, 5600, …] },   // coordinate arrays (grid names X1.. are implicit)
  "levels": { "L1": { "z": 0, "h": 3600, "slab": 600 }, … },
  "assets": { "SD1": { "kind": "door", "attrs": { "w": 800, "style": "sliding", … } }, … },   // optional
  "polygons": { "/site": [[-2600, -7000], [38000, -7000], …] },                               // optional
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
      "openings": [{ "kind": "door", "ref": "D1", "w": 900, "h": 2100,
                     "at": "X4",                     // a number for a ratio, a string for a grid reference
                     "edge": "S", "hinge": "E", "swing": "b",   // optional
                     "attrs": { "name": "玄関", "style": "hinged" } }],
      "segs": [{ "w": 1800, "at": "X5", "edge": "S", "attrs": { "spec": "受付ガラス" } }]
    }, …
  ]
}
```

Omission rules: a key with no value (h, slab, t, edge, attrs, and so on) is not emitted. An empty block (assets/polygons/zones/areas/openings/segs) is not emitted either. An attribute value in numeric form is a number; anything else is a string.

## The implementation is the norm

`toCanonical()` in `src/model.ts` is the norm, and this document is a copy of it. If the two diverge, decide on the spot which one to change, and bring the spec into line.
