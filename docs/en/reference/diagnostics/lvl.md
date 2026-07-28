---
title: LVL — levels
mode: reference
---

# LVL — levels

There is only one LVL code.

| Code | Severity | What it says |
|---|---|---|
| LVL01 | error | Two levels share the same `z` |

A level is a name paired with a `z` — a height in mm above the datum. `z` is **the only value that gives order**, and everything in section is derived from it: storey heights, what is above what, vertical adjacency, how far walls and columns rise. When two levels sit at the same `z`, that order is undetermined.

## LVL01 — the levels have the same z

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
level L2 0
```

```text
Levels L1 and L2 have the same z
```

**Cause** — two levels are at the same height. The test is whether the difference in `z` is **less than 0.5mm**, so `level A 0` and `level B 0.4` count as the same too.

Without an order in `z`, none of the following is settled.

- **Storey height.** It is never written; it is the difference to the next level's `z`. Between neighbours at the same `z` it comes out as 0.
- **What is above what.** A `type:stair` / `shaft` / `void` boundary may only be written between **adjacent** levels ([VRT02](./vrt.md)), and adjacent means adjacent in `z` order.
- **How far walls and columns rise.** That is the storey height itself.

**Where the diagnostic points** — the message names the two neighbours in `z` order, and the line points at the **later** one; `related` carries the line of the earlier one. Three levels at the same `z` produce two diagnostics, one per adjacent pair.

**Fix** — correct the `z`.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0
level L2 3000
```

## Clashing with a range declaration

`level` can also be written as a range. `level L1..L3 0 pitch:3000` places `L1`, `L2` and `L3` at 0, 3000 and 6000. An individual declaration landing on one of the intermediate values raises LVL01.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1..L3 0 pitch:3000 h:2600 slab:400
level M 3000
```

```text
Levels L2 and M have the same z
```

A range declaration writes no intermediate `z`, so the clash is hard to see. Run `koyu levels` and the stack-up shows where it collapsed.

```text
L3	z:6000	h:2600	slab:400
M	z:3000
  ↑ storey height 3000
L2	z:3000	h:2600	slab:400
  ↑ storey height 0
L1	z:0	h:2600	slab:400
  ↑ storey height 3000 = ceiling 2600 + slab 400
```

The `storey height 0` line is the collapsed storey.

**Fix** — if you only wanted another name for the same floor, bundle it with a `zone` instead of a level. Zones carry no `z`, so they never disturb the order in section. If you really want a mezzanine, give it its actual height (`level M 1500`).

## Writing the same name twice

That is not LVL01. It is a syntax error, caught by the parser before composition.

```text
Duplicate level: L1
```

A range declaration that re-creates an existing name produces the same body. Under `check --json` it appears as [SYN01](./syn.md).

## Related

- [SUF — sufficiency](./suf.md) — a space with no determinable level (SUF02), a level with no `slab:` (SUF03)
- [HGT — the height invariant](./hgt.md) — the storey height derived from `z`
- [SYN — syntax and composition](./syn.md) — duplicate and undeclared level names
- [koyu check](../cli/check.md)
