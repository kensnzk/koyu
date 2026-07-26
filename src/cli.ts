#!/usr/bin/env node
// koyu — CLI
//   npm run koyu -- check  examples/office.muro   # --json で構造化診断、--strict で警告も終了コード1
//   npm run koyu -- diff   before.muro after.muro # 構成の言葉の差分 (--json で ModelDiff)
//   npm run koyu -- plan   examples/office.muro -l L2 -o out/office-L2.svg
//   npm run koyu -- doors  examples/office.muro /L2/office /out
//   npm run koyu -- graph  examples/office.muro
//   npm run koyu -- stats  examples/office.muro
//   npm run koyu -- levels examples/office.muro   # テキストの矩計 (高さの積み上がり)
//   npm run koyu -- json   examples/office.muro

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check, checkDiagnostics, type Diagnostic } from "./check.js";
import { renderDiff, semanticDiff } from "./diff.js";
import { doorsBetween, neighbors } from "./graph.js";
import { daylight } from "./light.js";
import { siteReport } from "./site.js";
import {
  areaM2,
  displayName,
  effectiveUse,
  heff,
  isSemiOutdoor,
  levelsSorted,
  SourceError,
  toCanonical,
  zoneAreaM2,
  type Model,
} from "./model.js";
import { parseFile } from "./parse-file.js";
import { svgPlan } from "./plan.js";
import { svgAxo } from "./axo.js";
import { slopeText, verticalRuns } from "./vertical.js";

function load(file: string): Model {
  return parseFile(file); // import による合成もここで働く
}

/** `-l L1..L5` / `-l L1,L3` をレベル名の列へ */
function expandLevelArg(model: Model, arg: string): string[] {
  const all = levelsSorted(model).map((l) => l.name);
  const m = /^([A-Za-z]+\d+)\.\.([A-Za-z]+\d+)$/.exec(arg);
  if (!m) return arg.split(",").filter((n) => all.includes(n));
  const za = model.levels[m[1]!]?.z;
  const zb = model.levels[m[2]!]?.z;
  if (za === undefined || zb === undefined) return [];
  return levelsSorted(model)
    .filter((l) => l.z >= Math.min(za, zb) && l.z <= Math.max(za, zb))
    .map((l) => l.name);
}

function opt(rest: string[], ...names: string[]): string | undefined {
  for (const n of names) {
    const i = rest.indexOf(n);
    if (i >= 0 && rest[i + 1]) return rest[i + 1];
  }
  return undefined;
}

