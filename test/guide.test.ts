// guide/ の非乖離保証 — 学びの本 (guide) が規範の本 (spec) から黙って離れないための門番。
//
// リポジトリの規律は「ADR (なぜ) + テスト (保証) + spec (現在形)」であり、guide/ は
// 事実が乖離する四つめの置き場になってはならない。ここが守るのは六つ。
//   (1) ```muro      は本当に通る完全なファイルである (エラー0件)
//   (2) ```muro-bad  は本当に落ちる (SourceError か error診断1件以上)
//   (3) ```muro-warn は本当に警告だけを出す (エラー0件・警告1件以上)
//       ```muro-part は断片なので検証しない。印の綴り間違いで検証がすり抜けないよう、
//       使われている情報文字列の集合そのものを台帳と突き合わせる。
//   (3b) ```muro-fail / ```muro-caution は検証の面 (validate) の判定を出す。**core の診断ではない** —
//       core のエラーは0件で、指定の level の Finding が1件以上出ることを見る
//   (4) guide/diagnostics.md のコード集合と severity が DIAGNOSTIC_CODES と一致し、
//       guide/validation.md の規則集合と level が VALIDATION_RULES と一致し、
//       各節の例がその規則ちょうど1件を出す (頁が自分で宣言している約束)
//   (5) guide/ からの相対リンクの先が実在する
//   (6) guide/ が見せる CLI の呼び出しが実在するサブコマンドである (一覧は src/cli.ts から採る)
//
// 走査の対象は guide/**/*.md と、入口の README.md / README.ja.md である
// (READMEの冒頭スニペットが「抜粋なのに抜粋と書かれていない」ことが最初の躓きだった)。

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDiagnostics, DIAGNOSTIC_CODES, type Diagnostic } from "../src/core/diagnose.js";
import { SourceError } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { validate, VALIDATION_RULES, type Finding } from "../src/validate/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const GUIDE = join(root, "guide");

/**
 * guide/ で使ってよい情報文字列の台帳。
 * ここに無い綴りは落ちる — `muro` を `mruo` と書いて検証がすり抜けるのを防ぐのが目的なので、
 * 未知の言語を足すときは「検証しなくてよい」と決めたうえでここに足す。
 * 情報文字列なしの裸のフェンスも禁じる (印を落とすのが最も起きやすい検証の抜けかたである)。
 */
const FENCE_TAGS = new Set([
  "muro",
  "muro-part",
  "muro-bad",
  "muro-warn",
  "muro-fail",
  "muro-caution",
  "sh",
  "text",
  "ts",
  "json",
]);

