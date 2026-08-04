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
//
// **人向けの出力は英語である。**機械が読む面 (診断・Finding・MCP) と同じ言葉に揃えてあり、
// locale 引数は持たない — 同じ文言の台帳を二つ持たないためである。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { check, checkDiagnostics, type Diagnostic } from "./core/diagnose.js";
import { renderDiff, semanticDiff } from "./core/diff.js";
import { doorsBetween, neighbors } from "./core/graph.js";
import { daylightInputs } from "./core/light.js";
import { assess } from "./validate/assessment.js";
import { AssessmentConfigError, type AssessmentReport } from "./validate/contracts.js";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "./validate/builtin/index.js";
import { siteReport } from "./core/site.js";
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
  srcRef,
  isOutside,
  isVoid
} from "./core/model.js";
import { parseFile } from "./parse-file.js";
import { svgPlan } from "./draw/plan.js";
import { svgAxo } from "./draw/axo.js";
import { slopeText, verticalRuns } from "./core/vertical.js";

function load(file: string): Model {
  return parseFile(file); // import による合成もここで働く
}

/** 数と名詞 — 英語は数が先に立ち、1のときだけ単数形になる */
function qty(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `-l L1..L5` / `-l L1,L3` をレベル名の列へ */
/**
 * `-l` の解決。**解決できない指定は空配列に落とさない** — 空配列は「一枚も描かない」を
 * 意味するので、中身の無いSVGを終了コード0で「生成しました」と印字することになる。
 * 呼び方の問題は呼び方の問題として返す (ADR-0028)。
 */
function expandLevelArg(model: Model, arg: string): string[] {
  const all = levelsSorted(model).map((l) => l.name);
  // 端点に数字を要求しない — complex の `R` (屋上) のようなレベル名も端点に取れる
  const m = /^([^.,]+)\.\.([^.,]+)$/.exec(arg);
  if (!m) {
    const names = arg.split(",");
    const unknown = names.filter((n) => !all.includes(n));
    if (unknown.length > 0) die(`Undeclared level: ${unknown.join(",")} (declared: ${all.join(" ")})`);
    return names;
  }
  const za = model.levels[m[1]!]?.z;
  const zb = model.levels[m[2]!]?.z;
  if (za === undefined || zb === undefined) {
    const bad = [m[1]!, m[2]!].filter((n) => model.levels[n] === undefined);
    die(`Undeclared level: ${bad.join(",")} (declared: ${all.join(" ")})`);
  }
  const out = levelsSorted(model)
    .filter((l) => l.z >= Math.min(za!, zb!) && l.z <= Math.max(za!, zb!))
    .map((l) => l.name);
  if (out.length === 0) die(`No level falls in the range ${arg}`);
  return out;
}

/** 呼び方の問題は終了コード2 (使い方と同じ扱い — 構成の問題ではない) */
function die(message: string): never {
  console.error(message);
  process.exit(2);
}

function opt(rest: string[], ...names: string[]): string | undefined {
  for (const n of names) {
    const i = rest.indexOf(n);
    if (i >= 0 && rest[i + 1]) return rest[i + 1];
  }
  return undefined;
}

/**
 * 数を取る引数。**読めない値を黙って NaN のまま通さない。**
 * `-s abc` は `width="NaN"` のSVGを終了コード0で書き出していた — 生成に成功したと言いながら
 * 開けない図を残すのは、呼び方の問題を作品の問題に化けさせる。呼び方の問題として返す (ADR-0028)
 */
function numOpt(rest: string[], ...names: string[]): number | undefined {
  const raw = opt(rest, ...names);
  if (raw === undefined) return undefined;
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) die(`${names[0]} takes a positive number: ${raw}`);
  return v;
}

/** 語彙の決まった引数。台帳に無い値は呼び方の問題である */
function enumOpt<T extends string>(
  rest: string[],
  allowed: readonly T[],
  ...names: string[]
): T | undefined {
  const raw = opt(rest, ...names);
  if (raw === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(raw)) {
    die(`${names[0]} is one of ${allowed.join(" / ")}: ${raw}`);
  }
  return raw as T;
}

/** The one profile koyu ships. Any other name is the caller's, and this build cannot resolve it. */
const BUILTIN_PROFILE = SCHEMATIC_PROFILE_ID.id;

/**
 * Run a rule set over the model.
 *
 * The profile and the effective date are **required**. Neither is guessed from the filename,
 * the locale, the environment or the clock: a judgement whose grounds were inferred cannot be
 * reproduced, and one that quietly picked a default is worse than one that refused to start.
 */
