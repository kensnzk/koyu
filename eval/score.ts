// koyu eval — 採点器 (scorer)
//
// 一つの課題 (task.json) と一つの作業ディレクトリを受け取り、その中の .muro を合成して
// 課題が宣言した全オラクルを回し、オラクルごとの合否表を出す。
//
// 設計の要:
//   ・CLI を叩かない。公開API (src/index.ts / src/parse-file.ts) を直に使う。
//     CLI を経由すると終了コードという一次元の情報しか取れず、「どのオラクルが落ちたか」が消える。
//   ・オラクルは必ず複数。単一の報酬は報酬ハックを招く (床平面RLVR研究 arXiv 2605.14117 —
//     ある制約だけを満たすためにモデルは部屋をゼロまで縮める)。本採点器は
//     オラクルが2つ未満の課題を実行拒否する (validateTask)。
//   ・合成に失敗した (パースできない) ことは「オラクルの不合格」ではなく別の結末である。
//     失敗種別 syntax / compose として報告し、例外で落ちない。
//
// 使い方:
//   npx tsx eval/score.ts <task.json> <workdir> [--json]
//   終了コード 0=全オラクル通過 / 1=不合格 / 2=使い方の誤り・課題定義の不備

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFile } from "../src/parse-file.js";
import { renderDiff } from "../src/core/diff.js";
import { daylightInputs } from "../src/core/light.js";
import {
  SourceError,
  unionAreaM2,
} from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { siteReport } from "../src/core/site.js";
import { checkDiagnostics } from "../src/diagnostics.js";
import { semanticDiff } from "../src/diff.js";
import { doorsBetween } from "../src/graph.js";
import {
  areaM2,
  toCanonical,
  zoneAreaM2,
  type Model,
} from "../src/model.js";
import { validate } from "../src/validate/index.js";

// ---- 課題の型 (TASK FILE FORMAT — 規範) ----

/** BIM-Edit (arXiv 2606.20146) の分類を借りる */
export type TaskOp = "create" | "update" | "delete";
export type TaskKind = "direct" | "spatial" | "topological";

export interface TaskClass {
  op: TaskOp;
  kind: TaskKind;
}

/**
 * オラクル。max/min/path/via/label は省略可の拡張であり、規範の必須項目は
 * kind と各種別の主引数 (doors の from/to、assert の expr、diff の expected) である。
 */
export type Oracle =
  | { kind: "check"; strict?: boolean; label?: string }
  | { kind: "light"; label?: string }
  | {
      kind: "doors";
      from: string;
      to: string;
      max?: number;
      min?: number;
      /** 経路の完全一致 (節点パスの配列)。扉数だけでは道路の取り違えを検出できないため */
      path?: string[];
      /** 経路が必ず通る節点 */
      via?: string[];
      label?: string;
    }
  | { kind: "site"; label?: string }
  | { kind: "assert"; expr: string; label?: string }
  | { kind: "diff"; expected: string; label?: string };

export interface Task {
  id: string;
  class: TaskClass;
  /** リポジトリ相対のディレクトリ、または "" (空の作業ディレクトリから作らせる) */
  fixture: string;
  /** 作業コピーの中の入口ファイル */
  entry: string;
  /** 被験エージェントに逐語で与える日本語の指示 */
  instruction: string;
  oracles: Oracle[];
  /**
   * The same claim written over the control group's JSON (W3). The generic oracles — schema, refs,
   * geometry, agreement — are applied to every task by `eval/control/oracle.ts`; what belongs here
   * is only the part specific to this task, and it must ask the geometry rather than a stored
   * number (`areaOf(room(id))`, not `room(id).areaM2`) — otherwise the assertion would pass on a
   * document whose stored values are stale, which is the very failure being measured.
   *
   * `instruction` is required, not optional. Every muro instruction tells the agent to finish with
   * `koyu check --strict`, and the control has no such command — leaving the instruction unchanged
   * would deny the control any way to verify its own work, which is an asymmetry that has nothing to
   * do with derivation. The control is told to run the schema validator instead. That is exactly the
   * control the plan specifies: naive JSON + JSON Schema + a validator.
   *
   * A task without this section can only be run in the muro condition.
   */
  control?: { instruction: string; asserts: Array<{ expr: string; label?: string }> };
  /** なぜこのオラクルの組か / どの報酬ハックをどれが塞ぐか */
  notes?: string;
}

