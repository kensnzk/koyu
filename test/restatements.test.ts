// Every restatement of a machine-sourced ledger agrees with its source.
//
// docs/ and skills/ both restate facts that src/ owns — the accepted language
// versions, the diagnostic codes, the names of the validation rules. A
// restatement is a copy, and a copy drifts. The accepted-version list in
// skills/koyu-design/REFERENCE.md stayed at 1.0 across a whole language
// release while SUPPORTED_LANGUAGE_VERSIONS had moved to 1.1, the same list
// pasted into docs/howto/embed-in-a-program.md went stale the same way, and
// the only correct copy in existence was one a downstream product had fixed
// for itself.
//
// AGENTS.md law 3b already forbids hand-writing a ledger that has a machine
// source, and test/docs-ledger.test.ts enforces that for the *shape* of the
// published tree — which headings have to exist. This file enforces the other
// half: that the values written into prose still equal the values in src/.
//
// Scope is the published, present-tense trees. docs/decisions, docs/log,
// docs/reviews and docs/notes are records — written once and never edited, so
// they are supposed to hold what was true when they were written.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_CODES } from "../src/core/diagnose.js";
import {
  DEFAULT_LANGUAGE_VERSION,
  NEWEST_LANGUAGE_VERSION,
  SUPPORTED_LANGUAGE_VERSIONS,
} from "../src/core/model.js";
import { SCHEMATIC_RULES } from "../src/validate/builtin/index.js";
import { ATTR_LEDGER } from "../src/core/vocabulary.js";

/** Fences holding muro that is meant to be spelled correctly. */
const CHECKED_MURO_FENCES = new Set(["muro", "muro-part", "muro-warn", "muro-fail", "muro-caution"]);

const root = fileURLToPath(new URL("..", import.meta.url));

/** The trees that restate what src/ owns, and are rewritten in place. */
const GOVERNED = [
  join(root, "skills"),
  join(root, "docs", "reference"),
  join(root, "docs", "howto"),
  join(root, "docs", "start"),
  join(root, "docs", "why"),
  join(root, "docs", "examples"),
];

/**
 * The pages at the root restate the same ledgers and were read by nothing.
 * AGENTS.md names the current language version, the subcommands and the twelve
 * MCP tools in its own prose; the READMEs open on a worked example.
 */
const GOVERNED_FILES = [
  join(root, "AGENTS.md"),
  join(root, "README.md"),
  join(root, "README.ja.md"),
];

interface Line {
  readonly where: string;
  readonly text: string;
}

interface Block extends Line {
  /** The fence's info string — "muro", "muro-part", "text", "ts", or "". */
  readonly fence: string;
}

function markdown(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) markdown(path, out);
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

/**
 * Every line of the governed trees, tagged with where it came from.
 *
 * Line by line rather than whole-file: the separators these checks scan across
 * include whitespace, and over a whole file that would join unrelated numbers
 * on neighbouring lines into a run that was never written as one.
 */
function governedPaths(): string[] {
  return [...GOVERNED.flatMap((tree) => markdown(tree)), ...GOVERNED_FILES.filter((p) => existsSync(p))];
}

function governedLines(): Line[] {
  const lines: Line[] = [];
  for (const path of governedPaths()) {
    const where = relative(root, path);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((text, i) => lines.push({ where: `${where}:${i + 1}`, text }));
  }
  return lines;
}

const LINES = governedLines();

/**
 * Each fenced block of the governed trees, joined back into one string.
 *
 * The per-line scan above cannot see a list that the terminal wrapped.
 * `console.log(SUPPORTED_LANGUAGE_VERSIONS)` prints six entries on one line
 * and seven across four, so the moment the ledger grew, the pasted output
 * that had just gone stale became invisible to a line-at-a-time check.
 * Inside a fence, joining is safe: a run of version-shaped tokens separated
 * by nothing but punctuation is a list, not two unrelated numbers that
 * happen to be neighbours.
 */
function governedBlocks(): Block[] {
  const blocks: Block[] = [];
  {
    for (const path of governedPaths()) {
      const where = relative(root, path);
      const lines = readFileSync(path, "utf8").split("\n");
      let start = -1;
      let fence = "";
      lines.forEach((text, i) => {
        if (!text.startsWith("```")) return;
        if (start < 0) {
          start = i;
          fence = text.slice(3).trim();
        } else {
          blocks.push({
            where: `${where}:${start + 1}`,
            fence,
            text: lines.slice(start + 1, i).join("\n"),
          });
          start = -1;
        }
      });
    }
  }
  return blocks;
}

const BLOCKS = governedBlocks();