// ---- markdown の走査 ----

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) markdownFiles(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

interface Block {
  /** リポジトリ相対のパス */
  file: string;
  /** 情報文字列 (```のあとの語)。裸のフェンスは "" */
  tag: string;
  /** そのブロックが属する直前の見出し */
  heading: string;
  /** ファイル内で1始まりの通し番号 */
  index: number;
  /** 開きフェンスの行 (1始まり) */
  line: number;
  body: string;
}

const OPEN = /^ {0,3}```([^\s`]*)\s*$/;
const CLOSE = /^ {0,3}```\s*$/;

/** ブロックと、フェンス外の散文行 (行番号つき) を一度に採る */
function scan(path: string): { file: string; blocks: Block[]; prose: Array<{ line: number; text: string }> } {
  const file = relative(root, path);
  const lines = readFileSync(path, "utf8").split("\n");
  const blocks: Block[] = [];
  const prose: Array<{ line: number; text: string }> = [];
  let heading = "(before the first heading)";
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) heading = h[1]!.trim();
    const open = OPEN.exec(line);
    if (open) {
      const start = i + 1;
      const body: string[] = [];
      i++;
      while (i < lines.length && !CLOSE.test(lines[i]!)) body.push(lines[i++]!);
      blocks.push({ file, tag: open[1]!, heading, index: ++index, line: start, body: body.join("\n") });
    } else {
      prose.push({ line: i + 1, text: line });
    }
    i++;
  }
  return { file, blocks, prose };
}

/**
 * 入口の二枚も同じ門番にかける。READMEの冒頭スニペットが「抜粋なのに抜粋と書かれていない」
 * ことは、新規参入者が最初に踏んだ失敗そのものだった — 印 (muro / muro-part) が正しいことを
 * guide/ と同じ規律で守る。
 */
const ROOT_PAGES = ["README.md", "README.ja.md"].map((f) => join(root, f)).filter((p) => existsSync(p));

const FILES = [...markdownFiles(GUIDE), ...ROOT_PAGES];
const SCANNED = FILES.map(scan);
const BLOCKS = SCANNED.flatMap((s) => s.blocks);

/** 失敗メッセージの見出し — どのファイルのどのブロックかを必ず名指す */
const where = (b: Block) => `${b.file}:${b.line} "${b.heading}" (block ${b.index}, \`\`\`${b.tag})`;

const render = (d: Diagnostic) => `${d.code}(${d.severity}) ${d.message}`;

interface Outcome {
  thrown?: Error;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

function run(source: string): Outcome {
  try {
    const diags = checkDiagnostics(parse(source));
    return {
      errors: diags.filter((d) => d.severity === "error"),
      warnings: diags.filter((d) => d.severity === "warning"),
    };
  } catch (e) {
    return { thrown: e as Error, errors: [], warnings: [] };
  }
}

test("guide: the scan is not empty (scaffolding so this test cannot pass in silence)", () => {
  assert.ok(FILES.length >= 10, `too few .md files under guide/: ${FILES.length}`);
  assert.ok(
    BLOCKS.filter((b) => b.tag === "muro").length >= 10,
    "no ```muro block was found — the scanner is broken",
  );
  assert.ok(
    BLOCKS.filter((b) => b.tag === "muro-bad").length >= 10,
    "no ```muro-bad block was found — the scanner is broken",
  );
});

// ---- (3) 印の台帳 ----

test("guide: fence tags come only from the ledger (a misspelling cannot slip past validation)", () => {
  const used = new Map<string, Block>();
  for (const b of BLOCKS) if (!used.has(b.tag)) used.set(b.tag, b);
  for (const [tag, b] of used) {
    assert.ok(
      FENCE_TAGS.has(tag),
      tag === ""
        ? `${where(b)}: a bare fence with no info string. Always say what the block is (an unvalidated \`\`\`text is fine)`
        : `${where(b)}: unknown fence tag \`\`\`${tag}. The FENCE_TAGS ledger is {${[...FENCE_TAGS].join(", ")}}`,
    );
  }
});

// ---- (1) ```muro は通る ----

test("guide: every ```muro parses and check reports zero errors", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro")) {
    const r = run(b.body);
    assert.equal(
      r.thrown,
      undefined,
      `${where(b)}: failed to parse — ${r.thrown?.message}\n${b.body}`,
    );
    assert.deepEqual(
      r.errors.map(render),
      [],
      `${where(b)}: this should be a complete file, yet errors came out (make it \`\`\`muro-part if it is a fragment)\n${b.body}`,
    );
  }
});

// ---- (1b) ```json は JSON として読める ----

test("guide: every ```json passes JSON.parse (no mis-pasted configuration example)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "json")) {
    try {
      JSON.parse(b.body);
    } catch (e) {
      assert.fail(`${where(b)}: not readable as JSON — ${(e as Error).message}\n${b.body}`);
    }
  }
});

// ---- (2) ```muro-bad は落ちる ----

test("guide: every ```muro-bad fails (a SourceError or an error diagnostic)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro-bad")) {
    const r = run(b.body);
    if (r.thrown) {
      assert.ok(
        r.thrown instanceof SourceError,
        `${where(b)}: it failed with an exception other than SourceError — ${r.thrown.stack}`,
      );
      continue;
    }
    assert.ok(
      r.errors.length > 0,
      `${where(b)}: this should be a bad example, yet it passes. ` +
        (r.warnings.length > 0
          ? `only warnings came out (${r.warnings.map(render).join(" / ")}) — make it \`\`\`muro-warn\n`
          : "not one diagnostic comes out — fix the example or change the tag\n") +
        b.body,
    );
  }
});

// ---- (3) ```muro-warn は警告だけを出す ----

test("guide: every ```muro-warn has zero errors and at least one warning (check passes, --strict fails)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro-warn")) {
    const r = run(b.body);
    assert.equal(r.thrown, undefined, `${where(b)}: failed to parse — ${r.thrown?.message}\n${b.body}`);
    assert.deepEqual(
      r.errors.map(render),
      [],
      `${where(b)}: this should be a warning example, yet errors came out — make it \`\`\`muro-bad\n${b.body}`,
    );
    assert.ok(
      r.warnings.length > 0,
      `${where(b)}: this should be a warning example, yet not one warning comes out\n${b.body}`,
    );
  }
});

// ---- (3b) ```muro-fail / ```muro-caution は検証の判定を出す ----

