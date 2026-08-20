---
title: The koyu command
mode: reference
---

# The koyu command

`koyu` takes one `.muro` file, composes it, and answers a question about it. All 16 subcommands share the same derivations; the CLI, the MCP server, and the public API are different entrances to the same answers.

## Running it

```sh
koyu check examples/two-rooms.muro
```

Installing the package (`@kensnzk/koyu`) gives you two executables, `koyu` and `koyu-mcp`. It needs Node 22 or later.

From inside the repository the following two are equivalent. **Every piece of output on this page and on the per-command pages below was obtained by actually running the command at the root of the repository.**

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
npm run koyu -- check examples/two-rooms.muro
```

**The human-facing output is in English.** It uses the same words as the machine-facing surfaces (diagnostics, findings, MCP), and there is no argument to switch locale — so that the same wording is never maintained in two ledgers.

## The common shape

```text
koyu <check|validate|layers|diff|plan|axo|section|elevation|doors|graph|stats|levels|runs|light|site|json> <entry.muro> [args...]
```

**What you pass is always one path, the entry.** Even for a building split into layers with `import`, pass only the base layer's file (`examples/house/main.muro`, say). Composition happens from scratch on every run, and no intermediate state is stored anywhere.

[`diff`](diff.md) is the one exception: it takes a second file path after the first.

## The entry, and how import resolves

An `import` path resolves **relative to the file the `import` line is written in** — not relative to the entry, and not relative to the working directory. So copying just the base layer's file somewhere else will not compose; you get `Cannot read file: ./assets.muro`.

Passing one of the split layers on its own dies, because that layer has neither `grid` nor `level`.

```sh
npx tsx src/cli.ts check examples/house/L1.muro
```

```text
✖ <absolute path>/examples/house/L1.muro:line 3: Undeclared level: level:L1
```

(`<absolute path>` stands in for the resolved absolute path; the real output prints it in full.)

[`koyu layers`](layers.md) shows which layers took part and in what strength order.

## Reading the exit codes

| Exit code | Meaning |
|---|---|
| 0 | Success — the answer to the question is yes |
| 1 | Failure — there are errors, something is missing, it cannot be reached, or the input could not be read because of a syntax or composition error |
| 2 | You called it wrong — a missing argument, an unknown subcommand, an undeclared level name, an unreadable number |

**`2` is a problem with the command you typed, not with the model you wrote.** What `0` and `1` mean concretely differs per subcommand, so read the exit-code table on each page. [`diff`](diff.md) in particular has its own convention: `0` = no difference, `1` = differences, `2` = the input is broken.

Never letting a calling mistake pass with exit 0 is deliberate. Handing in an unreadable scale does not produce a `width="NaN"` SVG announced as "generated".

## --version

**`--version` (or `-v`) is the one flag that takes no file.** It says which implementation you are running and which language it speaks, because those are two separate versions and only one of them is on npm.

```sh
npx tsx src/cli.ts --version
```

```text
koyu 0.26.0 — reads muro 0.1–1.4 (newest 1.4; a file with no version line is read as 1.1)
```

The exit code is `0` — it is an answer, not a calling mistake.

**Read it as three facts, and note that the last two are separate.** The first number is this implementation. `reads` is every language version it accepts, so a file declaring one of those opens here. `newest` is the version to declare to get everything the language has.

`a file with no version line is read as 1.1` is **frozen** and does not follow `newest` ([the version line](../muro/version.md)). They no longer agree, and that gap is the fact a reader most needs: an old file that names no version does not quietly become a file at the newest version.

When a file will not open because it declares something newer, this line is what tells you the file is fine and the tool is behind.

The same three facts are on `package.json` as the `muro` field (`reads` / `newest` / `undeclared`), for anything that needs them without running the binary, and in the MCP server's `serverInfo`.

## There is no --help

**No `--help` flag is implemented.** A call that omits the subcommand name or the file path prints usage, but that is the "you called it wrong" path, and **the exit code is 2**. Typing `--help` takes the same path, because `--help` does not fill the subcommand and file-path positions.

```sh
npx tsx src/cli.ts --help
```

```text
Usage: koyu <check|validate|layers|diff|plan|axo|section|elevation|doors|graph|stats|levels|runs|light|site|json> <file.muro> [args...]
  check:    --json (emit Diagnostic[] as JSON) / --strict (exit 1 if there are warnings) — structural consistency only
  validate: --profile <id> --as-of <YYYY-MM-DD> [--json] — architectural judgement (not what check guarantees)
  layers:   the layers that took part in composition, weakest first. --attrs for the provenance of each attribute
  diff:  koyu diff <a.muro> <b.muro> [--json] — the difference in the language of composition (0=no difference / 1=differences / 2=the input is broken)
