---
title: The standard loop for letting an agent write
mode: howto
---

# The standard loop for letting an agent write

The order of work when an agent edits `.muro` files.

```text
model_summary  →  layers  →  write_layer  →  check ──errors──→ fix, write_layer again
                                               │
                                               └──green──→ doors / light / site confirm the consequences
```

**The shape is the same as working in git**: grasp it, read it, write it, pass the gatekeeper, confirm the consequences. Agents go wrong in one of two ways — writing without reading, or moving on without passing the gatekeeper.

Registering the server is not covered here; it is on [Register the MCP server with a client](install-mcp.md). Each tool's arguments and return shape are on [Read](../reference/mcp/tools-read.md) / [Write](../reference/mcp/tools-write.md) / [Verify](../reference/mcp/tools-verify.md) / [Ask](../reference/mcp/tools-ask.md).

Every output below was actually run. Absolute paths are abbreviated to `<dir>/`.

## The subject

A single-storey pair of rooms. There is one entrance door, and nothing at all between the two rooms.

```muro-part
koyu 1.1
name 平屋
unit mm

grid X 0 3600 7200
grid Y 0 4500

level L1 0 h:2400 slab:150

import ./L1.muro
```

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  name:外部 outside:1

boundary /L1/b /out t:150 spec:EW edge:S
  door w:900 h:2100 name:玄関
```

## 0. Commit

```sh
git add . && git commit -m "before the agent edits"
```

`write_layer` replaces a layer whole and has no undo. **Skip this and there is no way back.**

## 1. model_summary — grasp the building

One call returns the layer composition, the levels, the zones, the areas and the `check` counts. **This is what decides which file to read next.**

```text
{
 "name": "平屋",
 "unit": "mm",
 "layers": [
  "<dir>/L1.muro",
  "<dir>/main.muro"
 ],
 "levels": [
  {
   "name": "L1",
   "z": 0,
   "h": 2400,
   "slab": 150
  }
 ],
 "spaces": 3,
 "boundaries": 2,
 "zones": [],
 "assets": [],
 "totalFloorM2": 32.4,
 "semiOutdoorM2": 0,
 "floorsM2": {
  "L1": {
   "rooms": 2,
   "subtotalM2": 32.4
  }
 },
 "byUseM2": {
  "(unspecified)": 32.4
 },
 "check": {
  "errors": 0,
  "warnings": 0
 }
}
```

(The one-line `hint` field is omitted.)

**0 / 0 on `check`, and the building is still unusable.** There is no way out of room A. The summary only says that what is written does not contradict itself.

`boundaries` counts the composed model, including the walls derived by default. It does not match the number of `boundary` lines in the source.

## 2. layers — read the original

Every layer taking part in the composition comes back in full as `{file, source}`. `import` is followed automatically, and **a file nobody imports is not returned.**

What the agent must read before editing is this, not the summary. The summary carries structure only — spelling, ordering and comments are not in it.

## 3. write_layer — write

Three arguments: the entry (`file`), the target layer (`layer`), and **the whole text** (`content`). Not a diff.

Hanging a door between room A and room B therefore means rewriting `L1.muro` in full.

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  name:外部 outside:1

boundary /L1/a /L1/b t:120 spec:PW
  door w:800 h:2000 name:D-中扉

boundary /L1/b /out t:150 spec:EW edge:S
  door w:900 h:2100 name:玄関
```

**The return carries the `check` result from immediately after the write.** Editing and verifying cost one round trip together.

```text
{
 "written": "<dir>/L1.muro",
 "ok": true,
 "spaces": 3,
 "errors": [],
 "warnings": []
}
```

### The gatekeeper stands before the write

`write_layer` composes the replacement **virtually first**. Content that cannot be parsed **never touches the original.**

```text
{
 "written": false,
 "target": "<dir>/rooms.muro",
 "ok": false,
 "parseError": "<dir>/rooms.muro:line 1: Undefined grid line name: X9"
}
```

