---
title: Register the MCP server with a client
mode: howto
---

# Register the MCP server with a client

How to connect `koyu-mcp` to an agent client and **confirm, one step at a time, that it is actually connected**. It takes a few minutes. No environment variables, no credentials, no network.

The registration forms themselves — where each client keeps its config file, the two launch commands, the spelling of `.mcp.json` — are laid out on [Register with a client](../reference/mcp/install.md). What this page adds is **the order, and the check at each step**. "It's registered but the agent can't read my building" almost always traces back to a check that was skipped.

## 0. Commit first

This is step zero, before any registration.

```sh
git add . && git commit -m "before letting the agent write"
```

[`write_layer`](../reference/mcp/tools-write.md#write_layer) replaces a layer **whole**, and has no undo. The server stores no versions at all. Rollback, branching and review are git's job.

This comes before registration because it comes first in time. **The moment the client connects, the agent can write.**

## 1. Check Node

```sh
node --version
```

**Node 22 or newer is required.** The server itself has zero runtime dependencies, so there is nothing else to install.

## 2. Register

From npm it is one line.

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

For a development build from a clone, run `npm install && npm run build` first, then point at `dist/mcp.js` directly.

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js
```

To share the registration with a team, put the same launch command in a `.mcp.json` at the repository root and commit it. Config file locations for other clients (Desktop and the rest) and the `.mcp.json` format are on [Register with a client](../reference/mcp/install.md).

## 3. Confirm the connection

```sh
claude mcp list
```

Do not move on until `✓ Connected` appears. A server that came from `.mcp.json` needs approval on first use, and sits pending until you give it.

Inside a session, `/mcp` lists the tools. **Twelve is the right number.** A different count means you are talking to an older build.

## 4. Confirm the server works on its own

When the client's listing is suspect, take the client out of the picture. This is the split that tells you where the fault is — if the command below works and the client still shows nothing, the fault is in the client's configuration.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check","arguments":{"file":"examples/two-rooms.muro"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n \"ok\": true,\n \"spaces\": 3,\n \"boundaries\": 3,\n \"errors\": [],\n \"warnings\": [],\n \"diagnostics\": []\n}"}]}}
```

The full kit for driving the server by hand is on [Drive the MCP server by hand over stdio](debug-mcp.md).

## 5. Let it read your building

This is the last gate. **Pass the entry path as an absolute path.**

When a tool's `file` argument is relative, it resolves against **the server process's working directory**. Which directory the client launches the server in is up to the client, so a relative path hits or misses at random.

```text
line 0: Cannot read file: /private/tmp/examples/two-rooms.muro
```

When you see this, suspect the base directory rather than the spelling. An absolute path makes it go away.

The first instruction to the agent, with an absolute path in hand, can be as plain as this.

```text
Read /Users/me/work/house/main.muro with model_summary and summarise what is written there
```

If the summary comes back with the layer composition, levels, areas and the `check` counts, registration is done. What [`model_summary`](../reference/mcp/tools-read.md#model_summary) returns is in the reference.

## When it will not connect

| Symptom | Where to look |
|---|---|
| Not in `claude mcp list` | Check which scope (user / project) you registered in |
| Stuck pending | A server from `.mcp.json` needs approval on first use |
| Connects but has zero tools | The launch command points at a different program. Run step 4 directly |
| Only the Desktop app fails | Desktop apps do not always inherit the shell `PATH`. Write `npx` or `node` as an absolute path (the output of `which node`) |
| Tools are visible but `Cannot read file:` | Step 5 — make `file` absolute |
| `Unknown tool:` | A misspelled tool name. The full list is on [koyu-mcp](../reference/mcp/index.md) |

## Read next

- [The standard loop for letting an agent write](agent-loop.md) — the order of work once you are connected
- [Drive the MCP server by hand over stdio](debug-mcp.md) — take the client out and find the fault
- [Register with a client](../reference/mcp/install.md) — config file shapes and locations
- [koyu-mcp](../reference/mcp/index.md) — statelessness and the twelve tools
