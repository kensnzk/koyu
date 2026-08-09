// CLIの契約 (spec/tools.md / spec/scope.md §8)。
//
// **凍る面のうち、いちばん触られるのに、いちばんテストが薄かったのがここである。**
// 1.0.0 が約束するのは「コマンド、引数、終了コード」であって、行の飾りではない。
// だからここが縛るのも三つに絞る — サブコマンドが在ること、終了コードの流儀、
// 一行目が持つ形。SVGの中身も表の桁揃えも凍らないので、ここでは見ない。
//
// 終了コードの流儀は三段である (ADR-0028)。
//   0  問いに答えた
//   1  **構成の側の答えが否**だった (エラーがある / 到達できない / 差分がある)
//   2  **呼び方の側が間違っている** (引数が足りない / 未知のサブコマンド / 読めない値)
// 二つを混ぜないことが要点で、混ざると「壊れた建物」と「打ち間違い」が同じ顔になる。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "koyu-cli-"));

interface Run {
  code: number;
  out: string;
  err: string;
  /** 標準出力の一行目 (無ければ標準エラーの一行目 — 呼び方の問題はそちらへ出る) */
  first: string;
}

function koyu(...args: string[]): Run {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  const out = r.stdout ?? "";
  const err = r.stderr ?? "";
  const firstOf = (s: string) => s.split("\n").find((l) => l.trim() !== "") ?? "";
  return { code: r.status ?? -1, out, err, first: firstOf(out) || firstOf(err) };
}

/** 一時ファイルを置く (壊れた原本は examples/ に置けない — check:examples の門番が拾ってしまう) */
function fixture(name: string, source: string): string {
  const p = join(tmp, name);
  writeFileSync(p, source);
  return p;
}

const BROKEN_REF = fixture(
  "broken-ref.muro",
  `koyu 0.5
grid X 0 1000
grid Y 0 1000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /L1/nope
`,
);

const BROKEN_SYNTAX = fixture("broken-syntax.muro", "koyu 0.5\nspace ???\n");

/** validate names its grounds explicitly — neither the profile nor the date is ever inferred. */
const PROFILE_ARGS = ["--profile", "koyu.profile.schematic-screen", "--as-of", "2026-08-03"];

// ---- 正常系 — 終了コード0と、一行目の形 ----