Content that parses but fails `check` **is written.** That is deliberate: it lets an edit that spans several layers proceed in steps. `written` carries the path and `ok` is false. Fix it on the next call.

```text
{
 "written": "<dir>/rooms.muro",
 "ok": false,
 "spaces": 2,
 "errors": [
  "<dir>/rooms.muro:line 3: References an undefined space: /L1/c"
 ],
 "warnings": []
}
```

The restrictions on where it may write, and its atomicity, are on [Write — write_layer / new_uids](../reference/mcp/tools-write.md). **When creating a new layer, put the added `import` line in the same unit of work** — a file nobody imports never joins the composition, so its contents are never checked.

## 4. check — pass the gatekeeper

It rides along on the `write_layer` return, so a green result moves straight on. An error means **fix it and write again.** A workflow that walks past this point produces drawings from a broken building.

The `diagnostics` array on the return is the structured, coded form. Human-readable `check` output carries no codes, but the MCP return has them from the start. The table from code to fix is the [diagnostic code index](../reference/diagnostics/index.md).

## 5. Confirm the consequences

**This is the step people skip.** `check` looks at neither circulation nor daylight nor the site. That an edit had the intended consequence has to be established by a separate question.

Before the edit, room A could not reach the outside.

```text
{
 "unreachable": true
}
```

After one door, the same question answers:

```text
{
 "doors": 2,
 "path": [
  "/L1/a",
  "/L1/b",
  "/out"
 ]
}
```

And `validate` keeps returning architectural findings while `check` stays green.

```text
{
 "findings": [
  {
   "rule": "envelope.gap",
   "level": "caution",
   "message": "Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior",
   "line": 1,
   "file": "<dir>/L1.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "envelope.gap",
   "level": "caution",
   "message": "Perimeter not faced by any envelope: /L1/b — E 4500mm / N 3600mm (8100mm over 2 run(s)). Write a boundary to the exterior",
   "line": 2,
   "file": "<dir>/L1.muro",
   "path": [
    "/L1/b"
   ]
  }
 ],
 "violations": 0,
 "cautions": 2
}
```

Not one exterior wall has been written. `check` never mentioned it — boundaries against a space with no region are not derived.

**Which question to ask is decided by what was edited.**

| What changed | The question to ask |
|---|---|
| Partitions, doors | [`doors`](../reference/mcp/tools-ask.md#doors) — reachability and door count |
| Windows, room types | [`light`](../reference/mcp/tools-ask.md#light) — floor area and effective window area |
| Regions, levels | [`site`](../reference/mcp/tools-ask.md#site) — coverage and floor-area ratios |
| Anything at all | [`validate`](../reference/mcp/tools-verify.md#validate) — the architectural findings |

## The rules to hand the agent

Put these in the instructions and the accidents mostly stop.

1. **Read with `layers` before writing.** Writing from the summary loses spelling and comments.
2. **`write_layer` is a whole-file replacement.** The `content` it sends must be the complete text of the edited file.
3. **When `ok: false` comes back, the only next action is to fix it and write again.**
4. **Never claim it works because it is green.** A building with no doors is sealed and `check` is happy.
5. **Nothing mints a `uid` on its own.** Call [`new_uids`](../reference/mcp/tools-write.md#new_uids) only when a space must be pointed at across renames, and run `check` afterwards.
6. **Form is generated.** A plan cannot be "written". [`plan_svg`](../reference/mcp/tools-ask.md#plan_svg) derives and returns it.

## Related

- [Register the MCP server with a client](install-mcp.md) — getting connected
- [Drive the MCP server by hand over stdio](debug-mcp.md) — take the agent out and inspect behaviour
- [Lay measurements over the plan](write-as-built.md) — overriding without rewriting the original
- [koyu-mcp](../reference/mcp/index.md) — statelessness and the twelve tools
- [The scope of the promise](../reference/scope.md) — what a green `check` means