// ---- 採点結果の型 ----

/**
 * 失敗種別 (handoff の taxonomy)。
 * offtrack は人・エージェントしか判定できない。incomplete は原則として人が付けるが、
 * 「入口ファイルすら無い」という極端な形だけは機械にも見えるので自動で付ける。
 */
export type FailureClass = "syntax" | "compose" | "semantic" | "incomplete" | "offtrack";

export interface OracleResult {
  kind: Oracle["kind"];
  label: string;
  pass: boolean;
  /** 人が読む一行。数字は丸めずに出す (再現の突き合わせに使うため) */
  detail: string;
}

export interface ScoreResult {
  taskId: string;
  class: TaskClass;
  workdir: string;
  entry: string;
  /** 合成できたか。false なら oracles は空で failureClass は syntax か compose */
  parsed: boolean;
  parseError?: { message: string; line?: number; file?: string };
  languageVersion?: string;
  oracles: OracleResult[];
  passed: number;
  total: number;
  success: boolean;
  failureClass?: FailureClass;
  /** check オラクルの結果。課題が check を持たなければ undefined */
  checkGreen?: boolean;
  /** 見出しの数字 — check は緑なのに他のオラクルが落ちた */
  checkGreenMeaningWrong: boolean;
}

export interface ScoreOptions {
  /**
   * diff オラクルの expected を解決する基準ディレクトリ。既定は課題ファイルの置き場所。
   * 作業ディレクトリ基準にはしない — 被験エージェントが正解ファイルを書き換えられてしまう。
   */
  taskDir?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
export const EVAL_DIR = HERE;
export const REPO_ROOT = resolve(HERE, "..");

// ---- 補助 (assert オラクルの scope にも入る) ----

/**
 * zone でも space でも面積を返す。
 * tower の /L5/A は zone、/L5/B〜/L5/F は space である (typical.muro が粒度を混ぜている —
 * ADR-0005 の実演)。zoneAreaM2(m,"/L5/B") は 0 を返すので、住戸ごとに使い分けが要る。
 * この糖衣はその取り違えを潰すためにある。
 */
export function areaOf(model: Model, path: string): number | undefined {
  if (model.zones.has(path)) return zoneAreaM2(model, path);
  const s = model.spaces.get(path);
  return s ? areaM2(s) : undefined;
}

/**
 * 敷地の派生指標。SiteReport には areaMatch / coverage / FAR のフィールドが無く、
 * src/mcp.ts:262-267 と src/cli.ts:295-296 がその場で計算している。
 * eval が CLI と同じ数字を出すよう、mcp 版の丸め (Math.round(x*1000)/10) を写す。
 */
export function siteMetrics(model: Model): {
  declaredArea?: number;
  derivedArea: number;
  areaMatch?: boolean;
  footprint: number;
  totalFloor: number;
  coverage?: number;
  FAR?: number;
  roads: Array<{ path: string; widthMm: number; frontageMm: number }>;
} {
  const r = siteReport(model);
  const base = r.declaredArea ?? r.derivedArea;
  return {
    ...(r.declaredArea !== undefined ? { declaredArea: r.declaredArea } : {}),
    derivedArea: r.derivedArea,
    ...(r.declaredArea !== undefined
      ? { areaMatch: Math.abs(r.declaredArea - r.derivedArea) < 0.05 }
      : {}),
    footprint: r.footprint,
    totalFloor: r.totalFloor,
    ...(base ? { coverage: Math.round((r.footprint / base) * 1000) / 10 } : {}),
    ...(base ? { FAR: Math.round((r.totalFloor / base) * 1000) / 10 } : {}),
    roads: r.roads.map((rd) => ({
      path: rd.road.path,
      widthMm: rd.width,
      frontageMm: rd.frontage,
    })),
  };
}

/**
 * The paths that fail the daylight question.
 *
 * `daylightInputs` derives the inputs; the judgement is `daylight.ratio` on the validation face. An
 * expression that wants "which rooms fail" must ask validation — the input records carry no verdict,
 * by design (core derives, validation judges).
 */
const daylightFailures = (m: Model): string[] =>
  validate(m)
    .filter((f) => f.rule === "daylight.ratio")
    .flatMap((f) => f.path ?? [])
    .sort();

/** assert 式に渡す補助のうち、規範の5つ (m, zoneAreaM2, daylight, doorsBetween, siteReport) の後ろに足すもの */
const EXTRA_HELPERS = {
  areaM2,
  daylightFailures,
  areaOf,
  unionAreaM2,
  checkDiagnostics,
  siteMetrics,
  semanticDiff,
  renderDiff,
  parse,
  toCanonical,
};
const EXTRA_HELPER_NAMES = Object.keys(EXTRA_HELPERS);
const EXTRA_HELPER_VALUES = Object.values(EXTRA_HELPERS);

// ---- 課題の読み込みと検証 ----

export function loadTask(taskPath: string): Task {
  const raw = readFileSync(taskPath, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`課題ファイルがJSONとして読めません: ${taskPath} — ${(e as Error).message}`);
  }
  const t = json as Task;
  validateTask(t, taskPath);
  return t;
}

