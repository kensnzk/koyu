---
title: ZON — zones
mode: reference
---

# ZON — zones

There are two ZON codes, and both are warnings.

| Code | Severity | What it says |
|---|---|---|
| ZON01 | warning | Not one space sits beneath the zone |
| ZON02 | warning | A space shares its path with the zone |

**A zone carries no geometry.** Unlike a space it sits on no level and holds no region; writing `zone /L9/A` declares that spaces whose path begins `/L9/A/` are bundled together. Area subtotals, inherited use, and site aggregation all run on that prefix match alone.

So a zone's faults are always **a path that does not line up**. ZON01 is a path with nothing under it; ZON02 is a path that collides with what it is meant to bundle.

## ZON01 — there are no spaces beneath the zone {#zon01}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
zone /wing name:西棟
boundary /L1/a /out
```

```text
There are no spaces beneath zone /wing
```

**Cause** — only spaces whose path begins `/wing/` count as beneath it, and there are none. The zone's area comes out as 0 and it shows up empty in every aggregate, including `koyu stats`' per-zone table.

Almost always the zone's path and the spaces' paths simply differ. Writing `/wing` while the spaces live at `/L1/wing/a` is the classic case: the two do not match as prefixes.

**Fix** — set the zone's path to the **common prefix** of the spaces beneath it.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/wing/a room X1..X2 Y1..Y2
space /out outside:1
zone /L1/wing name:西棟
boundary /L1/wing/a /out
```

If you simply have not written the spaces yet, writing them clears it. **Putting an empty zone down first and filling it in later is a legitimate way to work** — which is why this stops at a warning. It only gets in the way while you are running `--strict`.

**It shows up most on the site zone.** Declare `zone /site site:1` with a `polygon` but no exterior spaces inside the site yet (yard, path) and this fires. The site area comes from the polygon, so the derivations still run — but the emptiness is told.

## ZON02 — a space shares its path with a zone {#zon02}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/a/x room X2..X3 Y1..Y2
space /out outside:1
zone /L1/a name:重なった名
boundary /L1/a /out
boundary /L1/a/x /out
```

```text
A space shares its path with a zone (settle on one of them): /L1/a
```

**Cause** — the path is the identity, yet at `/L1/a` there is both a **space** (an entity with a region) and a **zone** (an aggregate). The zone `/L1/a` bundles `/L1/a/x` while the space `/L1/a` holds its own region. There is now a reading under which the area is counted twice.

**You hit this every time you split a dwelling into rooms.** Writing the dwelling as a single room first and subdividing it afterwards produces exactly this shape.

**Fix** — settle on one of them.

**If you are subdividing, make the parent a zone.** This is the correct form.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/a name:住戸A
space /L1/a/ldk ldk X1..X2 Y1..Y2
space /L1/a/bed bedroom X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a/ldk /out
boundary /L1/a/bed /out
```

The parent's region goes away. The area gathers on the zone as the sum of its children, and the word "dwelling" is preserved. Leave the parent's region in place while writing children and the regions overlap on one level, which [GEO02](./geo.md) stops with an error.

**If you are not subdividing, delete the `zone` line.** If all you wanted was a display name, write `name:` on the space.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:住戸A
space /out outside:1
boundary /L1/a /out
```

## What a zone may carry

`name` (display name), `use` (an aggregation axis, inherited by the spaces beneath), `site` (0/1 — declaring that this zone is the site), `area` (the site's declared area in m², a surveyed value) and `uid` (a persistent identity token). Any other key must carry a dot-separated namespace (`acme.owner`) or it becomes [ATT03](./att.md).

## Related

- [GEO — overlapping regions](./geo.md) — the error you get when you forget to remove the parent's region
- [SIT — the site shape](./sit.md) — pairing a `site:1` zone with a `polygon`
- [ATT — attributes](./att.md) — the keys and values a zone may carry
- [koyu check](../cli/check.md)
