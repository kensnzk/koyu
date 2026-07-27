// ロケール間の同期 (i18n)。
//
// 日本語が既定ロケールで、`spec/en/` と `guide/en/` はその訳である。訳を持つと
// 文書は二セットに分かれ、片方だけが直されて静かに乖離する — その乖離を機械で捕まえる。
//
// 捕まえるのは四つ:
//   1. 対応するページが存在すること (片方だけ足す/消すを禁じる)
//   2. **コードが同一であること** — 例のコードが片方だけ直されたら、読者は誤った例を手に入れる。
//      ただしコード中のコメントは訳してよい (英語の読者に日本語のコメントを読ませない)。
//      よって「コメントを剥いだあと」で比較する。
//   3. 貼られた出力 (```text) はバイト同一であること — 実際にツールが出すものであり、
//      訳せば嘘になる。機械向けの出力は英語なので、日本語の頁もそのまま貼り、解説だけを日本語で書く (docs/terminology.md)
//   4. 見出しの構造が一致すること (節を片方だけに足すのを禁じる)
//
// 対訳語の契約は docs/terminology.md。

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * 既定ロケール (日本語) の根と、その訳の根。
 *
 * `complete` は「この木の全ページに訳がある」ことを要求するかどうか。false のあいだも
 * **訳のあるページには全ての検査がかかる** — 途中の訳が壊れているのを見逃さないためであり、
 * 同時に一頁ずつ訳を足していけるようにするためでもある。訳し終えたら true に倒す。
 * 一度 true にしたものを false へ戻すのは、訳を捨てるということなので ADR の対象になる。
 */
const TREES = [
  { ja: join(root, "spec"), en: join(root, "spec", "en"), label: "spec", complete: true },
  { ja: join(root, "guide"), en: join(root, "guide", "en"), label: "guide", complete: true },
];

/** 対応を要求しないもの (訳す対象でない、あるいは本質的に二言語のもの) */
const EXEMPT = new Set<string>([]);

/**
 * 見出し構造の一致だけを免除するページ。
 * notation-v0.md は「書かれた当時のまま保存する」歴史文書であり、英語版は各版の追補を
 * (それぞれ ADR に置き換わっているため) 表へ畳んでいる。この編集判断は英語版の冒頭に明記してある。
 * 免除するのは見出し構造だけで、存在・コード・切替リンクの検査は通常どおりかかる。
 */
const HEADING_EXEMPT = new Set<string>(["spec/notation-v0.md"]);

function markdownFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) markdownFiles(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/** 既定ロケール側のページ (en/ 配下を除く) */
function jaPages(t: (typeof TREES)[number]): string[] {
  return markdownFiles(t.ja).filter((p) => !p.startsWith(t.en + "/") && p !== t.en);
}

// ---- コードブロックの採取 ----

const OPEN = /^ {0,3}```([^\s`]*)\s*$/;
const CLOSE = /^ {0,3}```\s*$/;

interface Block {
  tag: string;
  body: string;
  line: number;
}

function blocks(path: string): Block[] {
  const lines = readFileSync(path, "utf8").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPEN.exec(lines[i]!);
    if (open) {
      const start = i + 1;
      const body: string[] = [];
      i++;
      while (i < lines.length && !CLOSE.test(lines[i]!)) body.push(lines[i++]!);
      out.push({ tag: open[1]!, body: body.join("\n"), line: start });
    }
    i++;
  }
  return out;
}

function headings(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => /^#{1,6}\s+/.test(l))
    .map((l) => /^(#{1,6})\s/.exec(l)![1]!); // レベルだけを見る (見出し文は訳されるため)
}

/**
 * コメントを剥ぐ。コメントは訳してよいがコードは訳せない、という規約の実装。
 * `#` は .muro とシェル、`//` は ts/jsonc。空行と行末空白も落として比較する。
 */