function main(argv: string[]): number {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) {
    console.log(
      "使い方: koyu <check|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [引数...]\n" +
        "  check: --json (Diagnostic[]をJSONで出力) / --strict (警告があれば終了コード1)\n" +
        "  diff:  koyu diff <a.muro> <b.muro> [--json] — 構成の言葉の差分 (0=差分なし / 1=差分あり / 2=入力が壊れている)",
    );
    return 2;
  }

  if (cmd === "diff") {
    // semantic diff (ADR-0018) — 構成の言葉で二つのモデルを比べる。
    // 終了コードは 0=差分なし / 1=差分あり / 2=入力が壊れている — checkの0/1と紛れない
    const fileB = rest[0];
    if (!fileB) {
      console.log("使い方: koyu diff <a.muro> <b.muro> [--json]");
      return 2;
    }
    let ma: Model;
    let mb: Model;
    try {
      ma = load(file);
      mb = load(fileB);
    } catch (e) {
      if (e instanceof SourceError) {
        console.error(`✖ ${e.message}`);
        return 2;
      }
      throw e;
    }
    const d = semanticDiff(ma, mb);
    const lines = renderDiff(d);
    if (rest.includes("--json")) {
      console.log(JSON.stringify(d, null, 1));
    } else if (lines.length === 0) {
      console.log("差分なし");
    } else {
      for (const l of lines) console.log(l);
    }
    return lines.length === 0 ? 0 : 1;
  }

  let model: Model;
  try {
    model = load(file);
  } catch (e) {
    // check --json は構文・合成エラー (SourceError) でも有効JSONを返す — SYN01 の1件に写す (ADR-0016)
    if (cmd === "check" && rest.includes("--json") && e instanceof SourceError) {
      const d: Diagnostic = {
        code: "SYN01",
        severity: "error",
        message: e.raw,
        ...(e.line ? { line: e.line } : {}),
        ...(e.file !== undefined ? { file: e.file } : {}),
      };
      console.log(JSON.stringify([d], null, 1));
      return 1;
    }
    throw e;
  }

  switch (cmd) {
    case "check": {
      const strict = rest.includes("--strict");
      if (rest.includes("--json")) {
        const diags = checkDiagnostics(model);
        console.log(JSON.stringify(diags, null, 1));
        const bad =
          diags.some((d) => d.severity === "error") ||
          (strict && diags.some((d) => d.severity === "warning"));
        return bad ? 1 : 0;
      }
      const { errors, warnings } = check(model);
      for (const w of warnings) console.log(`⚠ ${w}`);
      for (const e of errors) console.log(`✖ ${e}`);
      if (errors.length === 0) {
        console.log(
          `✔ 整合 — 空間 ${model.spaces.size} / 境界 ${model.boundaries.length}` +
            (warnings.length ? ` (警告 ${warnings.length})` : ""),
        );
        return strict && warnings.length > 0 ? 1 : 0;
      }
      return 1;
    }
    case "json": {
      process.stdout.write(toCanonical(model));
      return 0;
    }
    case "plan": {
      const level = opt(rest, "-l", "--level") ?? Object.keys(model.levels)[0];
      const explicit = opt(rest, "-o");
      const outFile =
        explicit ?? `${file.replace(/\.muro$/, "")}-${level}.svg`;
      const svg = svgPlan(model, { level });
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, svg);
      console.log(`平面図を生成しました: ${outFile}`);
      return 0;
    }
    case "doors": {
      const [from, to] = rest;
      if (!from || !to) {
        console.log("使い方: koyu doors <file> /パスA /パスB");
        return 2;
      }
      const route = doorsBetween(model, from, to);
      if (!route) {
        console.log(`${from} から ${to} へは到達できません`);
        return 1;
      }
      console.log(`${route.doors}枚 — ${route.path.join(" → ")}`);
      return 0;
    }
    case "graph": {
      for (const s of model.spaces.values()) {
        const ns = neighbors(model, s.path);
        console.log(`${s.path} (${displayName(s)})`);
        for (const n of ns) {
          const mark =
            n.boundary.kind === "open"
              ? "〰 開放"
              : n.boundary.kind === "wall" && n.boundary.air && !n.passable
                ? "| 手すり等(外気開放・通行不可)"
                : n.boundary.kind === "stair"
                ? "↕ 階段"
                : n.boundary.kind === "shaft"
                  ? "↕ シャフト(通行不可)"
                  : n.boundary.kind === "void"
                    ? "↕ 吹抜け"
                    : n.passable
                      ? `— 扉${n.doors}`
                      : "| 壁";
          const attrs = Object.entries(n.boundary.attrs)
            .map(([k, v]) => `${k}:${v}`)
            .join(" ");
          console.log(`  ${mark} → ${n.space.path}${attrs ? `  (${attrs})` : ""}`);
        }
      }
      return 0;
    }
    case "stats": {
      const levels = levelsSorted(model);
      const spaces = [...model.spaces.values()];
      let total = 0;
      const byType = new Map<string, number>();
      const byUse = new Map<string, number>();
      let semiTotal = 0;
      for (const l of levels) {
        const onLevel = spaces.filter((s) => s.level === l.name && s.rects.length > 0);
        if (onLevel.length === 0) continue;
        console.log(`${l.name}`);
        let sub = 0;
        for (const s of onLevel) {
          if (s.type === "void") {
            console.log(`  ${s.path}\t${displayName(s)}\t吹抜け (床面積不算入)`);
            continue;
          }
          const a = areaM2(s)!;
          if (isSemiOutdoor(model, s)) {
            semiTotal += a;
            console.log(
              `  ${s.path}\t${displayName(s)}\t${s.type}\t${a.toFixed(2)}㎡ (半屋外・別掲)`,
            );
            continue;
          }
          sub += a;
          total += a;
          byType.set(s.type, (byType.get(s.type) ?? 0) + a);
          const use = effectiveUse(model, s);
          if (use) byUse.set(use, (byUse.get(use) ?? 0) + a);
          console.log(`  ${s.path}\t${displayName(s)}\t${s.type}\t${a.toFixed(2)}㎡`);
        }
        console.log(`  小計 ${sub.toFixed(2)}㎡`);
      }
      console.log(`合計 ${total.toFixed(2)}㎡ (屋内床面積)`);
      if (semiTotal > 0) {
        console.log(`半屋外 ${semiTotal.toFixed(2)}㎡ (バルコニー・屋外階段等 — 算入条件は法規細部のため別掲)`);
      }
      const zonesToShow = [...model.zones.values()].filter((z) => z.attrs["site"] !== 1);
      if (zonesToShow.length > 0) {
        console.log("ゾーン別 (数える集約):");
        for (const z of zonesToShow.sort((a, b) => (a.path < b.path ? -1 : 1))) {
          const nm = z.attrs["name"];
          console.log(
            `  ${z.path}\t${typeof nm === "string" ? nm : ""}\t${zoneAreaM2(model, z.path).toFixed(2)}㎡`,
          );
        }
      }
      for (const [t, a] of byType) console.log(`  ${t}: ${a.toFixed(2)}㎡`);
      if (byUse.size > 0) {
        const parts = [...byUse.entries()].map(
          ([u, a]) => `${u} ${a.toFixed(2)}㎡ (${((a / total) * 100).toFixed(1)}%)`,
        );
        console.log(`use別: ${parts.join(" / ")}`);
      }
      return 0;
    }
    case "light": {
      const results = daylight(model);
      if (results.length === 0) {
        console.log("採光の対象がありません (判定する室に daylight:1 を書きます)");
        return 0;
      }
      let fail = 0;
      for (const r of results) {
        if (!r.ok) fail++;
        const ratio = r.window > 0 ? `1/${(r.floor / r.window).toFixed(1)}` : "窓なし";
        console.log(
          `${r.ok ? "✔" : "✖"} ${r.space.path}\t${displayName(r.space)}\t窓 ${r.window.toFixed(2)}㎡ / 床 ${r.floor.toFixed(2)}㎡ = ${ratio} (必要 1/7 ≈ ${r.need.toFixed(2)}㎡)` +
            (r.missingH ? " ⚠ h未指定の窓は数えていません" : ""),
        );
      }
      console.log(
        fail === 0
          ? `✔ 全${results.length}室が 1/7 を満たします (補正係数なしの粗い判定)`
          : `✖ ${results.length}室中 ${fail}室が不足しています`,
      );
      return fail === 0 ? 0 : 1;
    }
    case "site": {
      // 敷地の問い: 敷地面積・接道・建蔽率・容積率 (基本計画のボリューム検討の数字)
      const r = siteReport(model);
      if (!r.siteZone && r.roads.length === 0) {
        console.log("敷地がありません (zone に site:1 を、道路に road:幅員 を宣言します)");
        return 1;
      }
      const site = r.declaredArea ?? r.derivedArea;
      if (r.siteZone) {
        const nm = r.siteZone.attrs["name"];
        console.log(`敷地 ${r.siteZone.path}${typeof nm === "string" ? ` (${nm})` : ""}`);
      }
      if (r.polygon) {
        console.log(`  敷地形状: 多角形 ${r.polygon.points.length}頂点 (polygon宣言 — 所与のジオメトリ)`);
      }
      if (r.declaredArea !== undefined) {
        const ok = Math.abs(r.declaredArea - r.derivedArea) < 0.05;
        console.log(
          `  敷地面積: 宣言 ${r.declaredArea.toFixed(2)}㎡ / 導出 ${r.derivedArea.toFixed(2)}㎡ ${ok ? "✔ 一致" : `⚠ 不一致 (${r.polygon ? "測量値と多角形の食い違い" : "タイルの隙間か重なり"})`}`,
        );
      } else {
        console.log(`  敷地面積 (導出): ${r.derivedArea.toFixed(2)}㎡`);
      }
      for (const road of r.roads) {
        const nm = road.road.attrs["name"];
        console.log(
          `  接道: ${road.road.path}${typeof nm === "string" ? ` (${nm})` : ""} 幅員${road.width}mm ・ 接道長 ${road.frontage}mm ${road.frontage >= 2000 ? "✔ 2m以上" : "✖ 2m未満"}`,
        );
      }
      console.log(`  建築面積 (水平投影・粗): ${r.footprint.toFixed(2)}㎡ → 建蔽率 ${((r.footprint / site) * 100).toFixed(1)}%`);
      console.log(`  延べ面積: ${r.totalFloor.toFixed(2)}㎡ → 容積率 ${((r.totalFloor / site) * 100).toFixed(1)}%`);
      return 0;
    }
    case "axo": {
      // 軸測図 — 立体をそのまま投影する。平面と同じく生成物のSVGなので、
      // 実行環境もWebGLも要らず、生成して見るという同じ手で立体を確かめられる
      const outPath = opt(rest, "-o", "--out") ?? "out/axo.svg";
      const dirOpt = opt(rest, "-d", "--dir") as "NE" | "NW" | "SE" | "SW" | undefined;
      const lv = opt(rest, "-l", "--levels");
      const sc = opt(rest, "-s", "--scale");
      const svg = svgAxo(model, {
        ...(dirOpt ? { dir: dirOpt } : {}),
        ...(lv ? { levels: expandLevelArg(model, lv) } : {}),
        ...(sc ? { scale: Number(sc) } : {}),
        ...(rest.includes("--ceilings") ? { ceilings: true } : {}),
        ...(rest.includes("--no-walls") ? { walls: false } : {}),
      });
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, svg);
      console.log(`軸測図を生成しました: ${outPath}`);
      return 0;
    }

    case "runs": {
      // 縦動線 (ADR-0021): 段数も踏面も勾配も原本には書かれていない。全て導出値である
      const runs = verticalRuns(model);
      if (runs.length === 0) {
        console.log("縦動線がありません (stair:N / ramp:N / escalator:N / lift:1 を空間に書きます)");
        return 0;
      }
      for (const r of runs) {
        const s = model.spaces.get(r.path);
        const nm = s ? displayName(s) : r.path;
        const head = `${r.level}${r.upper ? `→${r.upper}` : ""}\t${r.device}\t${nm}`;
        if (r.device === "lift") {
          console.log(`${head}\t${r.path}`);
          continue;
        }
        const shape =
          r.device === "stair"
            ? `${r.risers}段 蹴上${Math.round(r.riser)} 踏面${Math.round(r.tread)}`
            : `勾配 ${slopeText(r.slope)}`;
        console.log(
          `${head}\t上り${r.rise}mm\t${r.form === "return" ? "折返し" : "直"}\t${shape}\t走り${Math.round(r.going)}mm\t${r.path}`,
        );
      }
      return 0;
    }

    case "levels": {
      // テキストの矩計: レベルの積み上がりと高さの検算
      const levels = levelsSorted(model);
      if (levels.length === 0) {
        console.log("レベルが定義されていません");
        return 1;
      }
      for (let i = levels.length - 1; i >= 0; i--) {
        const l = levels[i]!;
        const upper = levels[i + 1];
        console.log(
          `${l.name}\tz:${l.z}` +
            (l.h !== undefined ? `\th:${l.h}` : "") +
            (l.slab !== undefined ? `\tslab:${l.slab}` : ""),
        );
        if (upper) {
          const pitch = upper.z - l.z;
          const detail =
            l.h !== undefined && upper.slab !== undefined
              ? ` = 天井${l.h} + slab${upper.slab}` +
                (pitch - l.h - upper.slab > 0 ? ` + 余り${pitch - l.h - upper.slab}` : "")
              : "";
          console.log(`  ↑ 階高 ${pitch}${detail}`);
        }
      }
      const spaces = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level);
      const overrides = spaces.filter((s) => typeof s.attrs["h"] === "number");
      for (const s of overrides) {
        console.log(`個別天井高: ${s.path} h:${heff(model, s)}`);
      }
      return 0;
    }
    default:
      console.log(`未知のコマンドです: ${cmd}`);
      return 2;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  if (e instanceof SourceError) {
    console.error(`✖ ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