const OPS = new Set<string>(["create", "update", "delete"]);
const KINDS = new Set<string>(["direct", "spatial", "topological"]);

/**
 * 課題定義の検証。オラクルが2つ未満の課題はここで拒否する —
 * 「全ての課題は最低2つのオラクルを持ち、明白な近道が必ずどれかで落ちるように選ぶ」は
 * この harness の存在理由そのものなので、機械で守る。
 */
export function validateTask(t: Task, where = "task"): void {
  const bad = (msg: string): never => {
    throw new Error(`${where}: ${msg}`);
  };
  if (!t || typeof t !== "object") bad("課題がオブジェクトではありません");
  if (typeof t.id !== "string" || t.id === "") bad("id が要ります");
  if (!t.class || !OPS.has(t.class.op)) bad(`class.op は create|update|delete です: ${t.class?.op}`);
  if (!KINDS.has(t.class.kind)) bad(`class.kind は direct|spatial|topological です: ${t.class.kind}`);
  if (typeof t.fixture !== "string") bad("fixture は文字列です (空文字 = 空の作業ディレクトリ)");
  if (typeof t.entry !== "string" || t.entry === "") bad("entry が要ります");
  // entry は必ず作業ディレクトリの中を指す。絶対パスや .. を許すと、門番 (run.ts の
  // assertOutsideRepo) をすり抜けてリポジトリ内の examples/ を読ませることができてしまう。
  if (isAbsolute(t.entry) || t.entry.split(/[\\/]/).includes("..")) {
    bad(`entry は作業ディレクトリ相対で、.. を含んではいけません: ${t.entry}`);
  }
  if (typeof t.instruction !== "string" || t.instruction === "") bad("instruction が要ります");
  if (!Array.isArray(t.oracles)) bad("oracles が配列ではありません");
  if (t.oracles.length < 2) {
    bad(
      `オラクルが ${t.oracles.length} 個しかありません。全ての課題に最低2つが要る — ` +
        "単一の報酬は報酬ハックを招く (arXiv 2605.14117)",
    );
  }
  if (t.control !== undefined) {
    if (typeof t.control.instruction !== "string" || t.control.instruction === "") {
      bad("control には instruction が要ります (muro の指示は koyu check を前提にしているので流用できない)");
    }
    if (!Array.isArray(t.control.asserts) || t.control.asserts.length === 0) {
      bad("control には asserts が最低1つ要ります (無ければ control を書かない)");
    }
    for (const [i, a] of (t.control.asserts as Array<{ expr?: unknown }>).entries()) {
      const expr = a?.expr;
      if (typeof expr !== "string" || expr === "") bad(`control.asserts[${i}]: expr が要ります`);
      // 保存された数字を読む式は、測りたい失敗をすり抜ける
      if (/\.\s*areaM2\b/.test(expr as string)) {
        bad(
          `control.asserts[${i}]: 保存された areaM2 を読んでいます。` +
            "対照群の主張は幾何に問わなければならない (areaOf(room(id)) を使う)",
        );
      }
    }
  }
  for (const [i, o] of t.oracles.entries()) {
    const at = `oracles[${i}]`;
    switch (o.kind) {
      case "check":
      case "light":
      case "site":
        break;
      case "doors":
        if (!o.from || !o.to) bad(`${at}: doors には from と to が要ります`);
        if (o.max === undefined && o.min === undefined && !o.path && !o.via) {
          bad(`${at}: doors には max / min / path / via のいずれかが要ります`);
        }
        break;
      case "assert":
        if (typeof o.expr !== "string" || o.expr === "") bad(`${at}: assert には expr が要ります`);
        break;
      case "diff":
        if (typeof o.expected !== "string" || o.expected === "") {
          bad(`${at}: diff には expected が要ります`);
        }
        break;
      default:
        bad(`${at}: 未知のオラクル種別です: ${(o as { kind: string }).kind}`);
    }
  }
}

