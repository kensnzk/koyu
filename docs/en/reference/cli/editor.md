---
title: The VS Code extension
mode: reference
---

# The VS Code extension

Colours `.muro`, and on every save runs `koyu check` and puts the diagnostics in the Problems panel. **The extension holds neither a parser nor a rule** — the colour comes from a grammar file, the red from the CLI.

## It does two things only

| Job | Where it comes from |
|---|---|
| Colour | `editors/vscode/syntaxes/koyu.tmLanguage.json` — the one and only grammar. The documentation site reads the same file |
| Red | It calls `koyu check --json` and copies the returned `Diagnostic[]` into VS Code's diagnostics |

**There is one gate.** The CLI, agents over MCP, and the editor all see the same answer from the same `check`. The extension never judges anything on its own.

## Installing it

Link the extension folder into VS Code's extensions directory. **There is no build** — it is plain CommonJS and JSON.

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/koyu
```

Restart VS Code and `.muro` files are coloured. VS Code 1.75 or later is required. Derived editors such as Cursor work the same way; only the extensions directory differs.

To hand it around, package it as a `.vsix`.

```sh
npx --yes @vscode/vsce package     # run inside editors/vscode
```

## How it finds the CLI

**Colour needs nothing else. Red needs the `koyu` CLI.** The extension looks in this order, and normally you configure nothing.

1. The `koyu.cliPath` setting, if not empty
2. Walking up from the open file, `node_modules/.bin/koyu`
3. Walking up likewise, `dist/cli.js` (when working in the koyu repository itself — run `npm run build` first)
4. `koyu` on the PATH

If none is found, one warning appears and you get colour only.

## How the entry is chosen

In a building split into layers with `import`, checking one layer on its own is meaningless — it has neither `grid` nor `level`, so it fills with red. The extension picks the entry in this order.

1. The `koyu.entry` setting (relative to the workspace, or absolute)
2. **`main.muro` in the same directory as the open file** (when the open file is not itself `main.muro`)
3. The open file itself

Name it explicitly when the entry lives elsewhere.

```json
{
  "koyu.entry": "examples/twin/main.muro"
}
```

Diagnostics are **redistributed by provenance.** Open `examples/twin/office.muro` and save, and the whole building is composed from `examples/twin/main.muro` while the red lands only on lines of `office.muro`. Diagnostics this entry placed last time that are gone this time are withdrawn.

## When it runs

| Trigger | Runs |
|---|---|
| You saved the file | Yes |
| You opened the file | Yes |
| **koyu: 整合を確かめる (check)** from the command palette | Yes (even with `koyu.check.enabled` set to false) |
| While you type | **No** |

**An unsaved buffer is not checked.** The CLI reads files, so saving is what triggers the check.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `koyu.check.enabled` | `true` | Run `check` on save and on open |
| `koyu.cliPath` | `""` | Where the CLI is. Empty means search in the order above |
| `koyu.entry` | `""` | The entry for composition. Empty means `main.muro` in the same directory, else the open file itself |

## How a diagnostic maps across

| `Diagnostic` | VS Code |
|---|---|
| `message` | The diagnostic body. With a `path`, the subject paths are appended as `[/L1/a \| /L1/b]` |
| `code` | The diagnostic's code field (`BND04` and so on, shown as-is in the Problems panel) |
| `severity: "warning"` | Warning |
| `severity: "error"` (and anything else) | Error |
| `line` | That whole line. A diagnostic without a `line` lands on line 1 of the entry |
| `file` | The file the diagnostic is placed in; the entry when absent |

`source` is always `koyu`.

## Reading the colours

The colour assignment traces the structure of the notation.

| What you see | What it is |
|---|---|
| `space` `boundary` `band` … | Words that start a line |
| `door` `window` `seg` `line` `area` | Words written indented |
| `/L1/a` `/out` `/L2..L9/A` | Space and zone paths (identity) |
| `X2+600` `Y1..Y2` `L14..L19` | Grid-line and level references |
| `room` `shop` `exterior` | The type of a space (an open vocabulary) |
| `daylight:` `t:` `edge:` `slope:` `road:` … | **Attributes core reads for form and derivation.** They have their own colour |
| `spec:` `fire:` `name:` `acme.sensor:` | Every other attribute. One shared colour |

That last split is the point. The 37 words with their own colour are `underground`, `escalator`, `daylight`, `ceiling`, `landing`, `hinge`, `level`, `riser`, `slope`, `stair`, `style`, `swing`, `tread`, `pitch`, `entry`, `lane`, `lift`, `form`, `road`, `slab`, `site`, `area`, `turn`, `type`, `edge`, `kind`, `ramp`, `uid`, `air`, `use`, `at`, `h`, `w`, `t`, `d`, `x` and `y` — so the difference between `daylight:1` and `dayligth:1` is visible in colour as you type.

**A misspelled attribute does not merely lose its colour; `check` stops on it as an error.** A key not in the ledger cannot be written at all unless it carries a dotted namespace (`acme.sensor`). Conversely, once namespaced, anything goes: core assigns no meaning to what is inside it.

Note that **some themes give both kinds of attribute the same colour** (VS Code's default Dark+ does). They separate under GitHub Dark, GitHub Light, One Dark Pro, Monokai and Nord, among others.

## What the extension does not do

**It does not judge consistency.** The red is a straight copy of the JSON the CLI returned.

**Colour is not correctness.** The grammar is regular expressions, not a parser, so something can be coloured and still draw red from `check`. The answer always lives on the `check` side.

**It does not surface architectural soundness.** The only thing it calls is `koyu check --json`; it never calls [`koyu validate`](validate.md). A two-storey building that declares no door stays sealed with an empty Problems panel. Circulation is answered by [`koyu doors`](doors.md), daylight by [`koyu light`](light.md).

**It does not produce drawings.** For a plan, run [`koyu plan`](plan.md) and open the SVG.

**It offers neither completion nor formatting.**

If `check` returns exit code 2 (usage), or output that will not parse as JSON, **it does not quietly go green.** It writes what came back into the `koyu` output channel and puts `koyu: check が走りませんでした (出力パネル: koyu)` in the status bar.

## See also

- [koyu check](check.md) — the command the extension calls
- [koyu validate](validate.md) — the surface it does not call
- [Diagnostics](../diagnostics/index.md) — looking up a fix from a code in the Problems panel
- [The koyu command](index.md) — the entry and how `import` resolves