const OK: Array<[string, string[], RegExp]> = [
  ["check", ["check", "examples/two-rooms.muro"], /^✔ Consistent — \d+ spaces? \/ \d+ boundar(y|ies)/],
  ["validate", ["validate", "examples/two-rooms.muro", ...PROFILE_ARGS], /^✔ Nothing caught by validation/],
  ["layers", ["layers", "examples/house/main.muro"], /^Layers \(weakest first/],
  ["diff", ["diff", "examples/two-rooms.muro", "examples/two-rooms.muro"], /^No differences$/],
  ["doors", ["doors", "examples/two-rooms.muro", "/L1/a", "/L1/b"], /^\d+ doors? — \/\S+( → \/\S+)+$/],
  ["graph", ["graph", "examples/two-rooms.muro"], /^\/\S+ \(.+\)$/],
  ["stats", ["stats", "examples/two-rooms.muro"], /^\S+$/],
  ["levels", ["levels", "examples/two-rooms.muro"], /^\S+\tz:-?\d+/],
  ["runs", ["runs", "examples/basement/main.muro"], /^\S+\t(stair|ramp|escalator|lift)\t/],
  ["light", ["light", "examples/house.muro"], /^ {2}\/\S+\t/],
  ["site", ["site", "examples/house.muro"], /^Site \/\S+/],
  ["json", ["json", "examples/two-rooms.muro"], /^\{$/],
];

for (const [name, args, shape] of OK) {
  test(`cli: ${name} answers with exit code 0, and its first line has the documented shape`, () => {
    const r = koyu(...args);
    assert.equal(r.code, 0, `${args.join(" ")}\n${r.out}${r.err}`);
    assert.match(r.first, shape);
  });
}

test("cli: plan writes an SVG and says where (exit code 0)", () => {
  const out = join(tmp, "plan.svg");
  const r = koyu("plan", "examples/two-rooms.muro", "-l", "L1", "-o", out);
  assert.equal(r.code, 0, r.err);
  assert.match(r.first, /^Generated the plan: /);
  assert.ok(existsSync(out));
});

test("cli: axo writes an SVG and says where (exit code 0)", () => {
  const out = join(tmp, "axo.svg");
  const r = koyu("axo", "examples/two-rooms.muro", "-o", out);
  assert.equal(r.code, 0, r.err);
  assert.match(r.first, /^Generated the axonometric: /);
  assert.ok(existsSync(out));
});

// ---- 呼び方の問題は 2 ----

const USAGE: Array<[string, string[], RegExp]> = [
  ["no argument at all", [], /^Usage: koyu </],
  ["--help (there is no dedicated help — the usage line is the help)", ["--help"], /^Usage: koyu </],
  ["an unknown subcommand", ["frobnicate", "examples/two-rooms.muro"], /^Unknown command: frobnicate$/],
  ["doors without the two paths", ["doors", "examples/two-rooms.muro", "/L1/a"], /^Usage: koyu doors/],
  ["diff without the second file", ["diff", "examples/two-rooms.muro"], /^Usage: koyu diff/],
  [
    "plan on an undeclared level",
    ["plan", "examples/two-rooms.muro", "-l", "L9"],
    /^Undeclared level: L9 \(declared: /,
  ],
  [
    "axo on an undeclared level",
    ["axo", "examples/two-rooms.muro", "-l", "L9"],
    /^Undeclared level: L9 \(declared: /,
  ],
  ["axo with a scale that is not a number", ["axo", "examples/two-rooms.muro", "-s", "abc"], /^-s takes a positive number: abc$/],
  ["axo with a scale of zero", ["axo", "examples/two-rooms.muro", "-s", "0"], /^-s takes a positive number: 0$/],
  ["axo in a direction that does not exist", ["axo", "examples/two-rooms.muro", "-d", "XYZ"], /^-d is one of NE \/ NW \/ SE \/ SW: XYZ$/],
];

for (const [name, args, shape] of USAGE) {
  test(`cli: ${name} is a question of how it was called — exit code 2`, () => {
    const r = koyu(...args);
    assert.equal(r.code, 2, `${args.join(" ")}\n${r.out}${r.err}`);
    assert.match(r.first, shape);
  });
}

test("cli: a broken scale never leaves an SVG behind (it used to write width=\"NaN\" and exit 0)", () => {
  const out = join(tmp, "nan.svg");
  const r = koyu("axo", "examples/two-rooms.muro", "-s", "abc", "-o", out);
  assert.equal(r.code, 2);
  assert.equal(existsSync(out), false, "a file was written even though the call was rejected");
});

test("cli: diff exits 2 when the input itself is broken (not 1 — that would read as a difference)", () => {
  const r = koyu("diff", "examples/two-rooms.muro", BROKEN_SYNTAX);
  assert.equal(r.code, 2);
  assert.match(r.first, /^✖ /);
});

// ---- 構成の側の答えが否なら 1 ----

test("cli: check exits 1 on an error, and exit 0 with only warnings unless --strict", () => {
  const bad = koyu("check", BROKEN_REF);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /References an undefined space/);

  const warn = fixture(
    "warn.muro",
    `koyu 0.5
grid X 0 1000
grid Y 0 1000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
`,
  );
  assert.equal(koyu("check", warn).code, 0);
  assert.equal(koyu("check", warn, "--strict").code, 1);
});

test("cli: the human output of check carries no diagnostic codes (--json is where the codes are)", () => {
  const human = koyu("check", BROKEN_REF);
  assert.equal(/\b[A-Z]{3}\d{2}\b/.test(human.out), false, human.out);
  const json = koyu("check", BROKEN_REF, "--json");
  assert.equal(json.code, 1);
  const diags = JSON.parse(json.out) as Array<{ code: string; severity: string }>;
  assert.ok(diags.some((d) => d.code === "REF01"));
});

test("cli: check --json stays valid JSON even when parsing failed (a single SYN01 — ADR-0016)", () => {
  const r = koyu("check", BROKEN_SYNTAX, "--json");
  assert.equal(r.code, 1);
  const diags = JSON.parse(r.out) as Array<{ code: string; severity: string }>;
  assert.deepEqual(
    diags.map((d) => d.code),
    ["SYN01"],
  );
});

test("cli: doors exits 1 when there is no route (1 is an answer, not a misuse)", () => {
  const r = koyu("doors", "examples/two-rooms.muro", "/L1/a", "/nowhere");
  assert.equal(r.code, 1);
  assert.match(r.first, /^Cannot reach /);
});

test("cli: diff exits 1 when the two differ, 0 when they do not", () => {
  assert.equal(koyu("diff", "examples/two-rooms.muro", "examples/two-rooms.muro").code, 0);
  const differ = koyu("diff", "examples/two-rooms.muro", "examples/office.muro");
  assert.equal(differ.code, 1);
  assert.ok(differ.out.split("\n").filter((l) => l.trim()).length > 0);
});

test("cli: validate exits 1 on a violation and says which rule caught it", () => {
  // 扉が一枚も無い室は外へ出られない (access.unreachable) — checkは緑のままである
  const sealed = fixture(
    "sealed.muro",
    `koyu 1.1
grid X 0 1000 2000
grid Y 0 1000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
`,
  );
  assert.equal(koyu("check", sealed).code, 0, "check is green — that is the point");
  const r = koyu("validate", sealed, ...PROFILE_ARGS);
  assert.equal(r.code, 1);
  assert.match(r.out, /\[koyu\.schematic\.access\.unreachable\]/);

  const json = koyu("validate", sealed, ...PROFILE_ARGS, "--json");
  assert.equal(json.code, 1);
  const report = JSON.parse(json.out) as {
    schema: string;
    profile: { id: string };
    findings: Array<{ rule: { id: string }; level: string }>;
  };
  assert.equal(report.schema, "koyu-assessment");
  assert.equal(report.profile.id, "koyu.profile.schematic-screen");
  assert.ok(report.findings.some(
    (f) => f.rule.id === "koyu.schematic.access.unreachable" && f.level === "violation",
  ));
});

test("cli: validate refuses to guess its grounds", () => {
  const file = "examples/two-rooms.muro";
  // **A missing ground is a usage error, not a verdict.** Exit 2 keeps it out of the 0/1 axis
  // so no script can read "could not run" as "nothing was violated".
  assert.equal(koyu("validate", file).code, 2, "no profile");
  assert.equal(koyu("validate", file, "--profile", "koyu.profile.schematic-screen").code, 2, "no date");
  assert.equal(koyu("validate", file, "--profile", "jp.bsl.made-up", "--as-of", "2026-08-03").code, 2, "unknown profile");
});

// ---- 面そのもの ----

test("cli: every subcommand the usage line advertises actually runs", () => {
  const usage = koyu();
  const m = /Usage: koyu <([a-z|]+)>/.exec(usage.out);
  assert.ok(m, usage.out);
  /** そのサブコマンドを正しく呼ぶのに要る、entry の後ろの引数 */
  const extra: Record<string, string[]> = {
    diff: ["examples/two-rooms.muro"],
    doors: ["/L1/a", "/L1/b"],
    plan: ["-o", join(tmp, "advertised-plan.svg")],
    axo: ["-o", join(tmp, "advertised-axo.svg")],
    validate: PROFILE_ARGS,
  };
  for (const sub of m[1]!.split("|")) {
    const r = koyu(sub, "examples/two-rooms.muro", ...(extra[sub] ?? []));
    assert.notEqual(r.code, 2, `${sub} is advertised but is not a subcommand: ${r.first}`);
    assert.equal(/^Unknown command:/.test(r.first), false, `${sub}: ${r.first}`);
  }
});