function oracleLabel(o: Oracle): string {
  if (o.label) return o.label;
  switch (o.kind) {
    case "doors":
      return `doors ${o.from} → ${o.to}`;
    case "assert":
      return `assert ${o.expr}`;
    case "diff":
      return `diff ${o.expected}`;
    case "check":
      return o.strict ? "check (strict)" : "check";
    default:
      return o.kind;
  }
}

// ---- 合成 ----

/**
 * 合成の失敗を syntax と compose に分ける。
 * compose = 層の重ね合わせ (import・パス/アセット/通りの衝突・版宣言の場所) の失敗。
 * それ以外の一行の文法違反が syntax。
 */
const COMPOSE_RE =
  /(ファイルが読めません|import には|import は|循環|base層|空間パスが重複|ゾーンパスが重複|アセット名が重複|レベルが重複|一度だけ宣言します)/;

export interface BuildOutcome {
  model?: Model;
  error?: { message: string; line?: number; file?: string };
  failureClass?: "syntax" | "compose" | "incomplete";
}

/** 作業ディレクトリの entry を合成する。失敗しても例外を投げない */
export function build(workdir: string, entry: string): BuildOutcome {
  const entryPath = join(workdir, entry);
  if (!existsSync(entryPath)) {
    // 入口ファイルが無いのは「重ね合わせの失敗」ではない。何も出て来なかったということであり、
    // 失敗種別としては incomplete である (白紙から書かせる課題で被験系が一行も書かなかった場合が典型)。
    // compose と混ぜると報告書の失敗種別の表が読めなくなる。
    return {
      error: { message: `入口ファイルがありません: ${entry}` },
      failureClass: "incomplete",
    };
  }
  try {
    return { model: parseFile(entryPath) };
  } catch (e) {
    if (e instanceof SourceError) {
      return {
        error: {
          message: e.raw,
          ...(e.line ? { line: e.line } : {}),
          ...(e.file !== undefined ? { file: e.file } : {}),
        },
        failureClass: COMPOSE_RE.test(e.raw) ? "compose" : "syntax",
      };
    }
    return { error: { message: String((e as Error)?.message ?? e) }, failureClass: "syntax" };
  }
}

