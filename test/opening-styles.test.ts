import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive } from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { MURO_1_5_OPENING_ATTRS, MURO_1_5_OPENING_STYLES, OPENING_STYLE_VALUES, attrSpec } from "../src/core/vocabulary.js";
import { planMarks } from "../src/draw/marks.js";
import { svgPlan } from "../src/draw/plan.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const shell = (version: string, opening: string): string => `${version}
grid X 0 4000
grid Y 0 4000
level L1 0 h:2600 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:N
  ${opening}
boundary /L1/a /out edge:S
boundary /L1/a /out edge:E
boundary /L1/a /out edge:W
`;

test("opening styles: the ledger accepts exactly the public operation vocabulary", () => {
  assert.deepEqual(attrSpec("opening", "style")?.of, [...OPENING_STYLE_VALUES]);
  assert.deepEqual(OPENING_STYLE_VALUES.slice(0, 3), ["hinged", "sliding", "auto"]);
  assert.ok(MURO_1_5_OPENING_STYLES.includes("entrance"));
  assert.ok(MURO_1_5_OPENING_STYLES.includes("gate-hinged"));
  assert.ok(MURO_1_5_OPENING_STYLES.includes("rolling-shutter"));
  assert.ok(MURO_1_5_OPENING_STYLES.includes("overhead"));
  assert.ok(MURO_1_5_OPENING_STYLES.includes("fixed"));
  assert.ok(MURO_1_5_OPENING_STYLES.includes("curtain-wall"));
  assert.deepEqual(MURO_1_5_OPENING_ATTRS, ["panels"]);
});

test("opening styles: muro 1.4 refuses every operation introduced in 1.5", () => {
  for (const style of MURO_1_5_OPENING_STYLES) {
    const kind = style === "fixed" || style === "projecting" || style === "curtain-wall" ? "window" : "door";
    const d = checkDiagnostics(
      parse(shell("muro 1.4", `${kind} w:1600 h:1200 hinge:W swing:a style:${style}`)),
    ).filter((x) => x.code === "VER08");
    assert.equal(d.length, 1, style);
    assert.equal(d[0]!.severity, "error");
    assert.match(d[0]!.message, /raise the version to muro 1\.5/);
  }
});

test("opening styles: legacy styles retain their meaning before 1.5", () => {
  for (const style of ["hinged", "sliding", "auto"]) {
    const d = checkDiagnostics(
      parse(shell("muro 1.4", `door w:1600 hinge:W swing:a style:${style}`)),
    ).filter((x) => x.code === "VER08");
    assert.deepEqual(d, [], style);
  }
});

test("opening styles: 1.5 window operation geometry does not alter older Forms", () => {
  for (const style of ["hinged", "sliding", "auto"]) {
    const model = parse(shell("muro 1.4", `window w:1600 h:1200 hinge:W swing:a style:${style}`));
    const diagnostics = checkDiagnostics(model);
    assert.equal(diagnostics.some((item) => item.code === "OPN09" || item.code === "VER08"), false, style);
    assert.equal(derive(model).openings[0]!.swing, undefined, style);
  }
});

test("opening styles: door-only and window-only operations cannot cross kinds", () => {
  const shared = ["hinged", "hinged-double", "sliding", "sliding-double", "sliding-bypass"];
  const doorOnly = [
    "hinged-unequal",
    "auto",
    "auto-single",
    "auto-double",
    "entrance",
    "gate-hinged",
    "gate-hinged-double",
    "gate-sliding",
    "rolling-shutter",
    "overhead",
  ];
  const windowOnly = ["fixed", "projecting", "curtain-wall"];
  const opn09 = (kind: "door" | "window", style: string) =>
    checkDiagnostics(parse(shell("muro 1.5", `${kind} w:1600 h:1200 hinge:W swing:a style:${style}`)))
      .filter((x) => x.code === "OPN09");

  for (const style of shared) {
    assert.equal(opn09("door", style).length, 0, `door ${style}`);
    assert.equal(opn09("window", style).length, 0, `window ${style}`);
  }
  for (const style of doorOnly) {
    const d = opn09("window", style);
    assert.equal(d.length, 1, `window ${style}`);
    assert.match(d[0]!.message, /door-only operation/);
  }
  for (const style of windowOnly) {
    const d = opn09("door", style);
    assert.equal(d.length, 1, `door ${style}`);
    assert.match(d[0]!.message, /window-only operation/);
  }
});

test("opening styles: an incompatible asset is diagnosed once at the asset declaration", () => {
  const model = parse(`muro 1.5
asset Bad door w:900 style:fixed
grid X 0 4000
grid Y 0 4000
level L1 0 h:2600 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:N
  door Bad
