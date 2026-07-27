// guide/ の非乖離保証 — 学びの本 (guide) が規範の本 (spec) から黙って離れないための門番。
//
// リポジトリの規律は「ADR (なぜ) + テスト (保証) + spec (現在形)」であり、guide/ は
// 事実が乖離する四つめの置き場になってはならない。ここが守るのは六つ。
//   (1) ```muro      は本当に通る完全なファイルである (エラー0件)
//   (2) ```muro-bad  は本当に落ちる (SourceError か error診断1件以上)
//   (3) ```muro-warn は本当に警告だけを出す (エラー0件・警告1件以上)
//       ```muro-part は断片なので検証しない。印の綴り間違いで検証がすり抜けないよう、
//       使われている情報文字列の集合そのものを台帳と突き合わせる。
//   (4) guide/diagnostics.md のコード集合と severity が DIAGNOSTIC_CODES と一致し、
//       各節の例がそのコードちょうど1件を出す (頁が自分で宣言している約束)
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
import { checkDiagnostics, DIAGNOSTIC_CODES, type Diagnostic } from "../src/check.js";
import { SourceError } from "../src/model.js";
import { parse } from "../src/parse.js";

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
  let heading = "(見出しの前)";
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
const where = (b: Block) => `${b.file}:${b.line} 「${b.heading}」 (${b.index}番目のブロック, \`\`\`${b.tag})`;

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

test("guide: 走査が空でない (このテスト自体が無言で通らないための足場)", () => {
  assert.ok(FILES.length >= 10, `guide/ の.mdが少なすぎる: ${FILES.length}`);
  assert.ok(
    BLOCKS.filter((b) => b.tag === "muro").length >= 10,
    "```muro ブロックが見つからない — 走査器が壊れている",
  );
  assert.ok(
    BLOCKS.filter((b) => b.tag === "muro-bad").length >= 10,
    "```muro-bad ブロックが見つからない — 走査器が壊れている",
  );
});

// ---- (3) 印の台帳 ----

test("guide: コードフェンスの印は台帳のものだけ (綴り間違いで検証がすり抜けない)", () => {
  const used = new Map<string, Block>();
  for (const b of BLOCKS) if (!used.has(b.tag)) used.set(b.tag, b);
  for (const [tag, b] of used) {
    assert.ok(
      FENCE_TAGS.has(tag),
      tag === ""
        ? `${where(b)}: 情報文字列の無い裸のフェンス。何のブロックかを必ず書く (検証されない\`\`\`textでもよい)`
        : `${where(b)}: 未知のフェンス印 \`\`\`${tag}。台帳 FENCE_TAGS は {${[...FENCE_TAGS].join(", ")}}`,
    );
  }
});

// ---- (1) ```muro は通る ----

test("guide: ```muro はすべて解析でき、checkのエラーが0件", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro")) {
    const r = run(b.body);
    assert.equal(
      r.thrown,
      undefined,
      `${where(b)}: 解析に失敗した — ${r.thrown?.message}\n${b.body}`,
    );
    assert.deepEqual(
      r.errors.map(render),
      [],
      `${where(b)}: 完全なファイルのはずがエラーが出た (断片なら\`\`\`muro-partにする)\n${b.body}`,
    );
  }
});

// ---- (1b) ```json は JSON として読める ----

test("guide: ```json はすべて JSON.parse を通る (設定例を貼り間違えない)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "json")) {
    try {
      JSON.parse(b.body);
    } catch (e) {
      assert.fail(`${where(b)}: JSONとして読めない — ${(e as Error).message}\n${b.body}`);
    }
  }
});

// ---- (2) ```muro-bad は落ちる ----

test("guide: ```muro-bad はすべて落ちる (SourceError か errorの診断)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro-bad")) {
    const r = run(b.body);
    if (r.thrown) {
      assert.ok(
        r.thrown instanceof SourceError,
        `${where(b)}: SourceError以外の例外で落ちた — ${r.thrown.stack}`,
      );
      continue;
    }
    assert.ok(
      r.errors.length > 0,
      `${where(b)}: 誤りの例のはずが通ってしまう。` +
        (r.warnings.length > 0
          ? `出たのは警告だけ (${r.warnings.map(render).join(" / ")}) — \`\`\`muro-warn にする\n`
          : "診断が1件も出ない — 例を直すか印を改める\n") +
        b.body,
    );
  }
});