const renderF = (f: Finding) => `${f.rule}(${f.level}) ${f.message}`;

function runValidate(source: string): { thrown?: Error; errors: Diagnostic[]; findings: Finding[] } {
  try {
    const m = parse(source);
    return {
      errors: checkDiagnostics(m).filter((d) => d.severity === "error"),
      findings: validate(m),
    };
  } catch (e) {
    return { thrown: e as Error, errors: [], findings: [] };
  }
}

for (const [tag, level] of [
  ["muro-fail", "violation"],
  ["muro-caution", "caution"],
] as const) {
  test(`guide: \`\`\`${tag} produces a ${level} finding from validate (core check passes)`, () => {
    for (const b of BLOCKS.filter((x) => x.tag === tag)) {
      const r = runValidate(b.body);
      assert.equal(r.thrown, undefined, `${where(b)}: failed to parse — ${r.thrown?.message}\n${b.body}`);
      // **判定の例は、構成としては正しい。**core が落とす例をここに置かない
      assert.deepEqual(
        r.errors.map(render),
        [],
        `${where(b)}: this should be a validation example, yet a core error came out — make it \`\`\`muro-bad\n${b.body}`,
      );
      assert.ok(
        r.findings.some((f) => f.level === level),
        `${where(b)}: not one ${level} finding comes out (what came out: ${r.findings.map(renderF).join(" / ") || "nothing"})\n${b.body}`,
      );
    }
  });
}

// ---- (4) 診断コード事典と台帳の一致 ----

/** guide/diagnostics.md の `### CODE — 概要` と、その直後に印字される severity を採る */
function guideDiagnosticSections(): Array<{ code: string; severity: string; line: number; block?: Block }> {
  const path = join(GUIDE, "diagnostics.md");
  const { blocks } = scan(path);
  const lines = readFileSync(path, "utf8").split("\n");
  const out: Array<{ code: string; severity: string; line: number; block?: Block }> = [];
  for (let i = 0; i < lines.length; i++) {
    const h = /^###\s+([A-Z]{3}\d{2})\s+—\s+\S/.exec(lines[i]!);
    if (!h) continue;
    let severity = "";
    for (let j = i + 1; j < lines.length && !/^###\s/.test(lines[j]!); j++) {
      const s = /^`(error|warning)`$/.exec(lines[j]!.trim());
      if (s) {
        severity = s[1]!;
        break;
      }
    }
    out.push({ code: h[1]!, severity, line: i + 1 });
  }
  // 各節の最初の誤り例ブロックを節に結びつける
  for (const s of out) {
    const end = out.find((o) => o.line > s.line)?.line ?? Number.MAX_SAFE_INTEGER;
    s.block = blocks.find(
      (b) => b.line > s.line && b.line < end && (b.tag === "muro-bad" || b.tag === "muro-warn"),
    );
  }
  return out;
}

test("ledger: the code set and the severity in guide/diagnostics.md match DIAGNOSTIC_CODES", () => {
  const sections = guideDiagnosticSections();
  const table: Record<string, string> = {};
  for (const s of sections) {
    assert.equal(s.code in table, false, `guide/diagnostics.md:${s.line}: there are two sections for ${s.code}`);
    assert.notEqual(
      s.severity,
      "",
      `guide/diagnostics.md:${s.line}: the ${s.code} section has no severity line (\`error\` / \`warning\`)`,
    );
    table[s.code] = s.severity;
  }
  assert.deepEqual(table, DIAGNOSTIC_CODES);
});

test("ledger: each section of guide/diagnostics.md carries an example that produces exactly one diagnostic — its own code", () => {
  for (const s of guideDiagnosticSections()) {
    const b = s.block;
    assert.ok(b, `guide/diagnostics.md:${s.line}: the ${s.code} section has no bad-example block`);
    const r = run(b.body);
    if (r.thrown) {
      // SourceError は診断に写すと SYN01 ちょうど1件になる (ADR-0016 / CLIの check --json)
      assert.ok(r.thrown instanceof SourceError, `${where(b)}: an exception other than SourceError — ${r.thrown.stack}`);
      assert.equal(
        s.code,
        "SYN01",
        `${where(b)}: it fails at parse, so the code mapped is SYN01, but the section is ${s.code}`,
      );
      continue;
    }
    const diags = [...r.errors, ...r.warnings];
    assert.deepEqual(
      diags.map((d) => d.code),
      [s.code],
      `${where(b)}: the diagnostics from the ${s.code} section's example do not agree — actually [${diags.map(render).join(" / ")}]\n${b.body}`,
    );
    assert.equal(diags[0]!.severity, DIAGNOSTIC_CODES[s.code as keyof typeof DIAGNOSTIC_CODES], `${where(b)}: severity of ${s.code}`);
  }
});

