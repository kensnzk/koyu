---
title: koyu-mcp
mode: reference
---

# koyu-mcp

`koyu-mcp` is the MCP server shipped inside koyu. It is the surface through which an LLM agent reads a building, edits it, and confirms what it did — returning the same derivations the [`koyu` command](../cli/index.md) gives you, as JSON.

## What it is

| | |
|---|---|
| Executable | `koyu-mcp` — installed alongside `koyu` by `@kensnzk/koyu` |
| Transport | stdio. Line-delimited JSON in on stdin, line-delimited JSON out on stdout |
| Protocol | JSON-RPC 2.0 — written by hand. No MCP SDK is used |
| Runtime dependencies | None |
| Environment variables, authentication, network | None |
| Requires | Node 22 or later |
| Tools | 12 |

The version `serverInfo` announces is the implementation's (`0.17.0`), not the notation's (`koyu 1.1`). The two versions move independently.

## It is stateless

**All 12 tools take a required `file` argument.** `file` is the path of the entry `.muro`; for a building split into layers with `import`, pass the base layer's file.

One call goes: resolve the path, read the entry, follow the `import`s, compose, answer the question, forget. **There is no session, no open document, no cache, no undo stack.** Call it twice with the same arguments and it composes twice.

So the server never holds a version of the building that the disk does not have. **The original is the filesystem, and the history is git's.**

Re-composing is cheap. The bundled nine-layer tower takes about 6 ms; the largest bundled example (11 layers, 1,808 spaces, 141,448.56 m² of floor) stays under 100 ms.

## Registering it

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

Per-client instructions, and how to register a development build (`node /path/to/koyu/dist/mcp.js`), are on [Registering it with a client](install.md).

**Pass the entry as an absolute path.** A relative path is resolved against **the server process's working directory**, and which directory a client starts the server in is up to that client. Get it wrong and you get `Cannot read file:`.

## The standard loop

Shape the agent's work like git's.

```text
model_summary  →  layers  →  write_layer  →  check ──errors──→ fix, write_layer again
                                               │
                                               └──green──→ doors / light / site confirm the consequences
```

1. **Grasp the building with [`model_summary`](tools-read.md#model_summary).** Layer composition, levels, zones, assets, areas and the `check` counts come back in one call, which tells you which file to read next.
2. **Read the original with [`layers`](tools-read.md#layers).** The full text of every composed layer comes back.
3. **Write with [`write_layer`](tools-write.md#write_layer).** A whole-file replacement, not a diff. The response carries the `check` result from immediately after the write, so editing and verifying take one round trip.
4. **[`check`](tools-verify.md#check) is the gatekeeper.** If errors come back, fix them and write again.
5. **Confirm the consequences with [`doors`](tools-ask.md#doors) / [`light`](tools-ask.md#light) / [`site`](tools-ask.md#site).** Move a partition and circulation and daylight change; change an area and coverage changes. `check` was not looking at any of that.

## The 12 tools

| Tool | Arguments | What comes back |
|---|---|---|
| [`model_summary`](tools-read.md#model_summary) | `file` | Name, unit, layers, levels, zones, assets, areas, `check` counts |
| [`layers`](tools-read.md#layers) | `file` | `{file, source}` for every composed layer |
| [`spaces`](tools-read.md#spaces) | `file`, `level`? | The spaces — path, type, name, level, area, semi-outdoor flag, originating layer |
| [`canonical_json`](tools-read.md#canonical_json) | `file` | The canonical JSON (one composed model) |
| [`write_layer`](tools-write.md#write_layer) | `file`, `layer`, `content` | Replaces a layer wholesale. Returns `written` plus the `check` from right after |
| [`new_uids`](tools-write.md#new_uids) | `file`, `count`? | Fresh persistent identity tokens |
| [`check`](tools-verify.md#check) | `file` | Structural consistency — `ok`, `errors`/`warnings`, `diagnostics` |
| [`validate`](tools-verify.md#validate) | `file` `profile` `asOf` | Architectural verdicts under a named profile — a full `AssessmentReport` |
| [`doors`](tools-ask.md#doors) | `file`, `from`, `to` | The fewest-doors route, or `{unreachable: true}` |
| [`light`](tools-ask.md#light) | `file` | Floor area and effective window area for every space written `daylight:1` |
| [`site`](tools-ask.md#site) | `file` | Site area, road frontage, coverage ratio, floor-area ratio |
| [`plan_svg`](tools-ask.md#plan_svg) | `file`, `level` | The plan SVG for that level, as a string |

`?` marks an optional argument. The JSON-RPC surface — what `initialize` announces, the shape of a `tools/call` result, how errors come back — is on [The protocol](protocol.md).

## Do not conflate the two greens

A green `check` and a usable building are different things. The default between touching spaces is a wall, so a two-storey building that declares no door at all stays green in `check` while being perfectly sealed. `check` says only that what is written holds together as data; architectural soundness is what `validate` says, separately.

They differ down to the type. `check`'s `diagnostics` carry `{code, severity}`; `validate` returns an `AssessmentReport` whose `findings` carry `{rule, level}`. The spellings differ and the two cannot be concatenated. **Do not claim a building works because `check` is green.**

`validate` also refuses to guess its grounds: `profile` and `asOf` are required, and a call without them is rejected as invalid arguments before anything is judged. And an empty `findings` is not by itself a pass — read `summary.state`, which is `complete` only when nothing was left indeterminate and nothing errored.

## Commit before you let it write

`write_layer` replaces a file wholesale and **has no undo.** The server stores not one previous version. Branching, review and rollback are all git's job.

Commit your `.muro` files before starting work that lets an agent write. The full blast radius is on [Writing — write_layer / new_uids](tools-write.md).

## See also

- [Registering it with a client](install.md) — Claude Code, `.mcp.json`, Desktop, any MCP client
- [The protocol](protocol.md) — the JSON-RPC surface and how errors come back
- [Reading](tools-read.md) — `model_summary` / `layers` / `spaces` / `canonical_json`
- [Writing](tools-write.md) — `write_layer` / `new_uids`, and the safety contract
- [Verifying](tools-verify.md) — `check` / `validate`
- [Asking](tools-ask.md) — `doors` / `light` / `site` / `plan_svg`
- [The koyu command](../cli/index.md) — the same derivations by hand
- [.muro reference](../muro/index.md) — the notation you are asking the agent to write