function runAssessment(model: Model, rest: string[]): AssessmentReport {
  const profile = opt(rest, "-p", "--profile");
  if (!profile) {
    die(
      "validate needs an explicit profile: --profile <id>\n" +
        `  koyu ships one: ${BUILTIN_PROFILE}`,
    );
  }
  if (profile !== BUILTIN_PROFILE) {
    die(`Unknown profile: ${profile}\n  koyu ships one: ${BUILTIN_PROFILE}`);
  }
  const asOf = opt(rest, "--as-of");
  if (!asOf) {
    die(
      "validate needs an explicit effective date: --as-of YYYY-MM-DD\n" +
        "  the date is not read from the clock, so that the same file judges the same way twice",
    );
  }

  try {
    return assess(model, {
      registry: createSchematicRegistry(),
      profile: SCHEMATIC_PROFILE_ID,
      context: { schema: "koyu-context/1", asOf, values: {} },
    });
  } catch (e) {
    // Configuration is the caller's problem, so it exits like a usage error rather than a verdict.
    if (e instanceof AssessmentConfigError) die(`✖ ${e.message}`);
    throw e;
  }
}

/**
 * 0 only when the whole set ran and nothing was violated.
 *
 * A caution that failed still exits 0 — it is a doubt, not a breach. But an indeterminate rule,
 * a rule that errored, or an inconsistent model exits 1: **not being able to judge is not the
 * same as passing**, and silence there is exactly what this exit code exists to prevent.
 */
function assessmentExit(report: AssessmentReport): number {
  if (report.summary.state !== "complete") return 1;
  if (report.model.state !== "consistent") return 1;
  return report.findings.some((f) => f.level === "violation") ? 1 : 0;
}

/** The first model-anchored line among a finding's evidence, formatted like every other locator. */
function firstModelLine(evidence: AssessmentReport["findings"][number]["outcome"]["evidence"]): string {
  for (const item of evidence) {
    for (const source of item.sources) {
      if (source.kind === "model" && source.location?.line !== undefined) {
        return `${srcRef(source.location.line, source.location.file)}: `;
      }
    }
  }
  return "";
}