boundary /L1/a /out edge:S
boundary /L1/a /out edge:E
boundary /L1/a /out edge:W
`);
  const d = checkDiagnostics(model).filter((x) => x.code === "OPN09");
  assert.equal(d.length, 1);
  assert.equal(d[0]!.line, 2);
  assert.match(d[0]!.message, /door asset Bad/);
});

test("opening styles: an unknown spelling remains ATT02 only", () => {
  const d = checkDiagnostics(
    parse(shell("muro 1.5", "door w:1600 h:1200 hinge:W swing:a style:hingedd")),
  );
  assert.equal(d.filter((x) => x.code === "ATT02").length, 1);
  assert.equal(d.filter((x) => x.code === "OPN09").length, 0);
});

test("opening styles: curtain-wall panel layout is explicit and limited to curtain-wall windows", () => {
  const valid = parse(shell("muro 1.5", "window w:3200 h:2600 style:curtain-wall panels:4 name:cw"));
  assert.equal(checkDiagnostics(valid).filter((x) => x.code === "OPN10").length, 0);
  const form = derive(valid);
  assert.equal(form.openings[0]!.panels, 4);
  const mullions = planMarks(form, "L1").filter((mark) => mark.role === "curtain-wall-mullion");
  assert.equal(mullions.length, 3);
  assert.ok(mullions.every((mark) => mark.lines?.length === 1 && mark.polygon === undefined));

  const wrongStyle = checkDiagnostics(
    parse(shell("muro 1.5", "window w:3200 h:2600 style:fixed panels:4")),
  ).filter((x) => x.code === "OPN10");
  assert.equal(wrongStyle.length, 1);
  assert.match(wrongStyle[0]!.message, /only be written on a window with style:curtain-wall/);

  const fractional = checkDiagnostics(
    parse(shell("muro 1.5", "window w:3200 h:2600 style:curtain-wall panels:2.5")),
  ).filter((x) => x.code === "OPN10");
  assert.equal(fractional.length, 1);
  assert.match(fractional[0]!.message, /positive whole number/);

  const svg = svgPlan(valid, { level: "L1" });
  const group = svg.match(/<g class="opening-curtain-wall-mullion">([\s\S]*?)<\/g>/g) ?? [];
  assert.equal(group.length, 3);
  assert.ok(group.every((item) => item.includes("<line ") && !item.includes("<path ")));
});

test("opening styles: panels is version-gated independently of the style", () => {
  const d = checkDiagnostics(
    parse(shell("muro 1.4", "window w:3200 h:2600 panels:4")),
  ).filter((x) => x.code === "VER08");
  assert.equal(d.length, 1);
  assert.match(d[0]!.message, /opening attribute: panels/);
});

test("opening styles: an inherited invalid panel layout is diagnosed once at its asset", () => {
  const model = parse(`muro 1.5
asset CW window w:3200 h:2600 style:fixed panels:4
grid X 0 4000
grid Y 0 4000
level L1 0 h:2600 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:N
  window CW
`);
  const d = checkDiagnostics(model).filter((x) => x.code === "OPN10");
  assert.equal(d.length, 1);
  assert.equal(d[0]!.line, 2);
  assert.match(d[0]!.message, /asset CW/);
});

test("opening styles: an incompatible operation is not approximated by the renderer", () => {
  const doorModel = parse(shell("muro 1.5", "door w:1600 h:1200 hinge:W swing:a style:fixed"));
  const doorOpening = derive(doorModel).openings[0]!;
  const doorRoles = planMarks(derive(doorModel), "L1").filter((mark) => mark.ref === doorOpening.ref);
  assert.equal(doorRoles.some((mark) => mark.role === "door-leaf" || mark.role === "door-arc"), false);

  const windowModel = parse(shell("muro 1.5", "window w:1600 h:1200 hinge:W swing:a style:rolling-shutter"));
  const windowOpening = derive(windowModel).openings[0]!;
  const windowRoles = planMarks(derive(windowModel), "L1").filter((mark) => mark.ref === windowOpening.ref);
  assert.deepEqual(windowRoles.map((mark) => mark.role), ["window"]);
});

test("opening styles: an inherited new style is diagnosed once at its asset declaration", () => {
  const model = parse(`muro 1.4
asset DD door w:1600 style:sliding-double
grid X 0 4000
grid Y 0 4000
level L1 0 h:2600 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:N
  door DD hinge:W swing:a
