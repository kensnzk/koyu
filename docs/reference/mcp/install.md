---
title: Registering it with a client
mode: howto
---

# Registering it with a client

Connect `koyu-mcp` to your agent's client. It takes one line, or a few lines of JSON. No environment variables, no credentials.

## Before you start

- **Node 22 or later, and `npx`.** The server itself has no runtime dependencies.
- **Your `.muro` files under git.** [`write_layer`](tools-write.md#write_layer) replaces files wholesale and has no undo. Rollback is git's job.
- **Commit before you let an agent write.**

## Two launch commands

Whatever the client, this is the only thing koyu asks you to specify.

**From npm.**

```sh
npx -p @kensnzk/koyu koyu-mcp
```

**From a clone, using a development build.** Run `npm install && npm run build` first. `dist/mcp.js` has no runtime dependencies, so `node` can launch it directly.

```sh
node /path/to/koyu/dist/mcp.js
```

Transport is stdio; no environment variables, no authentication, no network access. **Those four facts and the launch command are all a client needs to be told.**

## Claude Code (CLI)

One line.

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js   # development build
```

`claude mcp list` lists the registered servers with their connection status. During a session, `/mcp` shows all 12 tools.

## Sharing it through the repository (project scope)

Commit a `.mcp.json` at the root of the repository and everyone who clones gets the same registration. For a project that keeps its `.muro` files in the repository, make this the default.

```json
{
  "mcpServers": {
    "koyu": {
      "command": "npx",
      "args": ["-p", "@kensnzk/koyu", "koyu-mcp"]
    }
  }
}
```

A server that comes from `.mcp.json` needs approval the first time. Until you approve it, it does not connect and shows as pending in the listing.

## Claude Desktop

Settings → Developer → Edit config opens `claude_desktop_config.json`. Write the same `mcpServers` shape as above and restart the app.

| OS | Location |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

**The desktop app does not always inherit your shell's PATH.** Writing `npx` or `node` as an absolute path (whatever `which node` / `where node` prints) is the reliable choice.

## Any other MCP client

Most read the same `mcpServers` JSON shape. Follow that client's conventions for the key name and the file location.

What koyu requires is only:

- **stdio** transport (not HTTP, not SSE)
- one of the two launch commands above
- no environment variables
- no authentication

The server reads line-delimited JSON from stdin and writes line-delimited JSON to stdout. When stdin closes, it exits 0. The full surface is on [The protocol](protocol.md).

## Pass the entry as an absolute path

When a tool's `file` argument is relative, it resolves against **the server process's working directory** — and which directory the client starts the server in is up to the client. **An absolute path is the reliable choice.**

Get it wrong and you get this. Here the working directory was `/tmp`.

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

## Checking it without a client

When a registration looks doubtful, skip the agent and push JSON-RPC into stdio directly. Run this at the root of the repository.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.17.0"},"instructions":"Server for koyu, a space-first architectural description. Grasp the building with model_summary, read the original layers with layers, and edit with write_layer. check is the gatekeeper of the build and returns errors tagged layer:line — it guarantees structural consistency only. validate delivers the architectural verdicts, which are a separate and unfrozen surface. doors/light/site/spaces are different questions put to the same description. Form (plan_svg) is generated, never written."}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\n \"doors\": 2,\n \"path\": [\n  \"/L1/a\",\n  \"/L1/b\",\n  \"/out\"\n ]\n}"}]}}
```

To check an installed package instead, swap the last line for `npx -p @kensnzk/koyu koyu-mcp` and make the file path absolute.

Send `{"jsonrpc":"2.0","id":3,"method":"tools/list"}` the same way and all 12 tools come back with `name`, `description` and `inputSchema`.

## See also

- [koyu-mcp](index.md) — statelessness, the standard loop, the 12 tools
- [The protocol](protocol.md) — what `initialize` announces, how errors come back
- [Writing — write_layer / new_uids](tools-write.md) — the blast radius of a write
- [The koyu command](../cli/index.md) — the same derivations by hand
