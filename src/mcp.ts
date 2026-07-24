#!/usr/bin/env node
// koyu MCPサーバー — 建物をLLMエージェントの作業対象にする (ADR-0012 / docs/horizon.md 軸1)。
// stdio上の手書きJSON-RPC 2.0。依存ゼロの方針をここでも守る (SDKは使わない)。
// ステートレス: 毎回 parseFile で合成する (towerでも数ms)。書き込みは .muro に限定し、履歴はgitが持つ。
//
// 使い方:  koyu-mcp   (カレントディレクトリ基準の相対パスでファイルを指定)
// エージェントのループ: layers で読む → write_layer で書く → check が門番 → doors/stats/light/site で帰結を確かめる

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  areaM2,
  daylight,
  displayName,
  doorsBetween,
  effectiveUse,
  isSemiOutdoor,
  levelsSorted,
  toCanonical,
  zoneAreaM2,
  type Model,
  type Space,
} from "./index.js";
import { check } from "./check.js";
import { svgPlan } from "./plan.js";
import { siteReport } from "./site.js";
import { parseFile } from "./parse-file.js";

// ---- モデルの読み込みと要約 ----

function load(file: string): Model {
  return parseFile(resolve(file));
}

/** 合成に参加したレイヤーのファイル一覧 (出所の集合 + entry) */
function layerFiles(model: Model, entry: string): string[] {
  const set = new Set<string>([resolve(entry)]);
  for (const s of model.spaces.values()) if (s.file) set.add(s.file);
  for (const z of model.zones.values()) if (z.file) set.add(z.file);
  for (const a of model.assets.values()) if (a.file) set.add(a.file);
  for (const p of model.polygons.values()) if (p.file) set.add(p.file);
  for (const b of model.boundaries) if (b.file) set.add(b.file);
  return [...set].sort();
}

function summarize(model: Model, file: string): unknown {
  const rooms = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level);
  const indoor = rooms.filter(
    (s) => s.type !== "void" && s.type !== "exterior" && !isSemiOutdoor(model, s),
  );
  const semi = rooms.filter((s) => s.type !== "void" && isSemiOutdoor(model, s));
  const byLevel: Record<string, { rooms: number; subtotalM2: number }> = {};
  for (const lv of levelsSorted(model)) {
    const rs = indoor.filter((s) => s.level === lv.name);
    if (rs.length === 0) continue;
    byLevel[lv.name] = {
      rooms: rs.length,
      subtotalM2: Math.round(rs.reduce((a, s) => a + (areaM2(s) ?? 0), 0) * 100) / 100,
    };
  }
  const byUse: Record<string, number> = {};
  for (const s of indoor) {
    const u = effectiveUse(model, s) ?? "(未指定)";
    byUse[u] = Math.round(((byUse[u] ?? 0) + (areaM2(s) ?? 0)) * 100) / 100;
  }
  const r = check(model);
  return {
    name: model.name,
    unit: model.unit,
    layers: layerFiles(model, file),
    levels: levelsSorted(model).map((l) => ({
      name: l.name,
      z: l.z,
      ...(l.h !== undefined ? { h: l.h } : {}),
      ...(l.slab !== undefined ? { slab: l.slab } : {}),
    })),
    spaces: model.spaces.size,
    boundaries: model.boundaries.length,
    zones: [...model.zones.values()].map((z) => ({
      path: z.path,
      ...(typeof z.attrs["name"] === "string" ? { name: z.attrs["name"] } : {}),
      areaM2: zoneAreaM2(model, z.path),
    })),
    assets: [...model.assets.values()].map((a) => ({ name: a.name, kind: a.kind, attrs: a.attrs })),
    ...(model.polygons.size
      ? { sitePolygons: [...model.polygons.keys()] }
      : {}),
    totalFloorM2: Math.round(indoor.reduce((a, s) => a + (areaM2(s) ?? 0), 0) * 100) / 100,
    semiOutdoorM2: Math.round(semi.reduce((a, s) => a + (areaM2(s) ?? 0), 0) * 100) / 100,
    floorsM2: byLevel,
    byUseM2: byUse,
    check: { errors: r.errors.length, warnings: r.warnings.length },
    hint: "レイヤーの中身は layers で、検査は check で、変更は write_layer で (checkが門番)。",
  };
}

