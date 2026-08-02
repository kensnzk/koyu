#!/usr/bin/env node
// koyu MCPサーバー — 建物をLLMエージェントの作業対象にする (ADR-0012 / docs/horizon.md 軸1)。
// stdio上の手書きJSON-RPC 2.0。依存ゼロの方針をここでも守る (SDKは使わない)。
// ステートレス: 毎回 parseFile で合成する (towerでも数ms)。書き込みは .muro に限定し、履歴はgitが持つ。
//
// 使い方:  koyu-mcp   (カレントディレクトリ基準の相対パスでファイルを指定)
// エージェントのループ: layers で読む → write_layer で書く → check が門番 → doors/stats/light/site で帰結を確かめる

import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  areaM2,
  isIndoor,
  daylightInputs,
  validate,
  displayName,
  doorsBetween,
  effectiveUse,
  isOutside,
  isSemiOutdoor,
  isVoid,
  levelsSorted,
  newUids,
  polygonAreaM2,
  toCanonical,
  zoneAreaM2,
  type Model,
  type Space,
} from "./index.js";
import { check, checkDiagnostics } from "./core/diagnose.js";
import { svgPlan } from "./draw/plan.js";
import { siteReport } from "./core/site.js";
import { parseFile, parseFileWith } from "./parse-file.js";

// ---- モデルの読み込みと要約 ----

function load(file: string): Model {
  return parseFile(resolve(file));
}

/**
 * Every layer that took part in the composition — the Model records them all, whether or not
 * they carry elements (a layer holding only `grid`/`level` is not dropped).
 *
 * The entry is always index 0 (`ingestLayer` pushes every layer). **Do not add the spelled
 * `resolve(entry)`** — layer identity is filesystem identity, so adding a different spelling
 * (a symlink, another letter case) counts one layer twice.
 *
 * **The order is strength order, which is what `model.layers` already is** — never sorted. The
 * tool says "in strength order" and `koyu layers` prints the same order; sorting by path here made
 * the two disagree about the same question, and strength is the answer an agent needs (it decides
 * which layer's opinion wins).
 */
function layerFiles(model: Model): string[] {
  return [...model.layers];
}

/** A path as the filesystem sees it; the spelling if it cannot be resolved — the same rule as layer identity (`parse-file.ts`) */
function real(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

/** entryディレクトリ境界の検査 — 文字列prefixではなく相対パスで判定する (ADR-0013) */
function assertInside(entryDir: string, targetDir: string): void {
  const rel = relative(entryDir, targetDir);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("Cannot write outside the entry's directory");
  }
}

function summarize(model: Model, file: string): unknown {
  const rooms = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level);
  const indoor = rooms.filter((s) => isIndoor(model, s));
  const semi = rooms.filter((s) => !isVoid(s) && isSemiOutdoor(model, s));
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
    const u = effectiveUse(model, s) ?? "(unspecified)";
    byUse[u] = Math.round(((byUse[u] ?? 0) + (areaM2(s) ?? 0)) * 100) / 100;
  }
  const r = check(model);
  return {
    name: model.name,
    unit: model.unit,
    layers: layerFiles(model),
    levels: levelsSorted(model).map((l) => ({
      name: l.name,
      z: l.z,
      ...(l.h !== undefined ? { h: l.h } : {}),
      ...(l.slab !== undefined ? { slab: l.slab } : {}),
    })),
    spaces: model.spaces.size,
    boundaries: model.boundaries.length,
    // 敷地ゾーンに「専有床面積」の言葉は成り立たない — 敷地形状から導いた面積を返す
    // (同じ敷地について 160 と 3854 の二つの数字が返る、という状態を作らない。ADR-0028)
    zones: [...model.zones.values()].map((z) => {
      const site = z.attrs["site"] === 1;
      const poly = site ? model.polygons.get(z.path) : undefined;
      return {
        path: z.path,
        ...(typeof z.attrs["name"] === "string" ? { name: z.attrs["name"] } : {}),
        ...(site ? { site: true } : {}),
        areaM2: poly ? polygonAreaM2(poly.points) : zoneAreaM2(model, z.path),
      };
    }),
    assets: [...model.assets.values()].map((a) => ({ name: a.name, kind: a.kind, attrs: a.attrs })),
    ...(model.polygons.size
      ? { sitePolygons: [...model.polygons.keys()] }
      : {}),
    totalFloorM2: Math.round(indoor.reduce((a, s) => a + (areaM2(s) ?? 0), 0) * 100) / 100,
    semiOutdoorM2: Math.round(semi.reduce((a, s) => a + (areaM2(s) ?? 0), 0) * 100) / 100,
    floorsM2: byLevel,
    byUseM2: byUse,
    check: { errors: r.errors.length, warnings: r.warnings.length },
    hint: "Read layer contents with layers, check with check, and edit with write_layer (check is the gatekeeper). Architectural verdicts come from validate.",
  };
}

