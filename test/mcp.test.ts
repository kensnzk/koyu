// MCPサーバー (ADR-0012) — stdio JSON-RPCのスモークテスト。
// initialize → tools/list → tower に対する check / doors / write_layer の門番動作。

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

class McpClient {
  private proc: ChildProcess;
  private buf = "";
  private waiters = new Map<number, (v: Record<string, unknown>) => void>();
  private nextId = 1;

  constructor() {
    this.proc = spawn(process.execPath, ["--import", "tsx", "src/mcp.ts"], {
      cwd: root,
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.proc.stdout!.setEncoding("utf8");
    this.proc.stdout!.on("data", (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as Record<string, unknown>;
        const w = this.waiters.get(msg.id as number);
        if (w) {
          this.waiters.delete(msg.id as number);
          w(msg);
        }
      }
    });
  }

  request(method: string, params?: unknown): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
      this.waiters.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async call(name: string, args: unknown): Promise<{ text: string; isError?: boolean }> {
    const msg = await this.request("tools/call", { name, arguments: args });
    const res = msg.result as { content: Array<{ text: string }>; isError?: boolean };
    return { text: res.content[0]!.text, ...(res.isError ? { isError: true } : {}) };
  }

  kill(): void {
    this.proc.kill();
  }
}

test("MCP: initialize → tools/list → towerへの問い → write_layerの門番", { timeout: 120000 }, async () => {
  // towerを一時ディレクトリへコピー (write_layerで汚さないため)
  const dir = mkdtempSync(join(tmpdir(), "koyu-mcp-"));
  cpSync(join(root, "examples/tower"), dir, { recursive: true });
  const entry = join(dir, "main.muro");

  const c = new McpClient();
  try {
    const init = await c.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    const initRes = init.result as { serverInfo: { name: string }; instructions: string };
    assert.equal(initRes.serverInfo.name, "koyu");
    assert.match(initRes.instructions, /門番/);

    const list = await c.request("tools/list");
    const tools = (list.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    for (const t of ["model_summary", "check", "layers", "write_layer", "doors", "light", "site"]) {
      assert.equal(tools.includes(t), true, `tool ${t}`);
    }

    // 要約と検査
    const sum = JSON.parse((await c.call("model_summary", { file: entry })).text);
    assert.equal(sum.spaces, 178);
    assert.equal(sum.layers.length, 9);
    const chk = JSON.parse((await c.call("check", { file: entry })).text);
    assert.equal(chk.ok, true);

    // グラフの問い
    const route = JSON.parse((await c.call("doors", { file: entry, from: "/L9/A/ldk", to: "/out/road-s" })).text);
    assert.equal(route.doors, 4);

    // 門番: 壊れた編集はcheckエラーが出所つきで返る
    const broken = await c.call("write_layer", {
      file: entry,
      layer: "L11.muro",
      content: "space /L11/PA unit X1..X99 Y1..Y2\n",
    });
    const br = JSON.parse(broken.text);
    assert.equal(br.ok, false);

    // 正しい編集に戻すと緑に戻る
    const orig = JSON.parse((await c.call("layers", { file: join(root, "examples/tower/main.muro") })).text) as Array<{
      file: string;
      source: string;
    }>;
    const l11 = orig.find((l) => l.file.endsWith("L11.muro"))!;
    const fixed = JSON.parse((await c.call("write_layer", { file: entry, layer: "L11.muro", content: l11.source })).text);
    assert.equal(fixed.ok, true);
    assert.equal(fixed.spaces, 178);

    // .muro以外への書き込みは拒否
    const deny = await c.call("write_layer", { file: entry, layer: "evil.sh", content: "x" });
    assert.equal(deny.isError, true);
  } finally {
    c.kill();
  }
});