// ---- オラクル ----

/** 数値は丸めずそのまま出す。1097.8 は 1097.80 ではない — 突き合わせを壊さないため */
function fmt(n: number): string {
  return String(n);
}

function runOracle(o: Oracle, m: Model, taskDir: string): OracleResult {
  const label = oracleLabel(o);
  const done = (pass: boolean, detail: string): OracleResult => ({ kind: o.kind, label, pass, detail });
  try {
    switch (o.kind) {
      case "check": {
        const diags = checkDiagnostics(m);
        const errors = diags.filter((d) => d.severity === "error");
        const warnings = diags.filter((d) => d.severity === "warning");
        const pass = errors.length === 0 && (!o.strict || warnings.length === 0);
        const codes = [...new Set(diags.map((d) => d.code))].sort();
        // 件数はレベルスパンの展開で倍になる (typical.muro の1行が7〜8階へ波及する)。
        // したがって合否は「0か非0か」で決め、件数は参考として並べるだけにする。
        const codeText = codes.length ? ` [${codes.join(" ")}]` : "";
        return done(pass, `error ${errors.length} / warning ${warnings.length}${codeText}`);
      }
      case "light": {
        // The judgement lives on the validation face, not in core — core only derives the inputs
        // (floor area and effective window area). `daylight.ratio` is the rule that says 1/7.
        const rs = daylightInputs(m);
        const violations = validate(m).filter((f) => f.rule === "daylight.ratio");
        const bad = violations.flatMap((f) => f.path ?? []);
        // 評価対象が0室のときは不合格にする。「居室を全部消せば全室合格」という
        // 真空の真は報酬ハックの入口そのものである。
        if (rs.length === 0) return done(false, "採光の評価対象が0室 (居室が消えている疑い)");
        const names = bad.slice(0, 5).join(" ");
        const more = bad.length > 5 ? ` ほか${bad.length - 5}室` : "";
        const missing = rs.filter((r) => r.missingH).length;
        const note = missing ? ` / h未指定の窓を持つ室 ${missing}` : "";
        return done(
          bad.length === 0,
          bad.length === 0
            ? `評価 ${rs.length}室 / 全室が 1/7 を満たす${note}`
            : `評価 ${rs.length}室 / 不合格 ${bad.length}室: ${names}${more}${note}`,
        );
      }
      case "doors": {
        const r = doorsBetween(m, o.from, o.to);
        if (!r) return done(false, `到達不能 (${o.from} → ${o.to})`);
        const reasons: string[] = [];
        if (o.max !== undefined && r.doors > o.max) reasons.push(`扉${r.doors} > 上限${o.max}`);
        if (o.min !== undefined && r.doors < o.min) reasons.push(`扉${r.doors} < 下限${o.min}`);
        // 扉数だけでは道路の取り違えを検出できない (tower では road-s も road-e も同じ枚数に
        // なる)。path/via が与えられていれば経路そのものも見る。
        if (o.path && (o.path.length !== r.path.length || o.path.some((p, i) => p !== r.path[i]))) {
          reasons.push(`経路不一致 (期待 ${o.path.length}節点 / 実際 ${r.path.length}節点)`);
        }
        if (o.via) {
          const missing = o.via.filter((p) => !r.path.includes(p));
          if (missing.length) reasons.push(`経路が通らない: ${missing.join(" ")}`);
        }
        const base = `扉 ${r.doors} 枚 / 経路 ${r.path.length} 節点`;
        return done(reasons.length === 0, reasons.length ? `${base} — ${reasons.join(" / ")}` : base);
      }
      case "site": {
        const s = siteMetrics(m);
        if (s.areaMatch === undefined) {
          return done(false, "敷地面積の宣言 (zone の area:) が無く照合できません");
        }
        const detail =
          `宣言 ${fmt(s.declaredArea!)}㎡ / 導出 ${fmt(s.derivedArea)}㎡ ` +
          `${s.areaMatch ? "一致" : "不一致"} / 建築面積 ${fmt(s.footprint)}㎡ ` +
          `延べ ${fmt(s.totalFloor)}㎡ / 建蔽 ${s.coverage ?? "—"}% 容積 ${s.FAR ?? "—"}%`;
        return done(s.areaMatch, detail);
      }
      case "assert": {
        // eval/ は内部専用の道具である。課題ファイルはリポジトリ内で人が書いたものだけを
        // 読むので、任意コード実行 (new Function) を許容する。外部入力は通さない。
        // 規範の5引数 (m, zoneAreaM2, daylight, doorsBetween, siteReport) が先頭に来る。
        // 後ろの補助は測定で必要になったもの — 例えば /L5/B〜F は space なので
        // zoneAreaM2 では 0 になり、areaM2 / areaOf が無いと式が書けない。
        //
        // `daylight` is bound to `daylightInputs`. The judgement that used to live behind that name
        // moved to the validation face (`daylight.ratio`) when core and validation were split; the
        // **population is unchanged** — one record per `daylight:1` space with a region — so an
        // existing expression asking `daylight(m).length` still asks exactly what it asked before.
        const fn = new Function(
          "m",
          "zoneAreaM2",
          "daylight",
          "doorsBetween",
          "siteReport",
          ...EXTRA_HELPER_NAMES,
          `return (${o.expr})`,
        );
        const value: unknown = fn(
          m,
          zoneAreaM2,
          daylightInputs,
          doorsBetween,
          siteReport,
          ...EXTRA_HELPER_VALUES,
        );
        // 真偽値の true のみを合格とする。数値が返ったら式の書き損じなので落とす。
        const pass = value === true;
        return done(pass, pass ? "true" : `評価値 ${JSON.stringify(value) ?? String(value)}`);
      }
      case "diff": {
        const p = isAbsolute(o.expected) ? o.expected : resolve(taskDir, o.expected);
        if (!existsSync(p)) return done(false, `期待モデルがありません: ${p}`);
        // 期待モデルは import を持ちうる (tower は多層) ので parseFile で合成する。
        const expected = parseFile(p);
        const lines = renderDiff(semanticDiff(m, expected));
        const head = lines.slice(0, 4).join(" | ");
        const more = lines.length > 4 ? ` ほか${lines.length - 4}件` : "";
        return done(lines.length === 0, lines.length === 0 ? "差分なし" : `差分 ${lines.length}件: ${head}${more}`);
      }
      default:
        return done(false, `未知のオラクル種別: ${(o as { kind: string }).kind}`);
    }
  } catch (e) {
    // オラクルの中で落ちたことは「不合格」であり、harness の停止ではない
    return done(false, `オラクルが例外で落ちました: ${String((e as Error)?.message ?? e)}`);
  }
}

