**English** · [日本語](../../howto/editor.md)

# Write in an editor — colour, and a check on every save

Give `.muro` syntax colour, run `koyu check` on every save, and put the errors in the Problems panel. The same grammar also colours the documentation site (Docusaurus).

There is only one grammar: `editors/vscode/syntaxes/koyu.tmLanguage.json`. VS Code reads it directly, and Shiki (Docusaurus) reads the very same file ([ADR-0031](../../../docs/decisions/0031-editor-support.md)).

The extension itself decides nothing about consistency. It calls `koyu check --json` and copies the diagnostics across. **There is one gatekeeper**, and the CLI, the agent (MCP) and the editor all see the same answer.

## Before you begin

- VS Code 1.75 or later. Forks such as Cursor work the same way; only the extensions folder differs.
- Colour needs nothing else. **Errors need the `koyu` CLI** — install it from npm, or run `npm run build` in the repository.

## Steps

### 1. Put the extension in place

Link the extension folder into the VS Code extensions folder. There is no build step (it is plain JavaScript and JSON).

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/koyu
```

Restart VS Code and open a `.muro` file; it is coloured.

To hand it to someone else, package it as a `.vsix`. If the `code` command is not on your PATH, install it from the Extensions panel: `…` → "Install from VSIX".

```sh
npx --yes @vscode/vsce package     # run inside editors/vscode → koyu-0.1.0.vsix
```

### 2. Let it find the CLI

The extension looks for `koyu` in this order. **You normally do not have to configure anything.**

1. The `koyu.cliPath` setting, if not empty
2. `node_modules/.bin/koyu`, walking up from the open file
3. `dist/cli.js`, walking up the same way (when you work in the koyu repository itself — run `npm run build` first)
4. `koyu` on the PATH

If none is found, you get one warning and colour only.

### 3. Save, and look at the red

Saving a `.muro` file runs check. Errors and warnings appear in the Problems panel, carrying the diagnostic code (`SYN01` and the [63 others](../diagnostics.md)). To run it by hand, use **koyu: 整合を確かめる (check)** from the command palette.

The same answer from the CLI:

```sh
koyu check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

### 4. Buildings split across files

In a building composed with `import` ([split-into-files.md](split-into-files.md)), checking one layer on its own means nothing — that layer has no `grid` and no `level`, so it fills with red.

The extension **composes from `main.muro` when one sits in the same directory**, then hands the diagnostics back out by origin. Save `examples/twin/office.muro` and the whole building is composed from `examples/twin/main.muro`, but only office.muro's own lines are marked.

If the entry lives elsewhere, name it:

```json
{
  "koyu.entry": "examples/twin/main.muro"
}
```

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `koyu.check.enabled` | `true` | Run check on save and on open |
| `koyu.cliPath` | `""` | Where the CLI is. Empty means search (step 2) |
| `koyu.entry` | `""` | The entry to compose from. Empty means `main.muro` in the same directory, otherwise the open file itself |

## Reading the colours

The colours follow the structure of the notation.

| What you see | What it is |
|---|---|
| `space` `boundary` `band` … | words written at the start of a line |
| `door` `window` `seg` `line` `area` | words written indented |
| `/L1/a` `/out` `/L2..L9/A` | space and zone paths (identity) |
| `X2+600` `Y1..Y2` `L14..L19` | grid line and level references |
| `room` `shop` `exterior` | space type (an open vocabulary) |
| `daylight:` `t:` `edge:` | **the ★ of the ledger** — attributes the tools interpret |
| `spec:` `fire:` `name:` | free `k:v` — carried, never interpreted |

Those last two rows being different is the point. Only the ★ in [spec/vocabulary.md](../../../spec/en/vocabulary.md) is a contract; anything else you write does nothing. The difference between `daylight:1` and `dayligth:1` is visible as colour while you type.

Note that **some themes give ★ and free words the same colour** (VS Code's default Dark+ does). They differ under GitHub Dark / GitHub Light / One Dark Pro / Monokai / Nord, among others.

## The same colours in Docusaurus

Docusaurus v3 highlights with Prism by default, and Prism does not read TextMate grammars. **Swap in Shiki** and this grammar works as it is, because Shiki uses the same Oniguruma engine as VS Code.

The grammar can be pulled from the npm package:

```ts
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const koyu = { ...JSON.parse(readFileSync(require.resolve("@kensnzk/koyu/syntax"), "utf8")), name: "koyu" };
```

Pass it to `@shikijs/rehype` as `langs` and insert the plugin into `beforeDefaultRehypePlugins`. From then on ` ```koyu ` fences (alias ` ```muro `) are coloured, and **the site and the editor agree by definition**.

## Traps

**Colour is not correctness.** The grammar is regular expressions, not a parser, so `check` still reports red on coloured text. The answer is always on the `check` side.

**A green check does not mean the building works.** Adjacent spaces default to a wall, so a two-storey building that declares no door at all stays green and completely sealed ([ADR-0014](../../../docs/decisions/0014-default-boundaries.md)). Circulation is answered by `koyu doors`, daylight by `koyu light`.

**Unsaved buffers are not checked.** The CLI reads files; saving is what triggers a check.

## Read next

- [troubleshooting.md](troubleshooting.md) — get from an error down to its cause
- [diagnostics.md](../diagnostics.md) — look up a diagnostic code and its fix (all 65)
- [cli.md](../cli.md) — the CLI the extension is calling
- [ADR-0031](../../../docs/decisions/0031-editor-support.md) — why one grammar, and why the red belongs to the CLI
