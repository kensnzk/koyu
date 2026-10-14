---
title: Start with a spatial model
mode: howto
---

# Start with a spatial model

Use `muro 1.6` with `mode spatial` when the spaces, grid and levels are ready but their boundaries
are still undecided. This uses the ordinary parser, API, CLI and MCP tools.

From a repository checkout:

```sh
npm run build
node dist/cli.js check examples/spatial/main.muro --strict
node dist/cli.js json examples/spatial/main.muro
node dist/cli.js plan examples/spatial/main.muro -l L1 -o out/spatial-L1.svg
node dist/cli.js plan examples/spatial/main.muro -l L2 -o out/spatial-L2.svg
```

The entry imports `layout.muro`, which defines four spaces on two levels without any boundaries,
ceiling heights or floor thicknesses. Dashed faces in the plan are unresolved. They are not walls
or declarations of passage.

To resolve one relation, add this to the entry:

```muro-part
boundary /L1/a /L1/b type:open
```

To ask for architectural assessment:

```sh
node dist/cli.js validate examples/spatial/main.muro --profile koyu.profile.schematic-screen --as-of 2026-10-14 --json
```

The spatial model returns an incomplete assessment with indeterminate rules, and this command
exits 1. It has no architectural pass or fail verdict. Structural contradictions still fail
`check`; omitting a boundary, ceiling height or floor thickness does not.

When moving to a building model, remove `mode spatial`, supply the physical declarations, and
check again. Space paths and `uid` values remain unchanged. See [mode](../reference/muro/mode.md)
for the complete contract and [defaults](../reference/muro/defaults.md) for the building reading.