/** guide/validation.md の `### \`rule\` — 概要` と、その節の最初の判定例ブロックを採る */
function guideValidationSections(): Array<{ rule: string; line: number; block?: Block }> {
  const path = join(GUIDE, "validation.md");
  const { blocks } = scan(path);
  const lines = readFileSync(path, "utf8").split("\n");
  const out: Array<{ rule: string; line: number; block?: Block }> = [];
  for (let i = 0; i < lines.length; i++) {
    const h = /^###\s+`([a-z.]+)`\s+—\s+\S/.exec(lines[i]!);
    if (h) out.push({ rule: h[1]!, line: i + 1 });
  }
  for (const s of out) {
    const end = out.find((o) => o.line > s.line)?.line ?? Number.MAX_SAFE_INTEGER;
    s.block = blocks.find(
      (b) => b.line > s.line && b.line < end && (b.tag === "muro-fail" || b.tag === "muro-caution"),
    );
  }
  return out;
}

test("ledger: each section of guide/validation.md carries an example that produces exactly one finding — its own rule", () => {
  const sections = guideValidationSections();
  assert.equal(
    sections.length,
    Object.keys(VALIDATION_RULES).length,
    "the number of sections does not match the ledger (set equality is what test/domains.test.ts states)",
  );
  for (const s of sections) {
    const b = s.block;
    assert.ok(b, `guide/validation.md:${s.line}: the ${s.rule} section has no validation-example block`);
    const r = runValidate(b.body);
    assert.equal(r.thrown, undefined, `${where(b)}: failed to parse — ${r.thrown?.message}\n${b.body}`);
    // 判定の例は構成としては正しい — core が落とす例をここに置かない
    assert.deepEqual(r.errors.map(render), [], `${where(b)}: a core error came out\n${b.body}`);
    // **その規則が出ることを見る。**level だけを見ると、別の規則の同じ level で通ってしまい、
    // 節が自分の規則を説明しなくなったことに気づけない。他の規則が併発するのは構わない
    // (窓の h を落とせば採光も足りなくなる、扉が無ければ外へも出られない — 例は建物なので併発する)
    assert.equal(
      r.findings.filter((f) => f.rule === s.rule).length,
      1,
      `${where(b)}: the ${s.rule} section's example does not produce exactly one ${s.rule} — actually [${r.findings.map(renderF).join(" / ")}]\n${b.body}`,
    );
  }
});

// ---- (5) 相対リンク ----

test("guide: every relative link points at something that exists", () => {
  // インライン [x](path) / 画像 ![x](path) / 参照定義 [x]: path
  const INLINE = /!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const REFDEF = /^\[[^\]\n]+\]:\s*(\S+)/;
  let checked = 0;
  for (const path of FILES) {
    const file = relative(root, path);
    const lines = readFileSync(path, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const targets: string[] = [];
      for (const m of lines[i]!.matchAll(INLINE)) targets.push(m[1]!);
      const r = REFDEF.exec(lines[i]!);
      if (r) targets.push(r[1]!);
      for (const t of targets) {
        if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(t) || /^(?:https?|mailto):/i.test(t)) continue;
        if (t.startsWith("#")) continue;
        const p = t.split("#")[0]!;
        if (!p) continue;
        checked++;
        assert.ok(
          existsSync(resolve(dirname(path), decodeURI(p))),
          `${file}:${i + 1}: the link target does not exist — ${t}`,
        );
      }
    }
  }
  assert.ok(checked > 100, `too few relative links: ${checked} — the scanner is broken`);
});

/**
 * 頁の中の錨 (anchor) を集める。三つの綴りがある —
 * 明示の `<a id="x"></a>`、Docusaurus の `{#x}`、そして見出しから作られる slug。
 * slug の作り方は github-slugger に倣う (小文字化 → 約物を落とす → 空白を `-` に)。
 */
