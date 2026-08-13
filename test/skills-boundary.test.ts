// The skills teach the notation and the processor, and nothing about architecture.
//
// AGENTS.md law 14 draws that line for the whole repository. Only one part of it
// can be reached by a machine: `skills/` is a small, closed set of files, so the
// roster can be pinned and the guidance that was taken out of them can be held
// out. Everywhere else the law is held by a person reading.
//
// The blocked phrases below were all in these files until koyu 0.21 — they are
// not hypothetical. Each one told an agent what building to make rather than how
// to write one down, and every one of them is true, useful and unenforceable:
// nothing in src/ can be consulted to find out whether a corridor should reach
// every room, so a sentence saying so drifts without ever going red.
//
// A phrase is matched against whitespace-normalised text because markdown wraps:
// "Decide circulation first" lived across a line break, and a raw substring
// search for it found nothing.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKILLS = join(root, "skills");

/** The published roster. A skill added or renamed shows up here first. */
const ROSTER = ["koyu-author", "koyu-revise", "koyu-validate"];

/**
 * Guidance that decides the building rather than describing the notation.
 * Written as it stood when it was removed, so a paste-back is caught verbatim.
 */
const BLOCKED = [
  "Decide circulation first",
  "hang the rooms off it",
  "circulation hub",
  "not off a bedroom",
  "the architect decided those faces later",
  "where the design conversation actually is",
];

function skillDirs(): string[] {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Collapse every run of whitespace, so a wrapped sentence reads as one line. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ");
}

function markdownUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownUnder(path));
    else if (entry.name.endsWith(".md")) out.push(path);
  }
  return out;
}

test("the skill roster is the published one", () => {
  assert.deepEqual(skillDirs(), ROSTER);
});

test("every skill's frontmatter name is its own directory name", () => {
  for (const name of ROSTER) {
    const text = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
    const declared = /^---\n(?:.*\n)*?name:\s*(\S+)\s*$/m.exec(text)?.[1];
    assert.equal(
      declared,
      name,
      `skills/${name}/SKILL.md declares name: ${declared ?? "(none)"} — a client keys the skill by that name, not by the directory`,
    );
  }
});

test("the skills decide no buildings", () => {
  for (const file of markdownUnder(SKILLS)) {
    const text = flatten(readFileSync(file, "utf8"));
    for (const phrase of BLOCKED) {
      assert.ok(
        !text.includes(phrase),
        `${file.slice(root.length)} says "${phrase}". That decides the building rather than describing the notation, which AGENTS.md law 14 keeps out of this repository.`,
      );
    }
  }
});
