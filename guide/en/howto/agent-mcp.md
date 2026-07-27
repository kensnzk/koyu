**English** · [日本語](../../howto/agent-mcp.md)

# Connect an agent over MCP

Register `koyu-mcp` as an MCP server and let an LLM agent read, edit, and verify a building.

The server ships with koyu itself. It is stateless: every tool takes `file` (the path of the entry .muro) and composes from scratch each time. The source of record is on the filesystem, and git holds the history ([ADR-0012](../../../docs/decisions/0012-mcp-server.md)).

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- Node and `npx` are available. The server has no runtime dependencies.
- The `.muro` files are under git. `write_layer` writes by wholesale replacement and keeps no history; undo is done with git.
- Commit before letting an agent write.

## Steps

### 1. Register the server

The launch command is the same pair of choices in every client. From npm, `npx -p @kensnzk/koyu koyu-mcp`; from a clone of the repository, `node /path/to/koyu/dist/mcp.js` (run `npm install && npm run build` first — `dist/mcp.js` has no runtime dependencies). The transport is stdio, and there are no environment variables and no authentication.

**Claude Code (CLI).** One line registers it.

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

```sh
claude mcp add koyu -- node /path/to/koyu/dist/mcp.js   # the development build
```

`claude mcp list` answers whether it connected.

```text
koyu: node /home/user/koyu/dist/mcp.js - ✓ Connected
```

Inside a session, `/mcp` shows the tools as well.

**Sharing it through the repository (project scope).** Put a `.mcp.json` at the root of the repository and commit it, and everyone who clones gets the same registration.

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

A server that comes from `.mcp.json` is approved once before it is used; until then it is not connected.

```text
koyu: npx -p @kensnzk/koyu koyu-mcp - ⏸ Pending approval (run `claude` to approve)
```

**Claude Desktop.** Open `claude_desktop_config.json` through Settings → Developer → Edit Config, write the same `mcpServers` shape, and restart the app. The file lives at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. The desktop app does not always inherit the shell's PATH, so writing `npx` or `node` as an absolute path (what `which node` / `where node` prints) is the surer route.

**Other clients.** Most read JSON of the same `mcpServers` shape; follow that client's documentation for the key name and the location of the file. What koyu requires is only these four: stdio, the launch command above, no environment variables, no authentication.

**Pass the entry as an absolute path.** A relative `file` argument is resolved against **the server process's cwd**, and which directory a client launches the server in is up to the client. Getting it wrong comes back like this.

```text
0行目: ファイルが読めません: /tmp/examples/two-rooms.muro
```

("Cannot read the file: …")

### 2. Confirm the tools

Ten tools come back. Every one takes `file` as a required argument.

| Tool | Arguments | Returns |
|---|---|---|
| `model_summary` | `file` | Name, unit, layer composition, levels, zones, assets, areas (gross / semi-outdoor / by level / by use), and check counts. **Call this first** |
| `check` | `file` | `ok`; `errors`/`warnings` (strings carrying layer:line provenance); `diagnostics` (the structured form — the same items in the same order as the strings). **The gate; call it after every edit** |
| `layers` | `file` | The `{file, source}` of every layer that took part in composition — to read the authored source |
| `write_layer` | `file`, `layer`, `content` | Replaces a layer wholesale. Returns `written`, `ok`, and `errors`/`warnings` |
| `doors` | `file`, `from`, `to` | The route of fewest doors as `{doors, path}`, or `{unreachable: true}` |
| `spaces` | `file`, `level` (optional) | The list of spaces (path, type, name, level, area, semi-outdoor, provenance layer) |
| `light` | `file` | The 1/7 daylight verdict per habitable room |
| `site` | `file` | The site report (area reconciliation `areaMatch`, frontage, `coverageRatio`, `floorAreaRatio`) |
| `plan_svg` | `file`, `level` | The plan of the given level as an SVG string |
| `canonical_json` | `file` | The canonical JSON (the single composed model) |

The exact contract is the MCP section of [spec/tools.md](../../../spec/en/tools.md).

### 3. Run the standard loop

Shape the agent's work like git's.

```text
model_summary  →  layers  →  write_layer  →  (check がエラーなら直して再度 write_layer)
                                                        ↓
                                         doors / light / site で帰結を確かめる
```

(Read the loop as: if check returns errors, fix and `write_layer` again; then confirm the consequences with doors / light / site.)

**Grasp the building with model_summary.** The layer composition, the levels, the areas, and the check counts come back at once, which settles which file to read next. The return for `examples/house.muro` looks like this.

```text
{
 "name": "小さな戸建住宅",
 "unit": "mm",
 "layers": [
  "examples/house.muro"
 ],
 "levels": [
  {
   "name": "L1",
   "z": 0,
   "h": 2400
  },
  {
   "name": "L2",
   "z": 2900,
   "h": 2400,
   "slab": 500
  },
  {
   "name": "R",
   "z": 5800,
   "slab": 500
  }
 ],
 "spaces": 13,
 "boundaries": 31,
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "areaM2": 0
  },
  {
   "path": "/home",
   "name": "住戸",
   "areaM2": 92.75
  }
 ],
 "assets": [],
 "totalFloorM2": 92.75,
 "semiOutdoorM2": 73.24,
 "floorsM2": {
  "L1": {
   "rooms": 2,
   "subtotalM2": 53
  },
  "L2": {
   "rooms": 2,
   "subtotalM2": 39.75
  }
 },
 "byUseM2": {
  "exclusive": 92.75
 },
 "check": {
  "errors": 0,
  "warnings": 0
 },
 "hint": "レイヤーの中身は layers で、検査は check で、変更は write_layer で (checkが門番)。"
}
```