function anchorsOf(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/<a\s+id="([^"]+)"\s*><\/a>/g)) out.add(m[1]!);
  for (const m of source.matchAll(/^#{1,6}\s+.*\{#([^}]+)\}\s*$/gm)) out.add(m[1]!);
  for (const m of source.matchAll(/^#{1,6}\s+(.*)$/gm)) {
    out.add(
      m[1]!
        .replace(/\{#[^}]+\}\s*$/, "")
        .trim()
        .toLowerCase()
        // github-slugger が落とす約物 (`-` と `_` は残す)
        .replace(/[ -⁯⸀-⹿\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, "")
        .replace(/\s/g, "-"),
    );
  }
  return out;
}

test("guide: every link fragment points at an anchor that exists", () => {
  // 相対リンクの `#...` は誰も見ていなかったので、実装から消えたコードを指す索引が
  // 生き延びていた (`#sit03` / `#sit05` — SIT03/SIT05 は存在しない)。
  // Docusaurus のビルドは警告を出すだけなので、**ここが唯一の門番である**
  const INLINE = /!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const cache = new Map<string, Set<string>>();
  const anchorsFor = (abs: string) => {
    let a = cache.get(abs);
    if (!a) {
      a = anchorsOf(readFileSync(abs, "utf8"));
      cache.set(abs, a);
    }
    return a;
  };
  let checked = 0;
  for (const path of FILES) {
    const file = relative(root, path);
    const lines = readFileSync(path, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i]!.matchAll(INLINE)) {
        const t = m[1]!;
        if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(t) || /^(?:https?|mailto):/i.test(t)) continue;
        const hash = t.indexOf("#");
        if (hash < 0) continue;
        const frag = decodeURI(t.slice(hash + 1));
        if (!frag) continue;
        const target = t.slice(0, hash);
        // 同じ頁の中の錨なら自分を、そうでなければリンク先の .md を見る
        const abs = target ? resolve(dirname(path), decodeURI(target)) : path;
        if (!abs.endsWith(".md") || !existsSync(abs)) continue;
        checked++;
        assert.ok(
          anchorsFor(abs).has(frag),
          `${file}:${i + 1}: the anchor does not exist — ${t}`,
        );
      }
    }
  }
  assert.ok(checked > 50, `too few fragments: ${checked} — the scanner is broken`);
});

// ---- (6) CLIサブコマンド ----

/** src/cli.ts から実在するサブコマンドを採る (ハードコードするとここが古びるため) */
function cliSubcommands(): Set<string> {
  const src = readFileSync(join(root, "src/cli.ts"), "utf8");
  const subs = new Set<string>();
  for (const m of src.matchAll(/^\s*case "([a-z][a-z0-9-]*)":/gm)) subs.add(m[1]!); // switch の分岐
  for (const m of src.matchAll(/cmd === "([a-z][a-z0-9-]*)"/g)) subs.add(m[1]!); // switch の前で捌く分岐 (diff)
  return subs;
}

test("guide: every CLI invocation it shows names a subcommand that exists", () => {
  const subs = cliSubcommands();
  assert.ok(subs.size >= 8, `no subcommand was collected from src/cli.ts: ${[...subs].join(",")}`);
  // 「$ 」つきも、リポジトリ内実行も、インストール後の呼び方も同じ形に均す
  const INVOKE = /^(?:\$\s*)?(?:npx\s+tsx\s+src\/cli\.ts|npm\s+run\s+koyu\s+--|npx\s+@kensnzk\/koyu|koyu)\s+(\S+)/;
  let checked = 0;
  for (const { file, blocks, prose } of SCANNED) {
    // ```sh の各行と、散文中のインラインコード
    const cands: Array<{ file: string; line: number; text: string }> = [];
    for (const b of blocks.filter((x) => x.tag === "sh")) {
      b.body.split("\n").forEach((l, k) => cands.push({ file, line: b.line + 1 + k, text: l.trim() }));
    }
    for (const p of prose) {
      for (const m of p.text.matchAll(/`([^`\n]+)`/g)) {
        cands.push({ file, line: p.line, text: m[1]!.trim() });
      }
    }
    for (const c of cands) {
      const m = INVOKE.exec(c.text);
      if (!m) continue;
      const token = m[1]!;
      // サブコマンドではないもの: 旗 (--help)、プレースホルダ (…, <…>)、版宣言の `koyu 0.2`
      if (!/^[a-z][a-z0-9-]*$/.test(token)) continue;
      checked++;
      assert.ok(
        subs.has(token),
        `${c.file}:${c.line}: no such subcommand \`${token}\` — the ones that exist are {${[...subs].sort().join(", ")}}\n  ${c.text}`,
      );
    }
  }
  assert.ok(checked > 50, `too few CLI invocations: ${checked} — the scanner is broken`);
});