function spaceInfo(model: Model, s: Space): unknown {
  return {
    path: s.path,
    // 型は任意の自由なラベルなので、書かれていなければ鍵ごと出ない。
    // **構成の事実はこの語ではなく下の二つが答える** — 型が無い空間について
    // 「外部か」「吹抜けか」を消費側が推測できてしまうと、廃止した推定が戻る
    ...(s.type !== undefined ? { type: s.type } : {}),
    name: displayName(s),
    level: s.level,
    areaM2: areaM2(s),
    ...(isOutside(s) ? { outside: true } : {}),
    ...(isVoid(s) ? { void: true } : {}),
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
  file: { type: "string", description: "Path to the entry .muro file (imports are composed automatically)" },
};
const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v) throw new Error(`${name} (a string) is required`);
  return v;
};

const TOOLS: Record<string, Tool> = {
  model_summary: {
    description:
      "Summary of the building: name, levels, layer composition, zones, door/window assets, areas, and check counts. Call this first",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const file = str(a.file, "file");
      return summarize(load(file), file);
    },
  },
  check: {
    description:
      "The gatekeeper of the build: composes the layers and checks structural consistency. Errors and warnings carry layer:line. Call it after every edit. **This says nothing about architectural soundness** — that is the validate tool",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const m = load(str(a.file, "file"));
      const r = check(m);
      return {
        ok: r.errors.length === 0,
        spaces: m.spaces.size,
        boundaries: m.boundaries.length,
        ...r,
        // 構造化診断 (ADR-0016) — errors と warnings を足したものと同件。並びは走査の順で、
        // errors/warnings はそれを severity で二本に割ったものなので、連結して添字で対応させてはならない。
        // code/severity/path/relatedつき
        diagnostics: checkDiagnostics(m),
      };
    },
  },
  layers: {
    description: "Returns every layer (.muro file) taking part in the composition, in strength order (later layers are stronger), with its source — this is how you read the original",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const file = str(a.file, "file");
      const m = load(file);
      return layerFiles(m).map((f) => ({ file: f, source: readFileSync(f, "utf8") }));
    },
  },
  write_layer: {
    description:
      "Checks a layer (.muro file) before replacing it. Content that would make the composition unparsable is never written (the original stays intact). Check errors are returned but the write still happens, so that an edit spanning several layers can be made in steps — fix it and write again. History is left to git",
    schema: {
      type: "object",
      properties: {
        ...FILE_PROP,
        layer: { type: "string", description: "Path of the .muro file to write (relative to the entry, or absolute)" },
        content: { type: "string", description: "The full text of the layer (a whole-file replacement)" },
      },
      required: ["file", "layer", "content"],
    },
    run: (a) => {
      const file = str(a.file, "file");
      const content = str(a.content, "content");
      // Resolve to the real path: it stops a spelling that goes through a symlink from slipping
      // past the boundary check, and it matches the identity the composition counts layers by
      // (mismatch would make the gatekeeper validate stale content)
      const entryDir = real(resolve(dirname(resolve(file))));
      const target = resolve(entryDir, str(a.layer, "layer"));
      if (!target.endsWith(".muro")) throw new Error("Only .muro files can be written");
      assertInside(entryDir, real(dirname(target)));
      // 門番は書き込みの前 — 差し替え内容で仮想合成し、parse不能なら原本に触れない (ADR-0013)。
      // 合成に参加しないファイルの内容は検証されない (importされた時のcheckが捕まえる)
      let m: Model;
      try {
        m = parseFileWith(resolve(file), (p) => (p === target ? content : undefined));
      } catch (e) {
        return {
          written: false,
          target,
          ok: false,
          parseError: e instanceof Error ? e.message : String(e),
        };
      }
      const r = check(m);
      mkdirSync(dirname(target), { recursive: true });
      assertInside(realpathSync(entryDir), realpathSync(dirname(target))); // symlink経由の脱出も塞ぐ
      const tmp = `${target}.tmp-${process.pid}`;
      writeFileSync(tmp, content);
      renameSync(tmp, target); // 同一ディレクトリ内のrename — 中途半端なファイルを残さない
      return { written: target, ok: r.errors.length === 0, spaces: m.spaces.size, ...r };
    },
  },
  new_uids: {
    description:
      "Mints fresh identity tokens (uid) to write onto spaces or zones with write_layer. They collide with nothing already composed into this model, and 80 bits of randomness keeps them apart from layers that are not composed here. **Nothing assigns a uid on its own** — call this only when a space has to be pointed at across renames (sensors, registers, long-running operations), and run check afterwards, because UID03 is the only thing that proves uniqueness",
    schema: {
      type: "object",
      properties: {
        ...FILE_PROP,
        count: { type: "integer", description: "How many tokens to mint (default 1)" },
      },
      required: ["file"],
    },
    run: (a) => {
      const count = a.count === undefined ? 1 : Number(a.count);
      if (!Number.isInteger(count) || count < 1 || count > 1000) {
        throw new Error("count is an integer between 1 and 1000");
      }
      return {
        uids: newUids(load(str(a.file, "file")), count),
        note: "Write these as uid: on a space or zone. No other element accepts uid (the ledger rejects it). A uid is carried across renames by hand — that act is the record of the design decision that it is still the same space",
      };
    },
  },
  doors: {
    description: "Circulation query: how many doors lie between space A and space B (the path with the fewest doors)",
    schema: {
      type: "object",
      properties: {
        ...FILE_PROP,
        from: { type: "string", description: "Path of the space to start from (e.g. /L9/A/ldk)" },
        to: { type: "string", description: "Path of the space to reach (e.g. /out/road-s)" },
      },
      required: ["file", "from", "to"],
    },
    run: (a) => {
      const route = doorsBetween(load(str(a.file, "file")), str(a.from, "from"), str(a.to, "to"));
      return route ?? { unreachable: true };
    },
  },
  spaces: {
    description: "List of spaces: path, type, level, area, semi-outdoor flag, and originating layer. Optionally filtered by level",
    schema: {
      type: "object",
      properties: { ...FILE_PROP, level: { type: "string", description: "Filter by level name (optional)" } },
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
    description:
      "Daylight inputs: floor area and effective window area for every space written with daylight:1 (a 0.7 factor applies through a covered semi-outdoor space). **It delivers no verdict** — the 1/7 judgement comes from the validate tool",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const m = load(str(a.file, "file"));
      return daylightInputs(m).map((d) => ({
        path: d.space.path,
        name: displayName(d.space),
        windowM2: d.window,
        floorM2: d.floor,
        missingH: d.missingH,
      }));
    },
  },
  validate: {
    description:
      "Architectural verdicts: daylight, envelope continuity, stair proportions, slopes, reachability, column/door collisions, and the site. **This is a different surface from the check guarantee** — findings carry rule/level, never code/severity. The surface grows and is not frozen",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const m = load(str(a.file, "file"));
      const findings = validate(m);
      return {
        findings,
        violations: findings.filter((f) => f.level === "violation").length,
        cautions: findings.filter((f) => f.level === "caution").length,
        note: "These are verdicts, not the structural-consistency guarantee of koyu check",
      };
    },
  },
  site: {
    description: "Site query: site area (declared against derived), road frontage, footprint, and the coverage and floor-area ratios",
    schema: { type: "object", properties: FILE_PROP, required: ["file"] },
    run: (a) => {
      const r = siteReport(load(str(a.file, "file")));
      const site = r.declaredArea ?? r.derivedArea;
      return {
        ...(r.siteZone ? { siteZone: r.siteZone.path } : {}),
        ...(r.polygon ? { polygonVertices: r.polygon.points.length } : {}),
        declaredAreaM2: r.declaredArea,
        derivedAreaM2: r.derivedArea,
        ...(r.declaredArea !== undefined && r.derivedArea !== undefined
          ? { areaMatch: Math.abs(r.declaredArea - r.derivedArea) < 0.05 }
          : {}),
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
    description: "Generates and returns the plan SVG for a level (form is generated, not written — the lowest level doubles as the site plan)",
    schema: {
      type: "object",
      properties: { ...FILE_PROP, level: { type: "string", description: "Level name (e.g. L5)" } },
      required: ["file", "level"],
    },
    run: (a) => svgPlan(load(str(a.file, "file")), { level: str(a.level, "level") }),
  },
  canonical_json: {
    description: "The canonical JSON (machine format — one composed model, byte-stable). The ground for diffing and for external connections",
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
        serverInfo: { name: "koyu", version: "0.17.0" },
        instructions:
          "Server for koyu, a space-first architectural description. Grasp the building with model_summary, read the original layers with layers, and edit with write_layer. check is the gatekeeper of the build and returns errors tagged layer:line — it guarantees structural consistency only. validate delivers the architectural verdicts, which are a separate and unfrozen surface. doors/light/site/spaces are different questions put to the same description. Form (plan_svg) is generated, never written.",
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
        rpcError(id, -32602, `Unknown tool: ${name}`);
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
      rpcError(id, -32601, `Unsupported method: ${method}`);
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