`boundaries` is the count after composition and includes derived default walls — it can exceed the number of `boundary` lines in the source that `layers` returns. When you want only the authored composition, use `canonical_json` (default boundaries do not appear in the canonical JSON).

**Read the source with layers.** Imports are followed automatically. Only the layers that took part in composition come back, so a file nothing references is invisible.

**Write with write_layer.** The arguments are the entry (`file`), the destination (`layer` — relative to the entry, or absolute), and the whole text (`content`). It is a wholesale replacement, not a diff.

**check is the gate.** `write_layer` puts the check result from immediately after the write into the same response — editing and verifying take one round trip. If errors come back, fix them and write again.

**Confirm the consequences with the queries.** If an area changed, `site`; if a partition moved, `doors` and `light`. `check` does not look at these, so confirm separately that the intended consequence occurred.

### 4. Understand what makes write_layer safe

**It validates before writing.** `write_layer` composes virtually with the replacement content, and if that cannot be parsed it **does not touch the source at all**. A broken composition never lands on the filesystem.

```text
{
 "written": false,
 "target": "rooms.muro",
 "ok": false,
 "parseError": "rooms.muro:1行目: 未定義の通り名です: X9"
}
```

**Content that parses but fails check is written.** This is deliberate, so that an edit spanning several layers can be left mid-flight: `written` carries the path and `ok` is false. Fix it on the next call.

```text
{
 "written": "rooms.muro",
 "ok": false,
 "spaces": 3,
 "errors": [
  "rooms.muro:5行目: 未定義の空間を参照しています: /L1/bath"
 ],
 "warnings": []
}
```

**Writes are atomic.** They go through a temporary file in the same directory plus a rename, so no half-written file is left behind.

**Where it may write is restricted.** Only files with the `.muro` extension, and only beneath the entry's directory. Escaping by a relative path, or via a symlink, is blocked.

```text
entryのディレクトリの外へは書き込めません
```

```text
書き込みは .muro ファイルに限ります
```

("Cannot write outside the entry's directory." / "Writes are limited to .muro files.")

**The content of a file that does not take part in composition is not validated.** When you write a new layer that nothing yet `import`s, its content is not checked until you add `import ./the-new-layer.muro` to the entry. Include adding that import line in the same unit of work as creating a new layer.

**It keeps no history.** Undo, branching, and review are git's job. Commit before letting an agent write.

## Confirming it

You can verify the behavior without going through an agent, by feeding JSON-RPC straight into stdio. Run it from the repository root.

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doors","arguments":{"file":"examples/two-rooms.muro","from":"/L1/a","to":"/out"}}}' \
  | npx tsx src/mcp.ts
```

```text
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"koyu","version":"0.14.0"},"instructions":"空間一次の建築記述koyuのサーバー。model_summaryで建物を掴み、layersで原本 (.muroレイヤー群) を読み、write_layerで編集する。checkが一棟のビルドの門番 — エラーは出所レイヤー:行つきで返る。doors/light/site/spacesは同じ記述への異なる問い。形 (plan_svg) は生成物。"}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\n \"doors\": 2,\n \"path\": [\n  \"/L1/a\",\n  \"/L1/b\",\n  \"/out\"\n ]\n}"}]}}
```

(The server's `instructions` string, which the agent reads, says: grasp the building with model_summary, read the source layers with layers, edit with write_layer; check is the build gate for the whole building and returns errors with layer:line provenance; doors/light/site/spaces are different questions asked of the same description; form (plan_svg) is a generated artifact.)

Sending `{"jsonrpc":"2.0","id":2,"method":"tools/list"}` in the same shape returns the ten tools above with `name`, `description`, and `inputSchema`. The `inputSchema.required` is `["file","layer","content"]` for `write_layer`, `["file","from","to"]` for `doors`, `["file","level"]` for `plan_svg`, and `["file"]` for the rest.

An error during tool execution comes back not as a JSON-RPC error but as a result carrying `isError: true`, so the agent can read it and fix it.

## Related

- [The how-to index](README.md)
- [Split across several files](split-into-files.md) — designing the unit that `write_layer` writes
- [Doors and egress](doors-and-escape.md) — confirming the consequence with `doors`
- [Give the site its shape and produce coverage and floor area ratios](site-and-far.md) — confirming the consequence with `site`
- [Getting unstuck](troubleshooting.md) — how to fix the errors `check` returns
- [The public API](../api.md) — calling the same derivations from a program, without MCP
- [spec/tools.md](../../../spec/en/tools.md) — the norms for the CLI, MCP, and the public API
- [spec/canonical-json.md](../../../spec/en/canonical-json.md) — the format `canonical_json` returns
- [ADR-0012](../../../docs/decisions/0012-mcp-server.md) — why the server ships with koyu itself, dependency-free and stateless
- [ADR-0013](../../../docs/decisions/0013-semantic-guarantees.md) — the grounds for validate-before-write and the directory restriction
