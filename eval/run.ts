// koyu eval — 走行係 (runner)
//
// この道具の責務は三つだけである (handoff):
//   (a) fixture を一時作業ディレクトリへ複製する
//   (b) オラクルを回す (採点は score.ts が in-process で行う)
//   (c) 結果を記録する
//
// エージェントは駆動しない。最初の基準測定は人が Claude Code を MCP サーバ越しに
// 一課題ずつ動かして行う。したがって「tool呼び出し回数」「消費トークン」「ターン数」は
// harness からは見えない — フラグか小さなJSONで受け取る (下の「人が渡す値」)。
//
// 使い方:
//   npx tsx eval/run.ts prepare <task-id>              作業ディレクトリを作りパスを出す
//   npx tsx eval/run.ts score   <task-id> <workdir>    採点して eval/results/ へ追記
//   npx tsx eval/run.ts report  <label>                記録から報告書を書き出す

import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  build,
  loadTask,
  renderScore,
  scoreTask,
  EVAL_DIR,
  REPO_ROOT,
  type FailureClass,
  type ScoreResult,
  type Task,
  type TaskClass,
} from "./score.js";
import { renderDiff, semanticDiff } from "../src/index.js";

const TASKS_DIR = join(EVAL_DIR, "tasks");
const RESULTS_DIR = join(EVAL_DIR, "results");
const RECORDS = join(RESULTS_DIR, "records.jsonl");

const FAILURE_CLASSES: readonly FailureClass[] = [
  "syntax",
  "compose",
  "semantic",
  "incomplete",
  "offtrack",
];

// ---- 記録の型 ----

export interface RunRecord {
  ts: string;
  taskId: string;
  class: TaskClass;
  /** 言語版 — 0.3 との before/after 比較の軸。合成できなかった走行では undefined */
  languageVersion?: string;
  workdir: string;
  success: boolean;
  failureClass: FailureClass | null;
  /** オラクルごとの合否 */
  oracles: Array<{ kind: string; label: string; pass: boolean; detail: string }>;
  passed: number;
  total: number;
  checkGreen: boolean | null;
  /** 見出しの数字 — check は緑だが意味が誤り */
  checkGreenMeaningWrong: boolean;
  /** 出発状態に対する koyu diff の行数 (renderDiff の行数)。測れなければ null */
  diffLines: number | null;
  /** 人・エージェントしか知らない値 */
  toolCalls: number | null;
  tokens: number | null;
  turns: number | null;
  agent: string | null;
  notes: string | null;
}

// ---- 共通 ----

function die(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(2);
}

