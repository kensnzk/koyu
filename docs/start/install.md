---
title: Installing koyu
mode: howto
---

# Installing koyu

There are two routes to running koyu locally — install it from npm, or clone the repository. Either way you end up with the same `koyu` command.

## What you need

**Node.js 22 or newer.** That is all. koyu has no runtime dependencies, so installing it installs koyu and nothing else.

```sh
node --version
```

```text
v26.5.0
```

## From npm

### Try it once

Run it without installing.

```sh
npx -p @kensnzk/koyu koyu check first.muro
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

### Install it into a project

Make an npm project in the directory that holds your `.muro` files and add koyu as a devDependency. This is the route to take if `koyu check` is going to be a gate in CI.

```sh
npm install --save-dev @kensnzk/koyu
```

Two executables land in `node_modules/.bin/`.

```text
koyu
koyu-mcp
```

`npm run` scripts can then call them by name alone.

```json
{
  "scripts": {
    "check": "koyu check building/main.muro"
  }
}
```

### Install it everywhere

```sh
npm install --global @kensnzk/koyu
```

`koyu` and `koyu-mcp` go on your PATH.

## From source

Take this route when you want to work on the notation itself, or run ahead of the published version. [The tutorial](index.md) is written along this route.

```sh
git clone https://github.com/kensnzk/koyu.git
cd koyu
npm install
```

Inside the repository these two mean the same thing.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
npm run koyu -- check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

It runs straight from the TypeScript, so no build step is needed. If you want the built artefact, `npm run build` emits `dist/`, and `node dist/cli.js` gives the same answers.

```sh
npm run build
node dist/cli.js check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## Confirming it works

Write a four-line file and put it through.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

```sh
koyu check first.muro
koyu plan first.muro -o first.svg
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
Generated the plan: first.svg
```

Open `first.svg` in a browser and you get grid lines and one pale rectangle, with **not one wall drawn**. [Your first .muro](index.md) takes it from there.

## About the output

**Output for humans is in English.** It is kept in the same words as the machine-facing surfaces — diagnostics, findings, MCP — and there is no argument that switches locale, so that the same wording is never kept in two places. Names you write in `.muro` are your own words and may be in any language.

Exit codes from `check` are 0 (nothing found), 1 (errors), 2 (the input is broken). Wiring that into a pipeline is in [Running koyu in CI](../reference/cli/ci.md).

## What sits next to it

- **Editor support** — a VS Code extension colours `.muro` and mirrors `check` on every save. See [Editor support](../reference/cli/editor.md).
- **The MCP server** — connect `koyu-mcp` to an LLM agent's client; registration is a single line. See [Registering it with a client](../reference/mcp/install.md).
- **Driving it from a program** — call the same derivations from TypeScript. See [Reading a building from a program](first-program.md).
