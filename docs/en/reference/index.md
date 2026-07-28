---
title: Reference
mode: reference
---

# Reference

**What is written here is what is true.** This volume is for looking things up, not for reading through. To learn the notation, start with [Your first .muro](../start/index.md); to work from a goal, use the [how-to guides](../howto/index.md).

The volumes follow koyu's surfaces — the words you write, the messages the tools return, the commands, the server, the library, and the form that is derived. Look it up from the surface you are touching.

## Writing

| Volume | What it answers |
|---|---|
| [Every .muro construct](muro/index.md) | How is this word spelled? What may it carry, and what happens if you leave it out? |

One page per declaration: `space`, `zone`, `boundary`, `door`, `window`, `column`, `import`, `over`/`drop` and the rest. Each declaration's page owns its attributes and defaults; rules that span layers live in [composition](muro/composition.md).

## Checking

| Volume | What it answers |
|---|---|
| [Diagnostic code index](diagnostics/index.md) | What does this `koyu check` code mean, and what do I change? (65 codes) |
| [koyu validate](validate/index.md) | Architectural judgement. **Not what `check` guarantees.** (15 rules) |

They are two different surfaces. [Two kinds of green](../why/two-kinds-of-green.md) explains why.

## Running

| Volume | What it answers |
|---|---|
| [The koyu command](cli/index.md) | Arguments, flags, output and exit codes for all 14 subcommands |
| [koyu-mcp](mcp/index.md) | The surface an agent touches: 12 tools and the JSON-RPC contract |
| [TypeScript API](api/index.md) | The public names of `@kensnzk/koyu` (59 runtime values, 77 types) and the four entry points |

## What comes out

| Volume | What it answers |
|---|---|
| [Form](form/index.md) | How a written composition becomes one unambiguous form. Derivation constants and tolerances |
| [Canonical JSON](json/index.md) | The machine form: the byte-level norms and the stability rules |

## The extent of the promise

| Page | What it answers |
|---|---|
| [What check guarantees](scope.md) | What a green `check` means, and what it does not |
| [Frozen surfaces](stability.md) | What you may depend on across versions. The language version and the implementation version |
| [Identity](identity.md) | `uid` — where you may write it, when you need it, what it guarantees |
| [What koyu does not hold](not-held.md) | What is deliberately impossible |

If a word is unfamiliar, see the [glossary](../glossary.md).
