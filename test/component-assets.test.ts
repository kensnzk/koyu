import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";
import { componentSvgFiles, parseFile } from "../src/parse-file.js";

const SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><circle cx="300" cy="300" r="250" fill="none" stroke="#111"/></svg>`;

function source(version = "1.5", area = "align-x:max align-y:min offset-x:-50 offset-y:50"): string {
  return `muro ${version}
grid X 0 4000
grid Y 0 3000
level L1 0 h:2700 slab:150
asset WM component w:600 d:600 plan-svg:./wm.svg category:appliance
space /L1/laundry utility X1..X2 Y1..Y2 level:L1
  area X1+200..X1+1200 Y1+300..Y1+1300 name:washer-pan asset:WM ${area}`;
}

function model(area?: string) {
  return parseFiles({ "main.muro": source("1.5", area), "wm.svg": SAFE_SVG }, "main.muro");
}

test("a named area places a component from X/Y constraints and offsets", () => {
  const m = model();
  assert.deepEqual(checkDiagnostics(m).filter((d) => d.code.startsWith("CMP") || d.code.startsWith("ATT")), []);
  const component = derive(m).components![0]!;
  assert.equal(component.space, "/L1/laundry");
  assert.equal(component.area, "washer-pan");
  assert.equal(component.asset, "WM");
  assert.deepEqual(component.centre, { x: 850, y: 650 });
  assert.deepEqual(component.footprint, [
    { x: 550, y: 350 },
    { x: 1150, y: 350 },
    { x: 1150, y: 950 },
    { x: 550, y: 950 },
  ]);
});

test("rotation uses +X counter-clockwise and alignment uses the rotated footprint", () => {
  const src = source("1.5", "align-x:min align-y:max rotate:90").replace("w:600 d:600", "w:400 d:800");
  const svg = SAFE_SVG.replace('viewBox="0 0 600 600"', 'viewBox="0 0 400 800"');
  const m = parseFiles({ "main.muro": src, "wm.svg": svg }, "main.muro");
  const component = derive(m).components![0]!;
  assert.equal(component.centre.x, 600);
  assert.equal(component.centre.y, 1100);
  assert.equal(component.rotation, 90);
  assert.ok(Math.abs(component.footprint[0]!.x - 1000) < 1e-9);
  assert.ok(Math.abs(component.footprint[0]!.y - 900) < 1e-9);
});

test("component placement has one host spelling and requires a named area and component asset", () => {
  const unnamed = parse(source("1.5", "").replace("name:washer-pan ", ""));
  assert.deepEqual(checkDiagnostics(unnamed).filter((d) => d.code === "CMP01").map((d) => d.message), [
    "An area that places asset WM requires name: (the name identifies the placed component)",
  ]);

  const wrongKind = parse(source().replace(
    "asset WM component w:600 d:600 plan-svg:./wm.svg category:appliance",
    "asset WM door w:600",
  ));
  assert.match(checkDiagnostics(wrongKind).find((d) => d.code === "CMP01")!.message, /area can place only a component/);

  const invalidAlignment = parse(source("1.5", "align-x:left"));
  assert.deepEqual(
    checkDiagnostics(invalidAlignment)
      .filter((diagnostic) => diagnostic.code === "ATT02" || diagnostic.code === "CMP01")
      .map((diagnostic) => diagnostic.code),
    ["ATT02"],
  );

  const orphanAlignment = parse(source("1.5", "align-x:min").replace("asset:WM ", ""));
  assert.match(
    checkDiagnostics(orphanAlignment).find((diagnostic) => diagnostic.code === "CMP01")?.message ?? "",
    /align-x: on an area requires asset:/,
  );
});

test("a transformed footprint must remain inside its host area", () => {
  const m = model("align-x:max align-y:min offset-x:500");
  const issue = checkDiagnostics(m).find((d) => d.code === "CMP02");
  assert.match(issue?.message ?? "", /extends outside its host area washer-pan/);

  const outsideSpace = parseFiles(
    {
      "main.muro": source().replace("X1+200..X1+1200", "X2+100..X2+1100"),
      "wm.svg": SAFE_SVG,
    },
    "main.muro",
  );
  const parentIssue = checkDiagnostics(outsideSpace).find(
    (diagnostic) => diagnostic.code === "CMP02" && diagnostic.message.includes("parent space"),
  );
  assert.match(parentIssue?.message ?? "", /outside its parent space \/L1\/laundry/);
});

test("component assets and area placement are gated to muro 1.5", () => {
  const m = parse(source("1.4"));
  assert.deepEqual(checkDiagnostics(m).filter((d) => d.code === "VER09").map((d) => d.line), [5, 7]);
});

test("plan embeds loaded component SVG as isolated vector artwork", () => {
  const svg = svgPlan(model(), { level: "L1", componentSvgs: { WM: SAFE_SVG } });
  assert.match(svg, /class="component-asset"/);
  assert.match(svg, /data-asset="WM"/);
  assert.match(svg, /data:image\/svg\+xml/);
  assert.doesNotMatch(svg, /washer-pan<\/text>/);
});

test("active SVG content is refused instead of approximated", () => {
  const unsafe = SAFE_SVG.replace("</svg>", "<script>alert(1)</script></svg>");
  const m = parseFiles({ "main.muro": source(), "wm.svg": unsafe }, "main.muro");
  assert.throws(
    () => svgPlan(m, { level: "L1", componentSvgs: { WM: unsafe } }),
    /active or external content/,
  );
});

test("source filenames do not enter component Form geometry", () => {
  const a = parseFiles({ "a/main.muro": source(), "a/wm.svg": SAFE_SVG }, "a/main.muro");
  const b = parseFiles({ "b/main.muro": source(), "b/wm.svg": SAFE_SVG }, "b/main.muro");
  assert.equal(toCanonical(a), toCanonical(b));
  assert.deepEqual(derive(a), derive(b));
});

test("canonical JSON keeps component constraints but never SVG bytes", () => {
  const canonical = JSON.parse(toCanonical(model()));
  assert.deepEqual(canonical.assets.WM, {
    kind: "component",
    attrs: { category: "appliance", d: 600, "plan-svg": "./wm.svg", w: 600 },
  });
  assert.deepEqual(canonical.spaces["/L1/laundry"].areas[0].attrs, {
    "align-x": "max",
    "align-y": "min",
    asset: "WM",
    name: "washer-pan",
    "offset-x": -50,
    "offset-y": 50,
  });
  assert.doesNotMatch(toCanonical(model()), /<svg|data:image/);
});

test("filesystem artwork follows the layer that overrides plan-svg", () => {
  const m = parseFile("test/fixtures/component-layers/main.muro");
  const sources = componentSvgFiles(m, "L1");
  assert.match(sources.C!, /id="override"/);
  assert.doesNotMatch(sources.C!, /id="base"/);
});

test("the standard catalog places and validates every library SVG", () => {
  const m = parseFile("assets/plan/catalog.muro");
  assert.deepEqual(checkDiagnostics(m).filter((diagnostic) => diagnostic.severity === "error"), []);
  const assetNames = [...m.assets.values()]
    .filter((asset) => asset.kind === "component")
    .map((asset) => asset.name)
    .sort();
  const placed = derive(m).components ?? [];
  assert.deepEqual(placed.map((component) => component.asset).sort(), assetNames);
  const sources = componentSvgFiles(m, "L1");
  assert.deepEqual(Object.keys(sources).sort(), assetNames);
  const svg = svgPlan(m, { level: "L1", componentSvgs: sources });
  assert.equal([...svg.matchAll(/class="component-asset"/g)].length, assetNames.length);
});

test("component SVG keeps isolated defs and refuses aspect-ratio distortion", () => {
  const withDefs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><clipPath id="c"><circle cx="300" cy="300" r="200"/></clipPath></defs><rect width="600" height="600" clip-path="url(#c)"/></svg>`;
  assert.match(svgPlan(model(), { level: "L1", componentSvgs: { WM: withDefs } }), /clipPath/);
  const distorted = SAFE_SVG.replace('viewBox="0 0 600 600"', 'viewBox="0 0 800 600"');
  assert.throws(
    () => svgPlan(model(), { level: "L1", componentSvgs: { WM: distorted } }),
    /viewBox ratio .* does not match w:d ratio/,
  );

  const exponentViewBox = SAFE_SVG.replace('viewBox="0 0 600 600"', 'viewBox="0 0 6e2 6e2"');
  assert.match(svgPlan(model(), { level: "L1", componentSvgs: { WM: exponentViewBox } }), /component-asset/);
});

test("component SVG refuses CSS and URL paths that could load another resource", () => {
  const external = SAFE_SVG.replace("</svg>", `<image href="other.svg"/></svg>`);
  assert.throws(
    () => svgPlan(model(), { level: "L1", componentSvgs: { WM: external } }),
    /external reference: other.svg/,
  );
  const imported = SAFE_SVG.replace("</svg>", `<style>@import "https://example.com/a.css";</style></svg>`);
  assert.throws(
    () => svgPlan(model(), { level: "L1", componentSvgs: { WM: imported } }),
    /active or external content/,
  );
});