// ---- 採点 ----

export function scoreTask(task: Task, workdir: string, opts: ScoreOptions = {}): ScoreResult {
  validateTask(task, task?.id ?? "task");
  const taskDir = opts.taskDir ?? join(EVAL_DIR, "tasks");
  const built = build(workdir, task.entry);

  if (!built.model) {
    // 合成できないことはオラクルの不合格ではない — 別の結末である
    return {
      taskId: task.id,
      class: task.class,
      workdir,
      entry: task.entry,
      parsed: false,
      ...(built.error ? { parseError: built.error } : {}),
      oracles: [],
      passed: 0,
      total: task.oracles.length,
      success: false,
      failureClass: built.failureClass ?? "syntax",
      checkGreenMeaningWrong: false,
    };
  }

  const m = built.model;
  const results = task.oracles.map((o) => runOracle(o, m, taskDir));
  const passed = results.filter((r) => r.pass).length;
  const success = passed === results.length;
  const checkResults = results.filter((r) => r.kind === "check");
  const checkGreen = checkResults.length ? checkResults.every((r) => r.pass) : undefined;
  // 見出しの数字: check は緑なのに他のオラクルが落ちた = 「整合しているが意味が違う」
  const checkGreenMeaningWrong =
    checkGreen === true && results.some((r) => r.kind !== "check" && !r.pass);

  return {
    taskId: task.id,
    class: task.class,
    workdir,
    entry: task.entry,
    parsed: true,
    languageVersion: m.version,
    oracles: results,
    passed,
    total: results.length,
    success,
    ...(success ? {} : { failureClass: "semantic" as FailureClass }),
    ...(checkGreen === undefined ? {} : { checkGreen }),
    checkGreenMeaningWrong,
  };
}