`);
  const d = checkDiagnostics(model).filter((x) => x.code === "VER08");
  assert.equal(d.length, 1);
  assert.match(d[0]!.message, /on asset DD/);
});

test("opening styles: every assetless door operation produces its explicit mark family", () => {
  const model = parseFile(join(root, "test/fixtures/door-types.muro"));
  assert.equal(model.assets.size, 0);
  const form = derive(model);
  const marks = planMarks(form, "L1");
  const opening = (name: string) => form.openings.find((o) => o.name === name)!;
  const roles = (name: string) => marks.filter((m) => m.ref === opening(name).ref);
  const count = (name: string, role: string) => roles(name).filter((m) => m.role === role).length;

  assert.equal(count("hinged", "door-arc"), 1);
  assert.equal(count("double", "door-arc"), 2);
  assert.equal(count("unequal", "door-arc"), 2);
  assert.equal(count("single-slide", "slide-tail"), 1);
  assert.equal(roles("single-slide").find((m) => m.role === "slide-tail")!.lines!.length, 1);
  assert.equal(roles("single-slide").find((m) => m.role === "slide-centre")!.lines!.length, 1);
  assert.equal(roles("double-slide").find((m) => m.role === "slide-tail")!.lines!.length, 2);
  assert.equal(roles("double-slide").find((m) => m.role === "slide-centre")!.lines!.length, 2);
  assert.equal(count("bypass", "slide-tail"), 0);
  assert.equal(count("auto-single", "auto-direction"), 1);
  assert.equal(count("auto-double", "auto-direction"), 1);
  assert.equal(count("entrance", "entrance"), 1);
  assert.equal(count("swing-gate", "gate-post"), 1);
  assert.equal(count("double-gate", "door-arc"), 2);
  assert.equal(count("slide-gate", "gate-post"), 1);
  assert.equal(count("rolling-shutter", "rolling-shutter"), 1);
  assert.equal(count("overhead", "overhead-door"), 1);
  assert.equal(count("rolling-shutter", "slide-tail"), 0);
  assert.equal(count("overhead", "door-arc"), 0);
});

test("opening styles: every window keeps an unfilled wall frame and adds only its operation", () => {
  const model = parseFile(join(root, "test/fixtures/window-types.muro"));
  assert.equal(model.assets.size, 0);
  const form = derive(model);
  const marks = planMarks(form, "L1");
  const opening = (name: string) => form.openings.find((o) => o.name === name)!;
  const roles = (name: string) => marks.filter((m) => m.ref === opening(name).ref);
  const count = (name: string, role: string) => roles(name).filter((m) => m.role === role).length;

  for (const o of form.openings) assert.equal(count(o.name!, "window"), 1, o.name);
  assert.equal(count("general", "window-fixed"), 0);
  assert.equal(count("fixed", "window-fixed"), 1);
  assert.equal(count("single-slide", "slide-tail"), 1);
  assert.equal(roles("single-slide").find((m) => m.role === "window-sash-centre")!.lines!.length, 1);
  assert.equal(count("double-slide", "slide-tail"), 1);
  assert.equal(roles("double-slide").find((m) => m.role === "slide-tail")!.lines!.length, 2);
  assert.equal(roles("double-slide").find((m) => m.role === "window-sash-centre")!.lines!.length, 2);
  assert.equal(count("bypass", "slide-tail"), 0);
  assert.equal(count("casement", "window-arc"), 1);
  assert.equal(count("double-casement", "window-arc"), 2);
  assert.equal(count("projecting", "window-sash"), 1);
  assert.equal(count("curtain-wall", "curtain-wall-mullion"), 3);

  const svg = svgPlan(model, { level: "L1" });
  const frames = [...svg.matchAll(/<g class="opening-window">([\s\S]*?)<\/g>/g)].map((m) => m[1]!);
  assert.equal(frames.length, form.openings.length);
  assert.ok(frames.every((g) => /<path d="M [^"]+ M /.test(g)), "each frame is two open wall-face lines");
  assert.ok(frames.every((g) => !g.includes(" Z")), "a window frame has no filled or closed box");
});

test("opening styles: names never select a symbol", () => {
  const model = parse(shell("muro 1.5", "door w:1000 hinge:W swing:a style:hinged name:auto-double-gate"));
  const form = derive(model);
  const roles = planMarks(form, "L1")
    .filter((m) => m.of === "opening")
    .map((m) => m.role);
  assert.ok(roles.includes("door-arc"));
  assert.ok(!roles.includes("auto-direction"));
  assert.ok(!roles.includes("gate-post"));
});

test("opening styles: vertical door operations have plan marks but no horizontal storage guide", () => {
  for (const [style, role] of [
    ["rolling-shutter", "rolling-shutter"],
    ["overhead", "overhead-door"],
  ] as const) {
    const model = parse(shell("muro 1.5", `door w:1800 h:2400 hinge:W swing:a style:${style}`));
    const marks = planMarks(derive(model), "L1").filter((mark) => mark.of === "opening");
    assert.ok(marks.some((mark) => mark.role === role), style);
    assert.ok(!marks.some((mark) => mark.role === "slide-tail"), style);
    assert.ok(!marks.some((mark) => mark.role === "door-arc"), style);
  }
});
