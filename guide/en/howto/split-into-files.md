**English** · [日本語](../../howto/split-into-files.md)

# Split one building across several files with import

Cut one `.muro` into layers and compose them into a single building with `import`. Divide the work, and catch collisions as build errors.

The file paths in the output below are actually absolute; the head of the directory is shortened for readability.

## Before you begin

- You have a `.muro` that passes `check` with zero errors as a single file.
- You have a sense of the unit of division (storeys, the site, the openings, and so on).

## Steps

### 1. Decide the base layer (the entry)

The consistencies of the whole building — `koyu` (the version), `name`, `unit`, `grid`, `level` — are declared **once** by the base layer. The file that gathers these into one layer becomes the entry.

```muro-part
koyu 0.3
name 小さな戸建住宅
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R 5800 slab:500
```

### 2. Cut the rest into layers

Spaces, boundaries, zones, assets, and the site shape may live in any layer. Decide where to cut by the unit of divided work. `examples/house/` divides 102 lines across 5 files as follows.

| File | What it holds |
|---|---|
| `main.muro` | The base layer — version, name, unit, grid, levels; the `import`s; and the relations that span levels |
| `assets.muro` | The opening assets (`asset`) — the layer corresponding to a door and window schedule |
| `site.muro` | The site and exterior spaces (`/site`, `/out`), the wall and the gate |
| `L1.muro` | The ground floor's spaces and boundaries |
| `L2.muro` | The first floor's spaces and boundaries |

Layers only add. A layer read later never silently overrides one read earlier; there is no mechanism like layer strength.

### 3. Stack them from the base layer with `import`

An `import` path is **relative to the file it is written in**, not to the working directory at run time.

```muro-part
import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

Import the same file twice, or form a cycle, and composition still happens exactly once — it is idempotent.

### 4. Put relations that span levels in the base layer

Vertical boundaries (`type:stair` / `shaft` / `void`) and `stack` belong to no single storey's layer. Put them in the base layer.

```muro-part
zone /home name:住戸 use:exclusive

boundary /home/hall1 /home/hall2 type:stair
boundary /home/ldk /home/void type:void
```

A `boundary` may refer forward to spaces. The two lines above pass whether they are written before or after the `import`s of `L1.muro` and `L2.muro`.

### 5. Put the site shape in a quarantined layer

A `polygon` is surveyed input, not designed form. The standard practice is to separate it into its own file and import it. `examples/tower/site-geometry.muro` is a layer whose only declaration is a single `polygon` line.

## Confirming it

Run `check` on the entry. The imports are followed automatically and the result comes back composed as one building. This is the build gate for the whole building.

```text
$ npx tsx src/cli.ts check examples/house/main.muro
✔ 整合 — 空間 13 / 境界 31
```

`stats` and `plan` also see the composed model when given the entry. When you need the list of layers that took part, the MCP `layers` tool returns `{file, source}` for each ([spec/tools.md](../../../spec/en/tools.md)).

## Do not check a layer on its own

A layer file has neither `grid` nor `level`, so it cannot be read alone.

```text
$ npx tsx src/cli.ts check examples/house/L1.muro
✖ examples/house/L1.muro:3行目: 未宣言のレベルです: level:L1
```

("Undeclared level.") Checking is always done against the entry.

## When there is a collision

When two layers declare the same thing, composition errors. The error names the provenance of both as `file:line`.

**A duplicate space path** — when a layer for another storey uses the same path.

```muro-part
# adding this to L2.muro
space /home/ldk   ldk  X1..X2 Y1..Y3 level:L2 name:LDK上部
```

```text
✖ house/L2.muro:6行目: 空間パスが重複しています: /home/ldk (既出: house/L1.muro:3行目)
```

("Duplicate space path, first seen at house/L1.muro line 3.") A path is identity itself. If it is a different space, give it a different path.

**A re-declared `grid` or `name`** — when the foundation was added so that a layer would work independently.

```text
✖ house/L2.muro:3行目: grid X は一度だけ宣言します (合成時はbase層で)
```

("grid X is declared once — in the base layer when composing.") Remove the line on the layer's side, not from the base layer.

**A duplicate asset name** — when opening types were written per layer.

```text
✖ house/L2.muro:3行目: アセット名が重複しています: W1 (既出: house/assets.muro:7行目)
```

("Duplicate asset name.") Gather assets into one layer. If you need a different size, give it a different name, or override the attribute at the reference (`window W1 h:1200`).

## Related

- [The how-to index](README.md)
- [Give the site its shape and produce coverage and floor area ratios](site-and-far.md) — how to place the quarantined `polygon` layer
- [Connect an agent over MCP](agent-mcp.md) — having it read and write by layer (`layers` / `write_layer`)
- [The cheat sheet](../cheatsheet.md) — every construct, `import` included
- [spec/language.md](../../../spec/en/language.md) §8 import — the rules of composition
- [spec/tools.md](../../../spec/en/tools.md) — the composition entry points (`parse` / `parseFiles` / `parseFile` / `parseWith`)
- [ADR-0010](../../../docs/decisions/0010-assets-and-composition.md) — why additive composition was chosen and layer strength was not
- [ADR-0011](../../../docs/decisions/0011-site-polygon.md) — the practice of keeping the site shape in a quarantined layer
- A 5-file worked example — `examples/house/`; a 9-file one — `examples/tower/` ([the gallery](../gallery.md))