function main(argv: string[]): number {
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file) {
    console.log(
      "Usage: koyu <check|validate|layers|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [args...]\n" +
        "  check:    --json (emit Diagnostic[] as JSON) / --strict (exit 1 if there are warnings) — structural consistency only\n" +
        "  validate: --profile <id> --as-of <YYYY-MM-DD> [--json] — architectural judgement (not what check guarantees)\n" +
        "  layers:   the layers that took part in composition, weakest first. --attrs for the provenance of each attribute\n" +
        "  diff:  koyu diff <a.muro> <b.muro> [--json] — the difference in the language of composition (0=no difference / 1=differences / 2=the input is broken)",
    );
    return 2;
  }

  if (cmd === "diff") {
    // semantic diff (ADR-0018) — 構成の言葉で二つのモデルを比べる。
    // 終了コードは 0=差分なし / 1=差分あり / 2=入力が壊れている — checkの0/1と紛れない
    const fileB = rest[0];
    if (!fileB) {
      console.log("Usage: koyu diff <a.muro> <b.muro> [--json]");
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
      console.log("No differences");
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
          `✔ Consistent — ${qty(model.spaces.size, "space", "spaces")} / ${qty(model.boundaries.length, "boundary", "boundaries")}` +
            (warnings.length ? ` (${qty(warnings.length, "warning", "warnings")})` : ""),
        );
        // **緑の意味を、緑を出す場所で言う。**構造整合が成り立っただけであって、
        // 建築として妥当かはここでは何も言っていない (docs/reference/scope.md)
        console.log("  Structural consistency only — architectural validity is what koyu validate says, separately");
        return strict && warnings.length > 0 ? 1 : 0;
      }
      return 1;
    }
    case "validate": {
      // 建築的な判定 (docs/reference/scope.md)。**check の保証ではない** — 型も綴りも別である。
      //
      // profile と基準日は呼び出し側が明示する。管轄も基準日も推測せず、内蔵 profile を
      // 黙って選ばない — 無根拠に成功して見える判定より、入力不足で止まる方を採る。
      const report = runAssessment(model, rest);
      if (rest.includes("--json")) {
        console.log(JSON.stringify(report, null, 1));
        return assessmentExit(report);
      }
      for (const f of report.findings) {
        const where = firstModelLine(f.outcome.evidence);
        console.log(
          `${f.level === "violation" ? "✖" : "⚠"} [${f.rule.id}] ${where}${f.outcome.message}`,
        );
      }
      const violations = report.findings.filter((f) => f.level === "violation").length;
      const cautions = report.findings.length - violations;
      console.log(
        report.findings.length === 0
          ? "✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)"
          : `Validation — ${qty(violations, "violation", "violations")} / ${qty(cautions, "caution", "cautions")}`,
      );
      console.log(
        `  ${report.profile.id}@${report.profile.revision} — ` +
          `${report.summary.rules.evaluated} evaluated / ${report.summary.rules.notApplicable} not applicable / ` +
          `${report.summary.rules.indeterminate} indeterminate / ${report.summary.rules.error} error`,
      );
      if (report.summary.state === "incomplete") {
        console.log("  Incomplete — something could not be judged, which is not the same as passing");
      }
      return assessmentExit(report);
    }
    case "layers": {
      // 合成の規則1と6 (docs/reference/muro/import.md) — 強度順序を見せ、最終値の出所を言う。
      // **暗黙の解決はどこにも無い**ことを、目で確かめられるようにするための面である
      if (model.layers.length === 0) {
        console.log("No layers (parsing a single file involves no composition)");
        return 0;
      }
      console.log("Layers (weakest first — later layers are stronger):");
      model.layers.forEach((l, i) => console.log(`  ${i}\t${l}`));
      if (rest.includes("--attrs")) {
        console.log("\nAttribute provenance:");
        const rows = [...model.attrSrc].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        for (const [key, layerIdx] of rows) {
          console.log(`  ${key}\t← ${layerIdx} ${model.layers[layerIdx] ?? "?"}`);
        }
      }
      return 0;
    }
    case "json": {
      process.stdout.write(toCanonical(model));
      return 0;
    }
    case "plan": {
      const level = opt(rest, "-l", "--level") ?? Object.keys(model.levels)[0];
      // 未宣言のレベルは呼び方の問題 — 生のスタックトレースで落ちない (ADR-0028)
      if (level !== undefined && model.levels[level] === undefined) {
        die(
          `Undeclared level: ${level} (declared: ${levelsSorted(model).map((l) => l.name).join(" ")})`,
        );
      }
      const explicit = opt(rest, "-o");
      const outFile =
        explicit ?? `${file.replace(/\.muro$/, "")}-${level}.svg`;
      const svg = svgPlan(model, { level });
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, svg);
      console.log(`Generated the plan: ${outFile}`);
      return 0;
    }
    case "doors": {
      const [from, to] = rest;
      if (!from || !to) {
        console.log("Usage: koyu doors <file> /pathA /pathB");
        return 2;
      }
      const route = doorsBetween(model, from, to);
      if (!route) {
        console.log(`Cannot reach ${to} from ${from}`);
        return 1;
      }
      console.log(`${qty(route.doors, "door", "doors")} — ${route.path.join(" → ")}`);
      return 0;
    }
    case "graph": {
      for (const s of model.spaces.values()) {
        const ns = neighbors(model, s.path);
        console.log(`${s.path} (${displayName(s)})`);
        for (const n of ns) {
          const mark =
            n.boundary.kind === "open"
              ? "〰 open"
              : n.boundary.kind === "wall" && n.boundary.air && !n.passable
                ? "| railing etc. (open to the air, not passable)"
                : n.boundary.kind === "stair"
                ? "↕ stair"
                : n.boundary.kind === "shaft"
                  ? "↕ shaft (not passable)"
                  : n.boundary.kind === "void"
                    ? "↕ void"
                    : n.passable
                      ? `— ${qty(n.doors, "door", "doors")}`
                      : "| wall";
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
      let outdoorTotal = 0;
      for (const l of levels) {
        const onLevel = spaces.filter((s) => s.level === l.name && s.rects.length > 0);
        if (onLevel.length === 0) continue;
        console.log(`${l.name}`);
        let sub = 0;
        for (const s of onLevel) {
          if (isVoid(s)) {
            console.log(`  ${s.path}\t${displayName(s)}\tvoid (not counted as floor area)`);
            continue;
          }
          const a = areaM2(s)!;
          if (isOutside(s)) {
            outdoorTotal += a;
            console.log(`  ${s.path}\t${displayName(s)}\t${s.type ?? "(untyped)"}\t${a.toFixed(2)} m2 (outdoor, not counted)`);
            continue;
          }
          if (isSemiOutdoor(model, s)) {
            semiTotal += a;
            console.log(
              `  ${s.path}\t${displayName(s)}\t${s.type ?? "(untyped)"}\t${a.toFixed(2)} m2 (semi-outdoor, reported separately)`,
            );
            continue;
          }
          sub += a;
          total += a;
          // 型は任意なので、書かれなかった行にも小計の座が要る。**既定の語は捏造しない** —
          // "(untyped)" は集計の見出しであって、その空間の型ではない (mcp の "(unspecified)" と同じ構え)
          const label = s.type ?? "(untyped)";
          byType.set(label, (byType.get(label) ?? 0) + a);
          const use = effectiveUse(model, s);
          if (use) byUse.set(use, (byUse.get(use) ?? 0) + a);
          console.log(`  ${s.path}\t${displayName(s)}\t${label}\t${a.toFixed(2)} m2`);
        }
        console.log(`  Subtotal ${sub.toFixed(2)} m2`);
      }
      console.log(`Total ${total.toFixed(2)} m2 (indoor floor area)`);
      if (outdoorTotal > 0) {
        console.log(`Outdoor ${outdoorTotal.toFixed(2)} m2 (plazas, open ground and the like — not counted as floor area)`);
      }
      if (semiTotal > 0) {
        console.log(`Semi-outdoor ${semiTotal.toFixed(2)} m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)`);
      }
      const zonesToShow = [...model.zones.values()].filter((z) => z.attrs["site"] !== 1);
      if (zonesToShow.length > 0) {
        console.log("By zone (counted aggregation):");
        for (const z of zonesToShow.sort((a, b) => (a.path < b.path ? -1 : 1))) {
          const nm = z.attrs["name"];
          console.log(
            `  ${z.path}\t${typeof nm === "string" ? nm : ""}\t${zoneAreaM2(model, z.path).toFixed(2)} m2`,
          );
        }
      }
      for (const [t, a] of byType) console.log(`  ${t}: ${a.toFixed(2)} m2`);
      if (byUse.size > 0) {
        const parts = [...byUse.entries()].map(
          ([u, a]) => `${u} ${a.toFixed(2)} m2 (${((a / total) * 100).toFixed(1)}%)`,
        );
        console.log(`By use: ${parts.join(" / ")}`);
      }
      return 0;
    }
    case "light": {
      // **数だけを返す。**床面積と有効窓面積は模型から出る事実であり、そこへ線を引くのは
      // 規則の側の仕事である。閾値をここに書けば validate と二重になり、片方だけが古くなる
      // (docs/reference/scope.md)。合否は koyu validate が言う
      const inputs = daylightInputs(model);
      if (inputs.length === 0) {
        console.log("Nothing is in daylight scope (write daylight:1 on the rooms to be judged)");
        return 0;
      }
      for (const d of inputs) {
        const ratio = d.window > 0 ? `1/${(d.floor / d.window).toFixed(1)}` : "no window";
        console.log(
          `  ${d.space.path}\t${displayName(d.space)}\twindow ${d.window.toFixed(2)} m2 / floor ${d.floor.toFixed(2)} m2 = ${ratio}` +
            (d.missingH ? " ⚠ windows without h: are not counted" : ""),
        );
      }
      console.log(
        `${qty(inputs.length, "room", "rooms")} in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)`,
      );
      return 0;
    }
    case "site": {
      // 敷地の問い: 敷地面積・接道・建蔽率・容積率 (基本計画のボリューム検討の数字)
      const r = siteReport(model);
      // 測地の枠 (ADR-0057) — 敷地の有無と無関係に、書かれていれば読み上げる。
      // **方位は言葉にする。**磁北を書き写した値は範囲内の整った数で、文法では捕まらない。
      // 人が一度声に出して読むことだけが、5〜9.5度の取り違えを捕まえる
      if (model.origin) {
        const o = model.origin;
        const height =
          o.elevation !== undefined
            ? ` / elevation ${o.elevation} m of z=0 (vertical CRS ${o.vertical})`
            : "";
        console.log(`Frame: EPSG ${o.epsg} / easting ${o.easting} m / northing ${o.northing} m${height}`);
      }
      if (model.azimuth) {
        const deg = model.azimuth.deg;
        const trim = (n: number): string => String(Math.round(n * 1e4) / 1e4);
        const words =
          deg === 0
            ? "due north"
            : deg === 180
              ? "due south"
              : deg < 180
                ? `${trim(deg)}° east of true north`
                : `${trim(360 - deg)}° west of true north`;
        console.log(`Bearing: +Y bears ${trim(deg)}° true — ${words}`);
      }
      if (!r.siteZone && r.roads.length === 0) {
        console.log("There is no site (write site:1 on a zone and road:<width> on the road)");
        return 1;
      }
      const site = r.declaredArea ?? r.derivedArea;
      if (r.siteZone) {
        const nm = r.siteZone.attrs["name"];
        console.log(`Site ${r.siteZone.path}${typeof nm === "string" ? ` (${nm})` : ""}`);
      }
      if (r.polygon) {
        console.log(`  Site shape: polygon with ${r.polygon.points.length} vertices (a polygon declaration — given geometry)`);
      }
      if (r.declaredArea !== undefined) {
        console.log(
          `  Site area: declared ${r.declaredArea.toFixed(2)} m2 / derived ${r.derivedArea.toFixed(2)} m2`,
        );
      } else {
        console.log(`  Site area (derived): ${r.derivedArea.toFixed(2)} m2`);
      }
      for (const road of r.roads) {
        const nm = road.road.attrs["name"];
        console.log(
          `  Road: ${road.road.path}${typeof nm === "string" ? ` (${nm})` : ""} width ${road.width}mm / frontage ${road.frontage}mm`,
        );
      }
      console.log(`  Building footprint (horizontal projection, rough): ${r.footprint.toFixed(2)} m2 → building coverage ratio ${r.coveragePercent ?? "—"}%`);
      console.log(`  Total floor area: ${r.totalFloor.toFixed(2)} m2 → floor area ratio ${r.floorAreaRatioPercent ?? "—"}%`);
      return 0;
    }
    case "axo": {
      // 軸測図 — 立体をそのまま投影する。平面と同じく生成物のSVGなので、
      // 実行環境もWebGLも要らず、生成して見るという同じ手で立体を確かめられる
      const outPath = opt(rest, "-o", "--out") ?? "out/axo.svg";
      const dirOpt = enumOpt(rest, ["NE", "NW", "SE", "SW"] as const, "-d", "--dir");
      const lv = opt(rest, "-l", "--levels");
      const sc = numOpt(rest, "-s", "--scale");
      const svg = svgAxo(model, {
        ...(dirOpt ? { dir: dirOpt } : {}),
        ...(lv ? { levels: expandLevelArg(model, lv) } : {}),
        ...(sc !== undefined ? { scale: sc } : {}),
        ...(rest.includes("--ceilings") ? { ceilings: true } : {}),
        ...(rest.includes("--no-walls") ? { walls: false } : {}),
      });
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, svg);
      console.log(`Generated the axonometric: ${outPath}`);
      return 0;
    }

    case "runs": {
      // 縦動線 (ADR-0021): 段数も踏面も勾配も原本には書かれていない。全て導出値である
      const runs = verticalRuns(model);
      if (runs.length === 0) {
        console.log("There is no vertical circulation (write stair:N / ramp:N / escalator:N / lift:1 on a space)");
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
            ? `${qty(r.risers, "riser", "risers")} of ${Math.round(r.riser)}mm, tread ${Math.round(r.tread)}mm`
            : `slope ${slopeText(r.slope)}`;
        console.log(
          `${head}\trise ${r.rise}mm\t${r.form === "return" ? "return" : "straight"}\t${shape}\tgoing ${Math.round(r.going)}mm\t${r.path}`,
        );
      }
      return 0;
    }

    case "levels": {
      // テキストの矩計: レベルの積み上がりと高さの検算
      const levels = levelsSorted(model);
      if (levels.length === 0) {
        console.log("No level is defined");
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
              ? ` = ceiling ${l.h} + slab ${upper.slab}` +
                (pitch - l.h - upper.slab > 0 ? ` + ${pitch - l.h - upper.slab} left over` : "")
              : "";
          console.log(`  ↑ storey height ${pitch}${detail}`);
        }
      }
      const spaces = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level);
      const overrides = spaces.filter((s) => typeof s.attrs["h"] === "number");
      for (const s of overrides) {
        console.log(`Per-space ceiling height: ${s.path} h:${heff(model, s)}`);
      }
      return 0;
    }
    default:
      console.log(`Unknown command: ${cmd}`);
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