/** 存在すれば realpath、しなければ resolve のみ (macOS の /tmp → /private/tmp を潰す) */
function realish(p: string): string {
  const abs = resolve(p);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/**
 * 作業ディレクトリがリポジトリの中なら実行を拒む。
 * examples/ を書き換えられたら基準測定そのものが壊れる — 再走行性が harness の存在理由なので、
 * これは丁寧なお願いではなく門番である。
 */
function assertOutsideRepo(workdir: string): void {
  const wd = realish(workdir);
  const root = realish(REPO_ROOT);
  if (wd === root || wd.startsWith(root + sep)) {
    die(
      `作業ディレクトリがリポジトリの中にあります: ${wd}\n` +
        `  リポジトリ: ${root}\n` +
        "  eval は examples/ を含むリポジトリ内へは一切書きません。prepare が作る一時ディレクトリを使ってください。",
    );
  }
}

/** 課題の解決: eval/tasks/<id>.json → tasks 内の id 一致 → .json のパス直指定 */
export function resolveTaskPath(idOrPath: string): string {
  const direct = join(TASKS_DIR, `${idOrPath}.json`);
  if (existsSync(direct)) return direct;
  if (idOrPath.endsWith(".json") && existsSync(resolve(idOrPath))) return resolve(idOrPath);
  if (existsSync(TASKS_DIR)) {
    for (const f of readdirSync(TASKS_DIR)) {
      if (!f.endsWith(".json")) continue;
      const p = join(TASKS_DIR, f);
      try {
        const t = JSON.parse(readFileSync(p, "utf8")) as { id?: string };
        if (t.id === idOrPath) return p;
      } catch {
        // 壊れた課題ファイルは探索では黙って飛ばす。指定されたときに loadTask が語る
      }
    }
  }
  die(
    `課題が見つかりません: ${idOrPath}\n` +
      `  探した場所: ${direct} / ${TASKS_DIR}/*.json の id / パス直指定`,
  );
}

/**
 * 値を取らないフラグ。これを明示しておかないと `score --json T01 <wd>` のように
 * 真偽フラグを先に書いたときに次の位置引数を値として飲み込んでしまう (課題IDが消える)。
 */
const BOOLEAN_FLAGS = new Set(["json", "dry-run", "latest"]);

/** --k=v と --k v の両方を受ける素朴なフラグ解析 */
function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

function num(v: string | true | undefined): number | null {
  if (v === undefined || v === true) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | true | undefined): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

// ---- 作業ディレクトリの帳簿 ----

/**
 * prepare が作る一時ルートの構造:
 *   <root>/work/   … 被験エージェントに渡すディレクトリ (これのパスを標準出力に出す)
 *   <root>/.base/  … 出発状態の無傷の写し (diff行数の基準)
 *   <root>/meta.json
 * work の親に置くので、エージェントには .base も meta.json も見えない。
 */
interface WorkMeta {
  taskId: string;
  fixture: string;
  entry: string;
  preparedAt: string;
  root: string;
  work: string;
  base: string;
}

function metaFor(workdir: string): WorkMeta | undefined {
  const p = join(dirname(realish(workdir)), "meta.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as WorkMeta;
  } catch {
    return undefined;
  }
}

// ---- prepare ----

function cmdPrepare(argv: string[]): number {
  const { positional } = parseFlags(argv);
  const id = positional[0];
  if (!id) die("使い方: npx tsx eval/run.ts prepare <task-id>");
  const taskPath = resolveTaskPath(id);
  let task: Task;
  try {
    task = loadTask(taskPath);
  } catch (e) {
    die(String((e as Error)?.message ?? e));
  }

  const root = mkdtempSync(join(realish(tmpdir()), "koyu-eval-"));
  assertOutsideRepo(root); // tmpdir がリポジトリ内を指す異常な環境への保険
  const work = join(root, "work");
  const base = join(root, ".base");
  mkdirSync(work, { recursive: true });
  mkdirSync(base, { recursive: true });

  if (task.fixture !== "") {
    const src = isAbsolute(task.fixture) ? task.fixture : join(REPO_ROOT, task.fixture);
    if (!existsSync(src) || !statSync(src).isDirectory()) {
      die(`fixture がディレクトリとして見つかりません: ${src}`);
    }
    // 読むだけ。cpSync の向きは常に fixture → 一時ディレクトリである
    cpSync(src, work, { recursive: true });
    cpSync(src, base, { recursive: true });
  }

  const meta: WorkMeta = {
    taskId: task.id,
    fixture: task.fixture,
    entry: task.entry,
    preparedAt: new Date().toISOString(),
    root,
    work,
    base,
  };
  writeFileSync(join(root, "meta.json"), JSON.stringify(meta, null, 1) + "\n", "utf8");

  // 標準出力はパス一行だけ。WORK=$(npx tsx eval/run.ts prepare T01) が成り立つようにする
  console.log(work);
  console.error(`課題 ${task.id} [${task.class.op}/${task.class.kind}] 入口 ${task.entry}`);
  console.error(`指示: ${task.instruction}`);
  return 0;
}

// ---- score ----

const SCORE_USAGE = [
  "使い方: npx tsx eval/run.ts score <task-id> <workdir> [オプション]",
  "  人が渡す値 (harness からは見えないもの):",
  "    --tool-calls <n>   エージェントの道具呼び出し回数",
  "    --tokens <n>       消費トークン (分かる範囲で)",
  "    --turns <n>        ターン数",
  "    --fail-class <c>   syntax|compose|semantic|incomplete|offtrack — 自動判定を上書きする",
  "    --agent <s>        被験系の名 (例 claude-code+mcp)",
  "    --notes <s>        走行の所見",
  "    --meta <file>      上記を収めた小さなJSON。個別フラグが優先される",
  "    --json             機械可読な記録を標準出力へ",
  "    --dry-run          記録を追記しない",
].join("\n");

function cmdScore(argv: string[]): number {
  const { positional, flags } = parseFlags(argv);
  const id = positional[0];
  const workdirArg = positional[1];
  if (!id || !workdirArg) {
    console.log(SCORE_USAGE);
    return 2;
  }
  const taskPath = resolveTaskPath(id);
  let task: Task;
  try {
    task = loadTask(taskPath);
  } catch (e) {
    die(String((e as Error)?.message ?? e));
  }

  const workdir = realish(workdirArg);
  if (!existsSync(workdir) || !statSync(workdir).isDirectory()) {
    die(`作業ディレクトリがありません: ${workdir}`);
  }
  assertOutsideRepo(workdir);

  const result: ScoreResult = scoreTask(task, workdir, { taskDir: dirname(taskPath) });

  // 人が渡す値: --meta のJSONを下敷きに、個別フラグで上書きする
  let sidecar: Record<string, unknown> = {};
  const metaFile = str(flags["meta"]);
  if (metaFile) {
    if (!existsSync(resolve(metaFile))) die(`--meta のファイルがありません: ${metaFile}`);
    try {
      sidecar = JSON.parse(readFileSync(resolve(metaFile), "utf8")) as Record<string, unknown>;
    } catch (e) {
      die(`--meta のJSONが読めません: ${String((e as Error)?.message ?? e)}`);
    }
  }
  const fromSidecar = (k: string): number | null => {
    const v = sidecar[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const strFromSidecar = (k: string): string | null => {
    const v = sidecar[k];
    return typeof v === "string" && v !== "" ? v : null;
  };

  const overrideClass = str(flags["fail-class"]) ?? strFromSidecar("failureClass");
  if (overrideClass && !FAILURE_CLASSES.includes(overrideClass as FailureClass)) {
    die(`--fail-class は ${FAILURE_CLASSES.join("|")} のいずれかです: ${overrideClass}`);
  }

  const diffLines = diffAgainstBase(workdir, task, result);

  const record: RunRecord = {
    ts: new Date().toISOString(),
    taskId: task.id,
    class: task.class,
    ...(result.languageVersion ? { languageVersion: result.languageVersion } : {}),
    workdir,
    success: result.success,
    // 自動判定は syntax / compose / semantic までしか届かない。
    // incomplete (途中で止まった) と offtrack (別のことをした) は人しか言えないので
    // --fail-class で上書きする。成功した走行に失敗種別は付けない。
    failureClass: result.success ? null : ((overrideClass as FailureClass) ?? result.failureClass ?? null),
    oracles: result.oracles.map((o) => ({ kind: o.kind, label: o.label, pass: o.pass, detail: o.detail })),
    passed: result.passed,
    total: result.total,
    checkGreen: result.checkGreen ?? null,
    checkGreenMeaningWrong: result.checkGreenMeaningWrong,
    diffLines,
    toolCalls: num(flags["tool-calls"]) ?? fromSidecar("toolCalls"),
    tokens: num(flags["tokens"]) ?? fromSidecar("tokens"),
    turns: num(flags["turns"]) ?? fromSidecar("turns"),
    agent: str(flags["agent"]) ?? strFromSidecar("agent"),
    notes: str(flags["notes"]) ?? strFromSidecar("notes"),
  };

  if (flags["json"]) {
    console.log(JSON.stringify(record, null, 1));
  } else {
    for (const l of renderScore(result)) console.log(l);
    console.log(`出発状態からの diff 行数 ${diffLines ?? "—"}`);
  }

  if (!flags["dry-run"]) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    appendFileSync(RECORDS, JSON.stringify(record) + "\n", "utf8");
    if (!flags["json"]) console.log(`記録 → ${RECORDS}`);
  }
  return result.success ? 0 : 1;
}

/**
 * 出発状態に対する koyu diff の行数。CLI の diff と同じ renderDiff の行数を数える。
 * .base が無い (prepare を通っていない) 作業ディレクトリでは null。
 */
function diffAgainstBase(workdir: string, task: Task, result: ScoreResult): number | null {
  const meta = metaFor(workdir);
  if (!meta || !existsSync(meta.base)) return null;
  if (task.fixture === "") {
    // 空から作らせた課題では出発状態が無い。全てが追加なので行数は情報にならない
    return null;
  }
  if (!result.parsed) return null;
  const baseBuilt = build(meta.base, task.entry);
  const afterBuilt = build(workdir, task.entry);
  if (!baseBuilt.model || !afterBuilt.model) return null;
  return renderDiff(semanticDiff(baseBuilt.model, afterBuilt.model)).length;
}

// ---- report ----

function readRecords(): RunRecord[] {
  if (!existsSync(RECORDS)) return [];
  return readFileSync(RECORDS, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as RunRecord);
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

function stats(xs: Array<number | null>): { known: number; mean: string; median: string } {
  const ys = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (ys.length === 0) return { known: 0, mean: "—", median: "—" };
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const mid = ys.length % 2 ? ys[(ys.length - 1) / 2]! : (ys[ys.length / 2 - 1]! + ys[ys.length / 2]!) / 2;
  return { known: ys.length, mean: mean.toFixed(1), median: String(mid) };
}

function cmdReport(argv: string[]): number {
  const { positional, flags } = parseFlags(argv);
  const label = positional[0];
  if (!label) die("使い方: npx tsx eval/run.ts report <label> [--latest]");
  if (!/^[A-Za-z0-9._-]+$/.test(label)) die(`label に使えるのは英数字と . _ - だけです: ${label}`);

  let records = readRecords();
  if (records.length === 0) die(`記録がありません: ${RECORDS} — 先に score を回してください`);
  if (flags["latest"]) {
    // 課題ごとに最後の走行だけを残す (再走行を重ねた後に基準を一枚に畳むため)
    const byId = new Map<string, RunRecord>();
    for (const r of records) byId.set(r.taskId, r);
    records = [...byId.values()];
  }

  const n = records.length;
  const full = records.filter((r) => r.success).length;
  const oracleTotal = records.reduce((a, r) => a + r.total, 0);
  const oraclePassed = records.reduce((a, r) => a + r.passed, 0);
  const cgmw = records.filter((r) => r.checkGreenMeaningWrong).length;
  const checkGreenRuns = records.filter((r) => r.checkGreen === true).length;
  // 合成できなかった走行は版を持たない — 「—」で表を汚さないよう除く
  const versionSet = [
    ...new Set(records.map((r) => r.languageVersion).filter((v): v is string => Boolean(v))),
  ];
  const versions = versionSet.length ? versionSet.join(" / ") : "—";

  const byClass = new Map<string, RunRecord[]>();
  for (const r of records) {
    const k = `${r.class.op}/${r.class.kind}`;
    byClass.set(k, [...(byClass.get(k) ?? []), r]);
  }
  const byFail = new Map<string, number>();
  for (const r of records) {
    if (r.failureClass) byFail.set(r.failureClass, (byFail.get(r.failureClass) ?? 0) + 1);
  }

  const tools = stats(records.map((r) => r.toolCalls));
  const toks = stats(records.map((r) => r.tokens));
  const turns = stats(records.map((r) => r.turns));
  const dls = stats(records.map((r) => r.diffLines));

  const md: string[] = [];
  md.push(`# koyu eval — ${label}`);
  md.push("");
  md.push(
    `生成 ${new Date().toISOString()} / 言語版 ${versions} / 記録 ${n}件` +
      (flags["latest"] ? " (課題ごとに最新の走行のみ)" : ""),
  );
  md.push("");
  md.push("## 見出しの数字");
  md.push("");
  md.push("| 指標 | 値 |");
  md.push("|---|---|");
  md.push(`| 完全正解 (全オラクル通過) | ${full}/${n} = ${pct(full, n)} |`);
  md.push(`| オラクル単位の通過 (部分点) | ${oraclePassed}/${oracleTotal} = ${pct(oraclePassed, oracleTotal)} |`);
  md.push(`| **checkは緑だが意味が誤り** | **${cgmw}/${n} = ${pct(cgmw, n)}** |`);
  md.push(`| check が緑だった走行 | ${checkGreenRuns}/${n} = ${pct(checkGreenRuns, n)} |`);
  md.push(
    `| うち意味が誤り (条件付き) | ${cgmw}/${checkGreenRuns} = ${pct(cgmw, checkGreenRuns)} |`,
  );
  md.push("");
  md.push(
    "「checkは緑だが意味が誤り」が本harnessの見出しである。整合検査を通ったのに意図が実現していない編集の割合であり、" +
      "これが高いほど記法は「機械には正しく見えるが人の意図から外れた」編集を許していることになる。" +
      "条件付きの率 (check が緑だった走行のうち何割が意味を外したか) は、check という単一オラクルを報酬に据えた場合の" +
      "報酬ハック率の見積りでもある。",
  );
  md.push("");
  md.push("## BIM-Edit 比較 (arXiv 2606.20146)");
  md.push("");
  md.push("| 系 | 部分点 | 完全正解 |");
  md.push("|---|---|---|");
  md.push("| Gemini 3.0 Flash (BIM-Edit 報告値) | 49.48% | <3.4% |");
  md.push(`| koyu ${versions} (本記録) | ${pct(oraclePassed, oracleTotal)} | ${pct(full, n)} |`);
  md.push("");
  md.push("課題数も操作の粒度も異なるため直接の優劣は読めない。形を揃えて並べることだけが目的である。");
  md.push("");
  md.push("## 分類別 (op × kind)");
  md.push("");
  md.push("| op | kind | 件数 | 完全正解 | 率 | check緑×誤り |");
  md.push("|---|---|---|---|---|---|");
  for (const [k, rs] of [...byClass].sort()) {
    const [op, kind] = k.split("/");
    const f = rs.filter((r) => r.success).length;
    const c = rs.filter((r) => r.checkGreenMeaningWrong).length;
    md.push(`| ${op} | ${kind} | ${rs.length} | ${f} | ${pct(f, rs.length)} | ${c} |`);
  }
  md.push("");
  md.push("## 失敗種別");
  md.push("");
  md.push("| 種別 | 件数 |");
  md.push("|---|---|");
  for (const c of FAILURE_CLASSES) md.push(`| ${c} | ${byFail.get(c) ?? 0} |`);
  md.push("");
  md.push("## 労力");
  md.push("");
  md.push("| 指標 | 中央値 | 平均 | 既知の走行数 |");
  md.push("|---|---|---|---|");
  md.push(`| tool呼び出し | ${tools.median} | ${tools.mean} | ${tools.known}/${n} |`);
  md.push(`| トークン | ${toks.median} | ${toks.mean} | ${toks.known}/${n} |`);
  md.push(`| ターン | ${turns.median} | ${turns.mean} | ${turns.known}/${n} |`);
  md.push(`| diff行数 | ${dls.median} | ${dls.mean} | ${dls.known}/${n} |`);
  md.push("");
  md.push("## 走行の一覧");
  md.push("");
  md.push("| 課題 | 分類 | 結果 | 失敗種別 | オラクル | check緑×誤り | diff行 | tool | turn | token |");
  md.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of records) {
    md.push(
      `| ${r.taskId} | ${r.class.op}/${r.class.kind} | ${r.success ? "✔" : "✖"} | ${r.failureClass ?? "—"} ` +
        `| ${r.passed}/${r.total} | ${r.checkGreenMeaningWrong ? "✖" : "—"} | ${r.diffLines ?? "—"} ` +
        `| ${r.toolCalls ?? "—"} | ${r.turns ?? "—"} | ${r.tokens ?? "—"} |`,
    );
  }
  md.push("");
  md.push("## 落ちた走行の内訳");
  md.push("");
  for (const r of records) {
    if (r.success) continue;
    md.push(`### ${r.taskId} (${r.failureClass ?? "—"})`);
    if (r.oracles.length === 0) {
      md.push("- ✖ 合成できずオラクル未実行");
    } else {
      for (const o of r.oracles.filter((x) => !x.pass)) md.push(`- ✖ ${o.label} — ${o.detail}`);
    }
    if (r.notes) md.push(`- 所見: ${r.notes}`);
    md.push("");
  }

  const summary = {
    label,
    generatedAt: new Date().toISOString(),
    languageVersions: versions,
    runs: n,
    fullCorrect: full,
    fullCorrectRate: n === 0 ? null : full / n,
    oraclePassed,
    oracleTotal,
    oracleRate: oracleTotal === 0 ? null : oraclePassed / oracleTotal,
    checkGreenMeaningWrong: cgmw,
    checkGreenMeaningWrongRate: n === 0 ? null : cgmw / n,
    checkGreenRuns,
    checkGreenMeaningWrongConditionalRate: checkGreenRuns === 0 ? null : cgmw / checkGreenRuns,
    byClass: Object.fromEntries(
      [...byClass].map(([k, rs]) => [
        k,
        {
          runs: rs.length,
          fullCorrect: rs.filter((r) => r.success).length,
          checkGreenMeaningWrong: rs.filter((r) => r.checkGreenMeaningWrong).length,
        },
      ]),
    ),
    byFailureClass: Object.fromEntries(FAILURE_CLASSES.map((c) => [c, byFail.get(c) ?? 0])),
    effort: { toolCalls: tools, tokens: toks, turns, diffLines: dls },
    records,
  };

  mkdirSync(RESULTS_DIR, { recursive: true });
  const mdPath = join(RESULTS_DIR, `${label}.md`);
  const jsonPath = join(RESULTS_DIR, `${label}.json`);
  writeFileSync(mdPath, md.join("\n") + "\n", "utf8");
  writeFileSync(jsonPath, JSON.stringify(summary, null, 1) + "\n", "utf8");
  console.log(mdPath);
  console.log(jsonPath);
  return 0;
}

// ---- 入口 ----

const USAGE = [
  "koyu eval — 走行係",
  "",
  "  npx tsx eval/run.ts prepare <task-id>            fixture を一時ディレクトリへ複製しパスを出す",
  "  npx tsx eval/run.ts score   <task-id> <workdir>  採点して eval/results/records.jsonl へ追記",
  "  npx tsx eval/run.ts report  <label> [--latest]   eval/results/<label>.{md,json} を書き出す",
  "",
  "score のオプションは `npx tsx eval/run.ts score` で表示する。",
].join("\n");

function main(argv: string[]): number {
  const cmd = argv[0];
  switch (cmd) {
    case "prepare":
      return cmdPrepare(argv.slice(1));
    case "score":
      return cmdScore(argv.slice(1));
    case "report":
      return cmdReport(argv.slice(1));
    default:
      console.log(USAGE);
      return cmd === undefined ? 2 : 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