function spaceInfo(model: Model, s: Space): unknown {
  return {
    path: s.path,
    type: s.type,
    name: displayName(s),
    level: s.level,
    areaM2: areaM2(s),
    semiOutdoor: isSemiOutdoor(model, s),
    ...(s.file ? { layer: s.file } : {}),
  };
}

// ---- ツール定義 ----

interface Tool {
  description: string;
  schema: Record<string, unknown>;
  run(args: Record<string, unknown>): unknown;
}

const FILE_PROP = {
  file: { type: "string", description: "entryの.muroファイルパス (importは自動で合成される)" },
};
const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v) throw new Error(`${name} (文字列) が必要です`);
  return v;
};

const TOOLS: Record<string, Tool> = {
  model_summary: {
    description:
      "建物の要約 (名前・レベル・レイヤー構成・ゾーン・建具アセット・面積・check結果)。まずこれを呼ぶ",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const file = str(a.file, "file");
      return summarize(load(file), file);
    },
  },
  check: {
    description:
      "一棟のビルドの門番: 合成して整合を検査する。エラー・警告は出所レイヤー:行つき。編集のたびに呼ぶこと",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const m = load(str(a.file, "file"));
      const r = check(m);
      return { ok: r.errors.length === 0, spaces: m.spaces.size, boundaries: m.boundaries.length, ...r };
    },
  },
  layers: {
    description: "合成に参加している全レイヤー (.muroファイル) の名前と中身を返す — 原本を読む",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const file = str(a.file, "file");
      const m = load(file);
      return layerFiles(m, file).map((f) => ({ file: f, source: readFileSync(f, "utf8") }));
    },
  },
  write_layer: {
    description:
      "レイヤー (.muroファイル) を書き換え、直後にcheckした結果を返す。checkが門番 — エラーなら直して再度書くこと。履歴はgitに任せる",
    schema: {
      type: "object",
      properties: {
        ...FILE_PROP,
        layer: { type: "string", description: "書き込む.muroファイルパス (entryからの相対または絶対)" },
        content: { type: "string", description: "レイヤーの全文 (全置換)" },
      },
      required: ["file", "layer", "content"],
    },
    run: (a) => {
      const file = str(a.file, "file");
      const content = str(a.content, "content");
      const entryDir = resolve(dirname(resolve(file)));
      const target = resolve(entryDir, str(a.layer, "layer"));
      if (!target.endsWith(".muro")) throw new Error("書き込みは .muro ファイルに限ります");
      if (!target.startsWith(entryDir)) throw new Error("entryのディレクトリの外へは書き込めません");
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      try {
        const m = load(file);
        const r = check(m);
        return { written: target, ok: r.errors.length === 0, spaces: m.spaces.size, ...r };
      } catch (e) {
        return { written: target, ok: false, parseError: e instanceof Error ? e.message : String(e) };
      }
    },
  },
  doors: {
    description: "避難・動線の問い: 空間Aから空間Bまで扉を何枚通るか (最少扉数の経路)",
    schema: {
      type: "object",
      properties: {
        ...FILE_PROP,
        from: { type: "string", description: "起点の空間パス (例 /L9/A/ldk)" },
        to: { type: "string", description: "終点の空間パス (例 /out/road-s)" },
      },
      required: ["file", "from", "to"],
    },
    run: (a) => {
      const route = doorsBetween(load(str(a.file, "file")), str(a.from, "from"), str(a.to, "to"));
      return route ?? { unreachable: true };
    },
  },
  spaces: {
    description: "空間の一覧 (パス・型・レベル・面積・半屋外・出所レイヤー)。levelで絞り込み可",
    schema: {
      type: "object",
      properties: { ...FILE_PROP, level: { type: "string", description: "レベル名で絞る (省略可)" } },
      required: ["file"],
    },
    run: (a) => {
      const m = load(str(a.file, "file"));
      return [...m.spaces.values()]
        .filter((s) => !a.level || s.level === a.level)
        .map((s) => spaceInfo(m, s));
    },
  },
  light: {
    description: "採光の検査: 住居系の居室で窓面積/床面積 ≥ 1/7 (バルコニー・庇下は0.7掛け)",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const m = load(str(a.file, "file"));
      return daylight(m).map((r) => ({
        path: r.space.path,
        name: displayName(r.space),
        ok: r.ok,
        windowM2: r.window,
        floorM2: r.floor,
        needM2: r.need,
      }));
    },
  },
  site: {
    description: "敷地の問い: 敷地面積 (宣言/導出の照合)・接道・建築面積・建蔽率・容積率",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const r = siteReport(load(str(a.file, "file")));
      const site = r.declaredArea ?? r.derivedArea;
      return {
        ...(r.siteZone ? { siteZone: r.siteZone.path } : {}),
        ...(r.polygon ? { polygonVertices: r.polygon.points.length } : {}),
        declaredAreaM2: r.declaredArea,
        derivedAreaM2: r.derivedArea,
        footprintM2: r.footprint,
        totalFloorM2: r.totalFloor,
        coverageRatio: site ? Math.round((r.footprint / site) * 1000) / 10 : undefined,
        floorAreaRatio: site ? Math.round((r.totalFloor / site) * 1000) / 10 : undefined,
        roads: r.roads.map((rd) => ({
          path: rd.road.path,
          name: displayName(rd.road),
          widthMm: rd.width,
          frontageMm: rd.frontage,
        })),
      };
    },
  },
  plan_svg: {
    description: "指定レベルの平面図SVGを生成して返す (形は生成物 — 最下階は配置図兼用)",
    schema: {
      type: "object",
      properties: { ...FILE_PROP, level: { type: "string", description: "レベル名 (例 L5)" } },
      required: ["file", "level"],
    },
    run: (a) => svgPlan(load(str(a.file, "file")), { level: str(a.level, "level") }),
  },
  canonical_json: {
    description: "正準JSON (機械形式 — 合成後の単一モデル、バイト安定)。diff・外部接続の土台",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => JSON.parse(toCanonical(load(str(a.file, "file")))),
  },
};