```

**That usage text is not exhaustive.** It mentions four subcommands only. [`plan`](plan.md)'s `-l` / `-o`, [`axo`](axo.md)'s six flags, and [`doors`](doors.md)'s two path arguments are all absent from it. Each command's page below writes out every flag it has.

An unknown subcommand is also exit 2.

```sh
npx tsx src/cli.ts frobnicate examples/two-rooms.muro
```

```text
Unknown command: frobnicate
```

## The 16 subcommands

| Command | What it answers | Flags | Exit codes |
|---|---|---|---|
| [`check`](check.md) | Does what is written hold together as data | `--json` `--strict` | 0 / 1 |
| [`validate`](validate.md) | Is it sound as architecture, under a named profile (not what check guarantees) | `--profile` `--as-of` `--json` | 0 / 1 / 2 |
| [`layers`](layers.md) | Which layers composed, and which layer gave which value | `--attrs` | 0 / 1 |
| [`diff`](diff.md) | What did this edit change about the composition | `--json` | 0 / 1 / 2 |
| [`plan`](plan.md) | The plan drawing (SVG) | `-l` `-o` | 0 / 1 / 2 |
| [`axo`](axo.md) | The axonometric (SVG) | `-o` `-d` `-l` `-s` `--no-walls` `--ceilings` | 0 / 1 / 2 |
| [`section`](section.md) | The section cut at a grid reference (SVG) | `--at` `--look` `-s` `-o` | 0 / 1 / 2 |
| [`elevation`](elevation.md) | The elevation of one face (SVG) | `--face` `-s` `-o` | 0 / 1 / 2 |
| [`doors`](doors.md) | How many doors from here to there | — | 0 / 1 / 2 |
| [`graph`](graph.md) | What is this space next to, and how | — | 0 / 1 |
| [`stats`](stats.md) | What are the areas | `--by` | 0 / 1 / 2 |
| [`levels`](levels.md) | How do the heights stack up | — | 0 / 1 |
| [`runs`](runs.md) | How was the vertical circulation derived | — | 0 / 1 |
| [`light`](light.md) | Do the rooms in daylight scope meet 1/7 | — | 0 / 1 |
| [`site`](site.md) | Site area, frontage, coverage, floor area ratio | — | 0 / 1 |
| [`json`](json.md) | The canonical JSON a machine reads | — | 0 / 1 |

Every command prints usage and returns exit 2 if the subcommand name or the file path is missing. The table above omits that shared 2.

## Do not conflate the two greens

A green `check` and a usable building are different things. The default between touching spaces is a wall, so a two-storey building that declares no door at all stays green in `check` while being perfectly sealed. `check` says only that what is written holds together as data; architectural soundness is what [`validate`](validate.md) says, separately.

They differ down to the type. `check` returns `Diagnostic { code, severity }`; `validate` returns an `AssessmentReport` whose findings carry `{ rule, level }`. The spellings differ and the two cannot be concatenated. Put both in CI — how to wire them up is on [Gating CI](ci.md).

`validate` also names its grounds: `--profile` and `--as-of` are required, and leaving one out is a usage error (exit 2) rather than a verdict.

## See also

- [Gating CI](ci.md) — which command to fail the build on, and at which exit code
- [The VS Code extension](editor.md) — running `check` on every save
- [koyu-mcp](../mcp/index.md) — the same derivations for agents
- [The public API](../api/index.md) — the same derivations from a program
- [.muro reference](../muro/index.md) — how to write the file you pass in
