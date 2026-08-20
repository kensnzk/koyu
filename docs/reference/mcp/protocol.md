---
title: The protocol
mode: reference
---

# The protocol

The JSON-RPC surface `koyu-mcp` speaks. Not what the tools do — **the envelope around them**. This page is for people writing agent infrastructure, people whose registration will not connect, and people handling the responses by machine.

Every piece of output on this page was obtained by actually running it.

## Framing

**JSON-RPC 2.0** over stdio. Hand-written; no MCP SDK is involved.

- **One line, one message.** Newline-delimited JSON in on stdin, newline-delimited JSON out on stdout. There are no `Content-Length` headers.
- **Blank lines are skipped.**
- **A malformed line is dropped in silence.** A line that is not readable as JSON gets no error back — that is the stdio convention.
- **When stdin closes, the process exits 0.**
- **Notifications get no reply.** A message without an `id` (`notifications/initialized`, say) is accepted and answered with nothing.
- **Responses are ignored.** A message without a `method` is dropped.

The server never initiates a request. It writes no logs and no progress to stdout — what appears on stdout is JSON-RPC responses and nothing else.

## initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.27.0","muro":{"reads":["0.1","0.2","0.3","0.4","0.5","1.0","1.1","1.2","1.3","1.4"],"newest":"1.4","undeclared":"1.1"}},"instructions":"Server for koyu, a space-first architectural description. Grasp the building with model_summary, read the original layers with layers, and edit with write_layer. check is the gatekeeper of the build and returns errors tagged layer:line — it guarantees structural consistency only. validate delivers the architectural verdicts, which are a separate and unfrozen surface. doors/light/site/spaces are different questions put to the same description. Form (the drawings — plan_svg, section_svg, elevation_svg) is generated, never written."}}
```

| Field | Contents |
|---|---|
| `protocolVersion` | **Whatever the client sent, echoed back.** If `params.protocolVersion` is absent, the server announces `"2025-06-18"`. It neither negotiates nor rejects a version |
| `capabilities` | `{"tools":{}}` — tools only. It does not declare `listChanged`, and the tool set never changes |
| `serverInfo.name` | `"koyu"` |
| `serverInfo.version` | `"0.20.0"` — **the implementation's version.** It moves independently of the language's |
| `serverInfo.muro` | `{ reads, newest, undeclared }` — **the language versions this build speaks.** `reads` is every version it accepts; `newest` is the one to declare to get everything; `undeclared` is how a file with no version line is read, and is frozen rather than following `newest`. An agent choosing how to write a version line has nothing else to read it from |
| `instructions` | One paragraph for the agent: the standard loop, and the difference between `check` and `validate` |

`initialize` creates no state. **A `tools/call` sent without `initialize` works** — the server does not remember whether it was initialised. A well-behaved client sends it; when you are checking things by hand you can skip it.

## ping

```json
{"jsonrpc":"2.0","id":1,"method":"ping"}
```

```text
{"jsonrpc":"2.0","id":1,"result":{}}
```

An empty object.

## tools/list

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

All 14 come back as `name` / `description` / `inputSchema`. There is no paging and no `nextCursor`. The order is the implementation's declaration order: `model_summary`, `check`, `layers`, `write_layer`, `new_uids`, `doors`, `spaces`, `light`, `validate`, `site`, `plan_svg`, `section_svg`, `elevation_svg`, `canonical_json`.

Each `inputSchema` is plain JSON Schema carrying only `type: "object"`, `properties` and `required`. `file` is always `{"type":"string"}`.

```text
  {
   "name": "plan_svg",
   "description": "Generates and returns the plan SVG for a level (form is generated, not written — the lowest level doubles as the site plan)",
   "inputSchema": {
    "type": "object",
    "properties": {
     "file": {
      "type": "string",
      "description": "Path to the entry .muro file (imports are composed automatically)"
     },
     "level": {
      "type": "string",
      "description": "Level name (e.g. L5)"
     }
    },
    "required": [
     "file",
     "level"
    ]
   }
  },