function stripComments(tag: string, body: string): string {
  // 印の無い裸のフェンスは、このリポジトリでは .muro の抜粋である (spec/ の例がそれ)。
  // よって `#` コメントを剥ぐ側に入れる。
  const hash = tag === "" || tag.startsWith("muro") || tag === "sh";
  const slash = tag === "ts" || tag === "jsonc" || tag === "js";
  return body
    .split("\n")
    .map((l) => {
      let s = l;
      if (hash) s = s.replace(/(^|\s)#.*$/, "");
      if (slash) s = s.replace(/(^|\s)\/\/.*$/, "");
      return s.replace(/\s+$/, "");
    })
    .filter((l) => l.trim() !== "")
    .join("\n");
}

/** 出力の貼り付け (```text) は訳さない — ツールが実際に出す文字列だから */
const VERBATIM_TAGS = new Set(["text"]);

// ---- 検査 ----

test("i18n: a fully translated tree has an English page for every page", () => {
  const missing: string[] = [];
  for (const t of TREES.filter((t) => t.complete)) {
    for (const p of jaPages(t)) {
      const rel = relative(t.ja, p);
      if (EXEMPT.has(join(t.label, rel))) continue;
      const en = join(t.en, rel);
      if (!existsSync(en)) missing.push(`${relative(root, p)} → ${relative(root, en)} is missing`);
    }
  }
  assert.deepEqual(missing, [], `missing English pages:\n  ${missing.join("\n  ")}`);
});

test("i18n: every English page has a matching default-locale page (no orphans)", () => {
  const orphans: string[] = [];
  for (const t of TREES) {
    for (const p of markdownFiles(t.en)) {
      const rel = relative(t.en, p);
      const ja = join(t.ja, rel);
      if (!existsSync(ja)) orphans.push(`${relative(root, p)} has no matching ${relative(root, ja)}`);
    }
  }
  assert.deepEqual(orphans, [], `orphan English pages:\n  ${orphans.join("\n  ")}`);
});

test("i18n: a translated page carries the locale switch on its first line", () => {
  const bad: string[] = [];
  for (const t of TREES) {
    // 訳の無いページにはまだ切替リンクを張れないので、訳のあるものだけを見る
    for (const p of jaPages(t).filter((p) => existsSync(join(t.en, relative(t.ja, p))))) {
      const first = readFileSync(p, "utf8").split("\n")[0] ?? "";
      if (!/^\[English\]\(.*\) · \*\*日本語\*\*$/.test(first)) {
        bad.push(`${relative(root, p)}: line 1 is not "[English](…) · **日本語**"`);
      }
    }
    for (const p of markdownFiles(t.en)) {
      const first = readFileSync(p, "utf8").split("\n")[0] ?? "";
      if (!/^\*\*English\*\* · \[日本語\]\(.*\)$/.test(first)) {
        bad.push(`${relative(root, p)}: line 1 is not "**English** · [日本語](…)"`);
      }
    }
  }
  assert.deepEqual(bad, [], `missing locale switches:\n  ${bad.join("\n  ")}`);
});

test("i18n: code blocks agree in order and in body (comments may be translated)", () => {
  const bad: string[] = [];
  for (const t of TREES) {
    for (const p of jaPages(t)) {
      const rel = relative(t.ja, p);
      const en = join(t.en, rel);
      if (!existsSync(en)) continue; // 欠落は別のテストが言う
      const a = blocks(p);
      const b = blocks(en);
      if (a.length !== b.length) {
        bad.push(`${relative(root, p)}: the number of code blocks differs (ja ${a.length} / en ${b.length})`);
        continue;
      }
      for (let i = 0; i < a.length; i++) {
        const x = a[i]!;
        const y = b[i]!;
        if (x.tag !== y.tag) {
          bad.push(`${relative(root, p)}:${x.line}: block ${i + 1} carries a different tag (ja \`${x.tag}\` / en \`${y.tag}\`)`);
          continue;
        }
        const verbatim = VERBATIM_TAGS.has(x.tag);
        const xs = verbatim ? x.body : stripComments(x.tag, x.body);
        const ys = verbatim ? y.body : stripComments(y.tag, y.body);
        if (xs !== ys) {
          bad.push(
            `${relative(root, p)}:${x.line}: the body of block ${i + 1} (\`${x.tag}\`) disagrees` +
              (verbatim
                ? " — ```text is what the tool actually prints, so it must be byte-identical"
                : " (compared with comments stripped)") +
              `\n      ja: ${JSON.stringify(xs.slice(0, 120))}\n      en: ${JSON.stringify(ys.slice(0, 120))}`,
          );
        }
      }
    }
  }
  assert.deepEqual(bad, [], `code drift:\n  ${bad.join("\n  ")}`);
});

test("i18n: the heading structure agrees (no section added on one side only)", () => {
  const bad: string[] = [];
  for (const t of TREES) {
    for (const p of jaPages(t)) {
      const rel = relative(t.ja, p);
      const en = join(t.en, rel);
      if (!existsSync(en)) continue;
      if (HEADING_EXEMPT.has(relative(root, p))) continue;
      const a = headings(p);
      const b = headings(en);
      if (a.join(",") !== b.join(",")) {
        bad.push(
          `${relative(root, p)}: the heading structure differs (ja ${a.length} [${a.join(" ")}] / en ${b.length} [${b.join(" ")}])`,
        );
      }
    }
  }
  assert.deepEqual(bad, [], `heading structure drift:\n  ${bad.join("\n  ")}`);
});

test("i18n: a terminology table exists (the contract for translated terms)", () => {
  const p = join(root, "docs", "terminology.md");
  assert.ok(existsSync(p), "docs/terminology.md is missing");
  const s = readFileSync(p, "utf8");
  // 核の概念が表に載っていること — 抜けると訳語が揺れる
  for (const term of ["空間", "境界", "帯", "通り芯", "既定境界", "正準JSON", "半屋外", "矩計"]) {
    assert.ok(s.includes(`| ${term} |`), `the terminology table has no row for ${term}`);
  }
});