// ---- 表示 ----

function width(s: string): number {
  // 日本語を含む幅の粗い見積り (全角=2)
  let w = 0;
  for (const ch of s) w += /[　-ヿ㐀-鿿！-｠]/.test(ch) ? 2 : 1;
  return w;
}

function pad(s: string, to: number): string {
  return s + " ".repeat(Math.max(0, to - width(s)));
}

export function renderScore(r: ScoreResult): string[] {
  const out: string[] = [];
  out.push(`課題 ${r.taskId}  [${r.class.op}/${r.class.kind}]`);
  out.push(`入口 ${r.entry}  作業ディレクトリ ${r.workdir}`);
  if (r.languageVersion) out.push(`言語版 ${r.languageVersion}`);
  const rule = "─".repeat(30);
  out.push(rule);
  if (!r.parsed) {
    const e = r.parseError;
    const at = e?.line ? `${e.file ? `${e.file}:` : ""}${e.line}行目: ` : "";
    out.push(`✖ 合成できません — ${at}${e?.message ?? "不明"}`);
    out.push(rule);
    out.push(`結果 ✖ 不合格 (オラクル未実行)  失敗種別 ${r.failureClass}`);
    return out;
  }
  const labelW = Math.max(...r.oracles.map((o) => width(o.label)), 8);
  for (const o of r.oracles) {
    out.push(`${o.pass ? "✔" : "✖"} ${pad(o.label, labelW)}  ${o.detail}`);
  }
  out.push(rule);
  out.push(
    `結果 ${r.success ? "✔ 合格" : "✖ 不合格"} (${r.total}件中 ${r.passed}件通過)` +
      (r.failureClass ? `  失敗種別 ${r.failureClass}` : ""),
  );
  if (r.checkGreenMeaningWrong) {
    out.push("✖ checkは緑だが意味が誤り — 本harnessの見出しの数字に計上される");
  }
  return out;
}

// ---- CLI ----

const USAGE = [
  "使い方: npx tsx eval/score.ts <task.json> <workdir> [--json]",
  "  task.json : 課題定義 (eval/tasks/*.json)",
  "  workdir   : 被験エージェントが編集した作業コピーのディレクトリ",
  "  --json    : 機械可読な ScoreResult を出す",
  "終了コード 0=全オラクル通過 / 1=不合格 / 2=使い方の誤り・課題定義の不備",
].join("\n");

function main(argv: string[]): number {
  const args = argv.filter((a) => a !== "--json");
  const json = argv.includes("--json");
  const taskPath = args[0];
  const workdir = args[1];
  if (!taskPath || !workdir) {
    console.log(USAGE);
    return 2;
  }
  let task: Task;
  try {
    task = loadTask(resolve(taskPath));
  } catch (e) {
    console.error(`✖ ${String((e as Error)?.message ?? e)}`);
    return 2;
  }
  const wd = resolve(workdir);
  if (!existsSync(wd) || !statSync(wd).isDirectory()) {
    console.error(`✖ 作業ディレクトリがありません: ${wd}`);
    return 2;
  }
  const result = scoreTask(task, wd, { taskDir: dirname(resolve(taskPath)) });
  if (json) console.log(JSON.stringify(result, null, 1));
  else for (const l of renderScore(result)) console.log(l);
  return result.success ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