/**
 * Three or more version-shaped tokens with nothing but separators between
 * them. Single digit either side, because that is what a language version is —
 * `1097.80 m2` and `36.4%` are not versions, and requiring the shape keeps
 * them out without an exclusion list.
 *
 * The separators have to cover how the docs actually write a list. Narrower
 * ones missed real drift: `**0.1 / 0.2 / …**` in diagnostics/ver.md and
 * `` `0.1`, `0.2`, … and `1.0` `` in muro/composition.md both went unseen
 * until backticks, slashes, asterisks and the word "and" were allowed
 * between the tokens.
 */
const VERSION_RUN = /\b\d\.\d\b(?:(?:[\s,'"`*/[\]]|\band\b|\bor\b)+\b\d\.\d\b){2,}/g;

test("a list of accepted language versions equals SUPPORTED_LANGUAGE_VERSIONS", () => {
  const expected = SUPPORTED_LANGUAGE_VERSIONS.join(" ");
  const seen = new Set<string>();
  for (const source of [...LINES, ...BLOCKS]) {
    for (const run of source.text.match(VERSION_RUN) ?? []) {
      // The ledger has to appear whole and in order somewhere in the run,
      // rather than being the whole run. A pasted output can legitimately
      // put something in front of it — `console.log(DEFAULT, SUPPORTED)`
      // prints the default version and then the list, and joining a fence
      // back together makes those one run.
      const written = (run.match(/\d\.\d/g) ?? []).join(" ");
      if (!written.includes(expected)) seen.add(`${source.where}: ${written}`);
    }
  }
  const wrong = [...seen].sort();
  assert.deepEqual(
    wrong,
    [],
    `a version list disagrees with SUPPORTED_LANGUAGE_VERSIONS (${expected}):\n  ${wrong.join("\n  ")}`,
  );
});

const WORD_FOR_COUNT: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/**
 * A count of the accepted versions written next to the list. Law 3b forbids
 * hand-counting a ledger that has a machine source, and a count is the part
 * that rots most quietly: the list beside it was one entry short for a whole
 * release while the prose still said "six".
 *
 * Deliberately narrow — it reads "N versions are accepted" and nothing else.
 * The docs count other things in the same words all over: "Two versions — of
 * the format and of the language", "Three version lines", "There are two
 * version lines". Those are kinds of version line, not entries in this
 * ledger, and a check that flags them cries wolf until someone switches it
 * off. Where a count is phrased some other way, the list on the same line is
 * what catches the drift.
 */
test("a count of the accepted versions equals the length of the ledger", () => {
  const expected = SUPPORTED_LANGUAGE_VERSIONS.length;
  const wrong: string[] = [];
  for (const line of LINES) {
    for (const [, word] of line.text.matchAll(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+versions?\s+(?:are|is)\s+accepted\b/gi,
    )) {
      if (word === undefined) continue;
      const written = WORD_FOR_COUNT[word.toLowerCase()] ?? Number(word);
      if (written !== expected) wrong.push(`${line.where}: ${word} (there are ${expected})`);
    }
  }
  assert.deepEqual(wrong, [], `a version count disagrees with the ledger:\n  ${wrong.join("\n  ")}`);
});

/**
 * A sentence that names the version a file is read under when it declares
 * none. Narrowed to lines that also say "version" or "semantics", because the
 * positional default `at:0.5` is a different 0.5 entirely — docs-ledger's own
 * comment records that trap.
 */
test("the default language version claimed in prose is DEFAULT_LANGUAGE_VERSION", () => {
  const wrong: string[] = [];
  for (const line of LINES) {
    if (!/\b(?:version|semantics)\b/i.test(line.text)) continue;
    for (const [, written] of line.text.matchAll(
      /\b(?:latest|newest|default)\b[^.\n]{0,60}?\b(\d\.\d)\b/gi,
    )) {
      if (written !== DEFAULT_LANGUAGE_VERSION) {
        wrong.push(`${line.where}: ${written} (the default is ${DEFAULT_LANGUAGE_VERSION})`);
      }
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `a stated default language version disagrees with the ledger:\n  ${wrong.join("\n  ")}`,
  );
});

/**
 * Law 9 — examples are written in the newest language version. Scoped to the
 * notation reference and the skills, because demonstrating an old version is
 * the whole job of the VER pages under reference/diagnostics.
 */
test("a muro example declares the newest language version", () => {
  const stale: string[] = [];
  for (const block of BLOCKS) {
    if (!block.fence.startsWith("muro")) continue;
    if (!block.where.startsWith("skills/") && !block.where.startsWith("docs/reference/muro/")) {
      continue;
    }
    for (const [, written] of block.text.matchAll(/^koyu (\d\.\d)\b/gm)) {
      if (written !== NEWEST_LANGUAGE_VERSION) stale.push(`${block.where}: koyu ${written}`);
    }
  }
  assert.deepEqual(
    stale,
    [],
    `an example declares a superseded language version (the newest is ${NEWEST_LANGUAGE_VERSION}):\n  ${stale.join("\n  ")}`,
  );
});

/**
 * Every attribute key written in a muro block is in the ledger.
 *
 * This is the one check a fragment can be held to. `guide.test.ts` composes
 * and checks a ```muro block, but a ```muro-part cannot be parsed at all —
 * measured over the corpus, 133 of 191 throw, and the causes are what makes
 * them fragments: an undefined grid line, an undeclared level, an `import`,
 * an `over` whose base layer is elsewhere. Feeding them a synthetic preamble
 * makes it worse, because the fragment's own `grid` and `level` then collide
 * with it. So the fragments stay unparsed — but a misspelled attribute key is
 * lexical, needs no context, and `ATTR_LEDGER` is its machine source.
 *
 * ```muro-bad is excluded: showing a wrong spelling is its job — `nmae:`,
 * `undergound:`, `heigh:` all live there on purpose, demonstrating ATT03.
 */
test("every attribute key in a muro block is in ATTR_LEDGER", () => {
  const ledger = new Set<string>();
  for (const kind of Object.values(ATTR_LEDGER)) for (const key of Object.keys(kind)) ledger.add(key);
  const unknown: string[] = [];
  for (const block of BLOCKS) {
    if (!CHECKED_MURO_FENCES.has(block.fence)) continue;
    for (const raw of block.text.split("\n")) {
      // `#` starts a comment. A trailing one carries prose, and prose is
      // where the only false positive came from: "# default: out of scope".
      const code = raw.replace(/\s#.*$/, "");
      if (code.trimStart().startsWith("#")) continue;
      for (const token of code.split(/\s+/)) {
        const key = /^([a-zA-Z][a-zA-Z0-9_-]*):/.exec(token)?.[1];
        // A namespaced key is deliberately outside the ledger — that is the
        // boundary between "we have not looked at this" and "we looked".
        if (key === undefined || ledger.has(key) || key.includes(".")) continue;
        unknown.push(`${block.where} [${block.fence}]: ${key}:`);
      }
    }
  }
  assert.deepEqual(
    unknown,
    [],
    `attribute keys outside ATTR_LEDGER (namespace them, or they are ATT03):\n  ${unknown.join("\n  ")}`,
  );
});

/**
 * Skills name diagnostic codes in their error tables. A code that no longer
 * exists sends the reader looking for a page that is not there; a retired one
 * teaches a diagnostic that cannot fire. Both are caught by requiring the code
 * to be live. docs/ is excluded here because retired.md exists to name the
 * retired ones — docs-ledger.test.ts is what guards that tree.
 */
test("every diagnostic code named in a skill is a live code", () => {
  const live = new Set(Object.keys(DIAGNOSTIC_CODES));
  const unknown: string[] = [];
  for (const line of LINES) {
    if (!line.where.startsWith("skills/")) continue;
    for (const code of line.text.match(/\b[A-Z]{3}\d{2}\b/g) ?? []) {
      if (!live.has(code)) unknown.push(`${line.where}: ${code}`);
    }
  }
  assert.deepEqual(unknown, [], `diagnostic codes that do not exist:\n  ${unknown.join("\n  ")}`);
});

test("every validation rule id written down is a real rule", () => {
  const real = new Set(SCHEMATIC_RULES.map((rule) => rule.id));
  const unknown: string[] = [];
  for (const line of LINES) {
    for (const id of line.text.match(/\bkoyu\.schematic\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*/g) ??
      []) {
      if (!real.has(id)) unknown.push(`${line.where}: ${id}`);
    }
  }
  assert.deepEqual(unknown, [], `validation rule ids that do not exist:\n  ${unknown.join("\n  ")}`);
});

/**
 * Spellings the implementation dropped. A name that survives only in prose is
 * worse than no name: the reader cannot tell it is gone, and searching for it
 * in the source returns nothing.
 *
 * Same idea as the retired diagnostic codes in docs-ledger.test.ts — a removal
 * is not finished while the old spelling is still being taught.
 */
const RETIRED_SPELLINGS: readonly { readonly pattern: RegExp; readonly instead: string }[] = [
  {
    // The muro_ prefix is gone from src/ entirely. The site report is reached
    // as the `site` subcommand, the `site` MCP tool, or siteReport().
    pattern: /\bmuro_[a-z_]+/g,
    instead: "the `site` subcommand, the `site` MCP tool, or siteReport()",
  },
];

test("no retired spelling is still being taught", () => {
  const found: string[] = [];
  for (const line of LINES) {
    for (const { pattern, instead } of RETIRED_SPELLINGS) {
      for (const hit of line.text.match(pattern) ?? []) {
        found.push(`${line.where}: ${hit} — write ${instead}`);
      }
    }
  }
  assert.deepEqual(found, [], `retired spellings still written down:\n  ${found.join("\n  ")}`);
});
