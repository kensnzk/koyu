---
title: Drive the MCP server by hand over stdio
mode: howto
---

# Drive the MCP server by hand over stdio

How to take the agent and the client out of the picture and push JSON-RPC straight into `koyu-mcp`.

**There are three occasions for it.**

1. **The registration is suspect.** Proving the server works alone splits the fault off onto the client.
2. **You do not believe what the agent said.** Call it yourself with the same arguments and you can read the bytes that came back.
3. **You are writing a client.** You need to know the return shape, and at which layer an error arrives.

Every output below was actually run. The end of each pipe is `npx tsx src/mcp.ts`, which assumes a clone of the repository; with the installed package, use `npx -p @kensnzk/koyu koyu-mcp` and absolute file paths.

The envelope itself — what `initialize` announces, every implemented method, the error codes — is on [Protocol](../reference/mcp/protocol.md). This page is about **how to knock**.

## The shortest possible call

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

**You do not have to send `initialize` first.** The server does not remember whether it has been initialised, so a bare `tools/call` works. Well-behaved clients send it; checking by hand, you can skip it.

The server exits with code 0 once stdin closes, so piping the output of `printf` in completes a whole round trip.

## Send several calls at once

**One line is one message.** List the arguments to `printf '%s\n'` and they are processed in order, with responses returned in order.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

Varying the `id` lets you tell which response answers which request.

## Make the payload readable

A `tools/call` return is doubly wrapped: **JSON inside a JSON string.** It is unreadable raw, so peel it.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spaces","arguments":{"file":"examples/two-rooms.muro","level":"L1"}}}' \
  | npx tsx src/mcp.ts \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const l of s.trim().split("\n"))console.log(JSON.parse(l).result.content[0].text)})'
```

```text
[
 {
  "path": "/L1/a",
  "type": "room",
  "name": "居室A",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<absolute path>/examples/two-rooms.muro"
 },
 {
  "path": "/L1/b",
  "type": "room",
  "name": "居室B",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<absolute path>/examples/two-rooms.muro"
 }
]
```

`node` is in the pipe **so that nothing extra has to be installed.** With `jq` available, `jq -r '.result.content[0].text'` does the same.

`plan_svg` is the one tool that returns a string, so peeling it gives the SVG source directly. Every other tool returns its value object as JSON written with **one space of indentation**.

## List the tools and their input schemas

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx src/mcp.ts
```

Twelve entries come back with `name`, `description` and `inputSchema`. To check only the count, peel and count.

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | npx tsx src/mcp.ts \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s).result.tools;console.log(t.length);console.log(t.map(x=>x.name).join(" "))})'
```

```text
12
model_summary check layers write_layer new_uids doors spaces light validate site plan_svg canonical_json
```

**Anything other than 12 means an older build, or a different program entirely.**

## See which layer an error arrives at

**There are two.** Write a client without knowing the difference and you will treat a tool failure as a protocol failure.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"blueprint","arguments":{}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a"}}}' \
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"check","arguments":{"file":"nope.muro"}}}' \
  '{"jsonrpc":"2.0","id":6,"method":"resources/list"}' \
  '{"jsonrpc":"2.0","id":7,"method":"completion/complete"}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"Unknown tool: blueprint"}}
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"to (a string) is required"}],"isError":true}}
{"jsonrpc":"2.0","id":5,"result":{"content":[{"type":"text","text":"line 0: Cannot read file: <absolute path>/nope.muro"}],"isError":true}}
{"jsonrpc":"2.0","id":6,"result":{"resources":[]}}
{"jsonrpc":"2.0","id":7,"error":{"code":-32601,"message":"Unsupported method: completion/complete"}}
```

- **Only protocol mistakes come back as `error`** — an unknown method (`-32601`) and a tool name outside the twelve (`-32602`).
- **A failure inside a tool is a successful response.** `result` comes back with `isError: true` set and the text in `content[0].text`. An agent can read that and fix itself.
- **`resources/list` and `prompts/list` return empty.** That means "there are none", not "more are coming".

The response to `id: 5` shows that a relative `file` resolves against **the server process's working directory**. Reading the path it printed tells you where that is.

## Try writes safely

`write_layer` rewrites the original, so **always try it against a working copy.** That said, these three return without touching the original at all.

**Content that cannot be parsed is not written.**

```text
{
 "written": false,
 "target": "<dir>/rooms.muro",
 "ok": false,
 "parseError": "<dir>/rooms.muro:line 1: Undefined grid line name: X9"
}
```

**Nothing can be written outside the entry's directory.**

```text
Cannot write outside the entry's directory
```

**Nothing but `.muro` can be written.**

```text
Only .muro files can be written
```

By contrast, **content that parses but fails `check` is written.** That is by design, not an accident: it is the room an edit spanning several layers needs to proceed in steps.

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

`content` **cannot be an empty string.** To empty a layer, write a single comment line.

```text
content (a string) is required
```

## When nothing comes back

The server **silently discards broken lines.** A line that is not readable as JSON gets no error. That is nearly always the reason for total silence.

| Symptom | What to suspect |
|---|---|
| No response at all | That line is broken JSON. Shell quoting — especially how `\n` is spelled inside `content` |
| One response missing | Messages without an `id` are notifications and get no reply |
| `Cannot read file:` | `file` is relative, and resolves against the server process's working directory |
| A path comes out garbled | Write paths containing non-ASCII in NFC |

Inside JSON, a multi-line `content` is spelled with `\n` (backslash, then n), not an actual newline. **The moment a raw newline lands inside the line, that line becomes two broken lines.**

## Related

- [Protocol](../reference/mcp/protocol.md) — the envelope and every error code
- [Register the MCP server with a client](install-mcp.md) — its step 4 is the doorway to this page
- [The standard loop for letting an agent write](agent-loop.md) — turn what you verified by hand into the order of work
- [Write — write_layer / new_uids](../reference/mcp/tools-write.md) — the blast radius of a write
- [koyu-mcp](../reference/mcp/index.md) — statelessness and the twelve tools