// ---- (3) ```muro-warn は警告だけを出す ----

test("guide: ```muro-warn はエラー0件・警告1件以上 (checkは通り--strictで落ちる)", () => {
  for (const b of BLOCKS.filter((x) => x.tag === "muro-warn")) {
    const r = run(b.body);
    assert.equal(r.thrown, undefined, `${where(b)}: 解析に失敗した — ${r.thrown?.message}\n${b.body}`);
    assert.deepEqual(
      r.errors.map(render),
      [],
      `${where(b)}: 警告の例のはずがエラーが出た — \`\`\`muro-bad にする\n${b.body}`,
    );
    assert.ok(
      r.warnings.length > 0,
      `${where(b)}: 警告の例のはずが警告が1件も出ない\n${b.body}`,
    );
  }
});

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

test("台帳: guide/diagnostics.md のコード集合とseverityが DIAGNOSTIC_CODES と一致", () => {
  const sections = guideDiagnosticSections();
  const table: Record<string, string> = {};
  for (const s of sections) {
    assert.equal(s.code in table, false, `guide/diagnostics.md:${s.line}: ${s.code} の節が二つある`);
    assert.notEqual(
      s.severity,
      "",
      `guide/diagnostics.md:${s.line}: ${s.code} の節に severity (\`error\` / \`warning\`) の行が無い`,
    );
    table[s.code] = s.severity;
  }
  assert.deepEqual(table, DIAGNOSTIC_CODES);
});

test("台帳: guide/diagnostics.md の各節の例は、その節のコードちょうど1件を出す", () => {
  for (const s of guideDiagnosticSections()) {
    const b = s.block;
    assert.ok(b, `guide/diagnostics.md:${s.line}: ${s.code} の節に誤り例のブロックが無い`);
    const r = run(b.body);
    if (r.thrown) {
      // SourceError は診断に写すと SYN01 ちょうど1件になる (ADR-0016 / CLIの check --json)
      assert.ok(r.thrown instanceof SourceError, `${where(b)}: SourceError以外の例外 — ${r.thrown.stack}`);
      assert.equal(
        s.code,
        "SYN01",
        `${where(b)}: 解析で落ちるので写されるコードは SYN01 だが、節は ${s.code} である`,
      );
      continue;
    }
    const diags = [...r.errors, ...r.warnings];
    assert.deepEqual(
      diags.map((d) => d.code),
      [s.code],
      `${where(b)}: ${s.code} の節の例が出す診断が一致しない — 実際は [${diags.map(render).join(" / ")}]\n${b.body}`,
    );
    assert.equal(diags[0]!.severity, DIAGNOSTIC_CODES[s.code as keyof typeof DIAGNOSTIC_CODES], `${where(b)}: ${s.code} のseverity`);
  }
});

// ---- (5) 相対リンク ----

test("guide: 相対リンクの先がすべて実在する", () => {
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
          `${file}:${i + 1}: リンク先が無い — ${t}`,
        );
      }
    }
  }
  assert.ok(checked > 100, `相対リンクが少なすぎる: ${checked} — 走査器が壊れている`);
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

test("guide: 見せているCLIの呼び出しは実在するサブコマンド", () => {
  const subs = cliSubcommands();
  assert.ok(subs.size >= 8, `src/cli.ts からサブコマンドを採れていない: ${[...subs].join(",")}`);
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
        `${c.file}:${c.line}: 存在しないサブコマンド \`${token}\` — 実在するのは {${[...subs].sort().join(", ")}}\n  ${c.text}`,
      );
    }
  }
  assert.ok(checked > 50, `CLIの呼び出しが少なすぎる: ${checked} — 走査器が壊れている`);
});