// ---- JSON-RPC 2.0 over stdio (行区切りJSON) ----

type Json = Record<string, unknown>;

function send(msg: Json): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id: unknown, res: unknown): void {
  send({ jsonrpc: "2.0", id, result: res } as Json);
}

function rpcError(id: unknown, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } } as Json);
}

function handle(msg: Json): void {
  const id = msg.id;
  const method = msg.method as string | undefined;
  if (method === undefined) return; // 応答は来ない想定
  const params = (msg.params ?? {}) as Json;

  // 通知 (idなし) は応答しない
  if (id === undefined) return;

  switch (method) {
    case "initialize": {
      result(id, {
        protocolVersion: (params.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "koyu", version: "0.8.0" },
        instructions:
          "空間一次の建築記述koyuのサーバー。model_summaryで建物を掴み、layersで原本 (.muroレイヤー群) を読み、" +
          "write_layerで編集する。checkが一棟のビルドの門番 — エラーは出所レイヤー:行つきで返る。" +
          "doors/light/site/spacesは同じ記述への異なる問い。形 (plan_svg) は生成物。",
      });
      return;
    }
    case "ping":
      result(id, {});
      return;
    case "tools/list": {
      result(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: t.schema,
        })),
      });
      return;
    }
    case "tools/call": {
      const name = params.name as string;
      const tool = TOOLS[name];
      if (!tool) {
        rpcError(id, -32602, `未知のツールです: ${name}`);
        return;
      }
      try {
        const out = tool.run((params.arguments ?? {}) as Json);
        const text = typeof out === "string" ? out : JSON.stringify(out, null, 1);
        result(id, { content: [{ type: "text", text }] });
      } catch (e) {
        result(id, {
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
          isError: true,
        });
      }
      return;
    }
    case "resources/list":
      result(id, { resources: [] });
      return;
    case "prompts/list":
      result(id, { prompts: [] });
      return;
    default:
      rpcError(id, -32601, `未対応のメソッドです: ${method}`);
  }
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buf += chunk;
  let nl: number;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line) as Json);
    } catch {
      // 壊れた行は黙って捨てる (stdioの流儀)
    }
  }
});
process.stdin.on("end", () => process.exit(0));