```

There are only four distinct `required` lists.

| `required` | Tools |
|---|---|
| `["file"]` | `model_summary` `check` `layers` `new_uids` `spaces` `light` `validate` `site` `canonical_json` |
| `["file","layer","content"]` | `write_layer` |
| `["file","from","to"]` | `doors` |
| `["file","level"]` | `plan_svg` |

`new_uids`'s `count` and `spaces`'s `level` appear in `properties` but not in `required`.

## tools/call

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

What comes back is a `content` array with one element. No `structuredContent` is returned.

**`content[0].type` is always `"text"`.** No images, no resource links. [`plan_svg`](tools-ask.md#plan_svg) returns SVG, and that too is `text`.

**The text has two shapes.**

- **Tools that return a string** — only `plan_svg`. The SVG source goes in verbatim.
- **Everything else** — the return value written with `JSON.stringify(value, null, 1)`. **The indent is one space.**

That one-space indent matters for [`canonical_json`](tools-read.md#canonical_json). The file [`koyu json`](../cli/json.md) writes is indented two spaces, so **the two are not byte-identical.** Key order and values are.

Omitting `params.arguments` makes it an empty object, so the call is one with its required arguments missing, and takes the "tool errors" path below.

## How errors come back

**There are two layers.** Protocol mistakes come back as JSON-RPC errors; failures inside a tool come back as `isError` inside a successful response.

### Protocol errors

```text
{"jsonrpc":"2.0","id":4,"error":{"code":-32601,"message":"Unsupported method: completion/complete"}}
{"jsonrpc":"2.0","id":5,"error":{"code":-32602,"message":"Unknown tool: blueprint"}}
```

| Code | When | Message |
|---|---|---|
| `-32601` | A `method` not in the list below | `Unsupported method: <name>` |
| `-32602` | A `tools/call` `name` that is none of the 12 | `Unknown tool: <name>` |

No other JSON-RPC error code is ever returned. A malformed JSON line is not an error — it is dropped.

### Tool errors

**A failure inside a tool never becomes a JSON-RPC error.** A `result` comes back with `isError: true` set on it and the message in `content[0].text`, so the agent can read it and fix things.

```text
{"jsonrpc":"2.0","id":6,"result":{"content":[{"type":"text","text":"to (a string) is required"}],"isError":true}}
```

Three things mostly take this path.

**A missing or wrongly typed argument.** `inputSchema` is not enforced by the server; a missing argument is found inside the tool.

```text
file (a string) is required
```

**A file that cannot be read, or broken syntax or composition.** Every tool that takes `file` goes the same way. The position prefixes the message as `<path>:line <n>:`, and when it is the file itself that cannot be read, the line is `0`.

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

```text
<abs>/bad.muro:line 8: The region has zero width
```

**This is where it differs from [`koyu check --json`](../cli/check.md).** The CLI maps a syntax or composition error onto a single `SYN01` diagnostic and still returns valid JSON; the MCP [`check`](tools-verify.md#check) sets `isError` and returns the bare message. No `diagnostics` array comes back.

**An argument that names something the building does not have.** An undeclared level name lands here.

```text
There is no space with a region on level L9
```

(`<abs>` stands in for the resolved absolute path; the real output prints it in full.)

## Every method that is implemented

| method | Result |
|---|---|
| `initialize` | `protocolVersion` / `capabilities` / `serverInfo` / `instructions` |
| `ping` | `{}` |
| `tools/list` | `{tools: [...]}` — 12 of them |
| `tools/call` | `{content: [{type:"text", text}], isError?: true}` |
| `resources/list` | `{resources: []}` — **always empty** |
| `prompts/list` | `{prompts: []}` — **always empty** |

`resources/list` and `prompts/list` answer even though `capabilities` does not declare them. **Empty means "there are none", not "these are coming".** The building's source is not handed out as a resource — reading it is [`layers`](tools-read.md#layers)'s job.

Everything else (`resources/read`, `prompts/get`, `completion/complete`, `logging/setLevel`, `roots/list`, …) is `-32601`.

## See also

- [koyu-mcp](index.md) — statelessness, the standard loop, the 14 tools
- [Registering it with a client](install.md) — checking it by pushing JSON-RPC in by hand
- [Reading](tools-read.md) / [Writing](tools-write.md) / [Verifying](tools-verify.md) / [Asking](tools-ask.md) — each tool's arguments and result
- [koyu check](../cli/check.md) — how the CLI's `--json` treats a syntax error
