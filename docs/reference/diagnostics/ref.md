---
title: REF — reference diagnostics
mode: reference
---

# REF — reference diagnostics

A boundary names its partner by the path of a space. If the thing named does not exist, the relation does not stand. REF is a family of exactly one.

| Code | severity | One line |
|---|---|---|
| [REF01](#ref01) | error | References an undefined space |

How to get a code is on [Reading a diagnostic](reading.md).

## REF01 — references an undefined space {#ref01}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /L1/zzz
boundary /L1/a /out
```

`References an undefined space: /L1/zzz`

**Cause** — there is no `space` matching the path written on the `boundary`. It is one of three things.

1. **A misspelt path** — `/L1/bed` where `/L1/bedroom` was meant.
2. **A forgotten `space`** — the boundary was written first and the space never followed.
3. **A layer not loaded in composition** — the space is in another file and a missing `import` kept it out.

**Fix** — check the spelling of the path first. If the space should be in another file, look for the `import` in the base layer. The `file` that `koyu check <entry> --json` returns names **the layers that took part in composition**, so you can see there whether the intended layer was actually read.

**Note — this is not a problem of order.** A `boundary` may be written **before** the spaces; boundaries may refer forward, so swapping the lines does not fix it. The two declarations that cannot be referred to forward are `grid` and `level`: they take effect only if declared before they are used.

**Note — the diagnostic carries both paths.** `path` holds both ends of the boundary, as in `["/L1/a", "/L1/zzz"]`. The end that does exist is included so the diagnostic can say which boundary it is about. If both ends are undefined, one boundary produces two REF01s.

**Note — a boundary with an undefined reference is not checked for shape.** Deriving a segment or placing an opening means nothing without the partner space, so those checks are skipped. Fixing a REF01 can bring [BND](bnd.md) or [OPN](opn.md) diagnostics into view that were hidden behind it.
