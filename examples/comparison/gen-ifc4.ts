// 二室一扉を「最小の手書き相当」IFC4 (SPF) として生成する。
// 比較のための理想化であり実務品質ではない: プロパティセット・材料・スタイル・
// 接合処理・OwnerHistoryを持たず、形状は矩形押し出しのみ。実務のBIMツール出力は
// これの1〜2桁上の量になる (hello-wall.ifc は壁1枚+窓2つで79KB)。
//   実行: npx tsx examples/comparison/gen-ifc4.ts > examples/comparison/two-rooms.ifc

import { createHash } from "node:crypto";

const lines: string[] = [];
let n = 0;
function e(text: string): string {
  n++;
  lines.push(`#${n}=${text};`);
  return `#${n}`;
}
function fmt(v: number): string {
  return Number.isInteger(v) ? `${v}.` : `${v}`;
}

// IFC GUID (22文字, base64風)。名前から決定的に作る
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
function guid(name: string): string {
  const h = createHash("md5").update(`koyu:${name}`).digest();
  let out = ALPHABET[h[0]! % 4]!;
  for (let i = 1; i < 22; i++) out += ALPHABET[h[i % 16]! * (i + 7) % 64]!;
  return out;
}

// ---- 基盤 ----
const origin3 = e("IFCCARTESIANPOINT((0.,0.,0.))");
const dirZ = e("IFCDIRECTION((0.,0.,1.))");
const axis0 = e(`IFCAXIS2PLACEMENT3D(${origin3},$,$)`);
const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,${axis0},$)`);
const uLen = e("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)");
const uArea = e("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)");
const uVol = e("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)");
const uAng = e("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)");
const units = e(`IFCUNITASSIGNMENT((${uLen},${uArea},${uVol},${uAng}))`);
const project = e(`IFCPROJECT('${guid("project")}',$,'Two rooms one door',$,$,$,$,(${ctx}),${units})`);

const lpSite = e(`IFCLOCALPLACEMENT($,${axis0})`);
const lpBldg = e(`IFCLOCALPLACEMENT(${lpSite},${axis0})`);
const lpStorey = e(`IFCLOCALPLACEMENT(${lpBldg},${axis0})`);
const site = e(`IFCSITE('${guid("site")}',$,'Site',$,$,${lpSite},$,$,.ELEMENT.,$,$,$,$,$)`);
const bldg = e(`IFCBUILDING('${guid("building")}',$,'Building',$,$,${lpBldg},$,$,.ELEMENT.,$,$,$)`);
const storey = e(`IFCBUILDINGSTOREY('${guid("storey")}',$,'L1',$,$,${lpStorey},$,$,.ELEMENT.,0.)`);
e(`IFCRELAGGREGATES('${guid("rel-p-s")}',$,$,$,${project},(${site}))`);
e(`IFCRELAGGREGATES('${guid("rel-s-b")}',$,$,$,${site},(${bldg}))`);
e(`IFCRELAGGREGATES('${guid("rel-b-st")}',$,$,$,${bldg},(${storey}))`);

// ---- 矩形押し出しの箱 ----
function box(cx: number, cy: number, xdim: number, ydim: number, z1: number, depth: number): string {
  const p2 = e(`IFCCARTESIANPOINT((${fmt(cx)},${fmt(cy)}))`);
  const ax2 = e(`IFCAXIS2PLACEMENT2D(${p2},$)`);
  const prof = e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${ax2},${fmt(xdim)},${fmt(ydim)})`);
  const p3 = e(`IFCCARTESIANPOINT((0.,0.,${fmt(z1)}))`);
  const pos = e(`IFCAXIS2PLACEMENT3D(${p3},$,$)`);
  const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${pos},${dirZ},${fmt(depth)})`);
  const shape = e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`);
  return e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
}
function lp(): string {
  return e(`IFCLOCALPLACEMENT(${lpStorey},${axis0})`);
}

// ---- 壁 5枚 (壁芯は koyu の grid と同じ。外周150, 界壁120, 高さ2400) ----
const H = 2400;
function wall(name: string, cx: number, cy: number, xd: number, yd: number): string {
  return e(`IFCWALL('${guid(name)}',$,'${name}',$,$,${lp()},${box(cx, cy, xd, yd, 0, H)},$,$)`);
}
const wN = wall("W_N", 3600, 4500, 7350, 150);
const wS = wall("W_S", 3600, 0, 7350, 150);
const wW = wall("W_W", 0, 2250, 150, 4350);
const wE = wall("W_E", 7200, 2250, 150, 4350);
const wP = wall("W_P", 3600, 2250, 120, 4350);

// ---- 開口 2つと扉 2枚 ----
function opening(name: string, cx: number, cy: number, xd: number, yd: number, h: number): string {
  return e(
    `IFCOPENINGELEMENT('${guid(name)}',$,'${name}',$,$,${lp()},${box(cx, cy, xd, yd, 0, h)},$,.OPENING.)`,
  );
}
function door(name: string, cx: number, cy: number, xd: number, yd: number, h: number, w: number): string {
  return e(
    `IFCDOOR('${guid(name)}',$,'${name}',$,$,${lp()},${box(cx, cy, xd, yd, 0, h)},$,${fmt(h)},${fmt(w)},$,$,$)`,
  );
}
const o1 = opening("O_1", 3600, 2250, 130, 780, 2000); // 界壁の開口
const d1 = door("D_1", 3600, 2250, 60, 780, 2000, 780);
e(`IFCRELVOIDSELEMENT('${guid("void-1")}',$,$,$,${wP},${o1})`);
e(`IFCRELFILLSELEMENT('${guid("fill-1")}',$,$,$,${o1},${d1})`);
const o2 = opening("O_2", 5400, 0, 900, 160, 2100); // 玄関の開口
const d2 = door("D_2", 5400, 0, 900, 60, 2100, 900);
e(`IFCRELVOIDSELEMENT('${guid("void-2")}',$,$,$,${wS},${o2})`);
e(`IFCRELFILLSELEMENT('${guid("fill-2")}',$,$,$,${o2},${d2})`);

// ---- 空間 2つ (IFCでは部材と同格の一要素。書き出されない現場も多い) ----
function space(name: string, long: string, cx: number): string {
  return e(
    `IFCSPACE('${guid(name)}',$,'${name}',$,$,${lp()},${box(cx, 2250, 3600, 4500, 0, H)},'${long}',.ELEMENT.,.SPACE.,$)`,
  );
}
const spA = space("a", "Room A", 1800);
const spB = space("b", "Room B", 5400);
e(`IFCRELAGGREGATES('${guid("rel-st-sp")}',$,$,$,${storey},(${spA},${spB}))`);
e(
  `IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid("rel-cont")}',$,$,$,(${wN},${wS},${wW},${wE},${wP},${d1},${d2}),${storey})`,
);

// ---- 空間境界 8本 (接続ジオメトリは省略。実務ではここが最も欠落しやすい) ----
const sb: Array<[string, string, string, string]> = [
  ["sb-a-n", spA, wN, ".EXTERNAL."],
  ["sb-a-s", spA, wS, ".EXTERNAL."],
  ["sb-a-w", spA, wW, ".EXTERNAL."],
  ["sb-a-p", spA, wP, ".INTERNAL."],
  ["sb-b-n", spB, wN, ".EXTERNAL."],
  ["sb-b-s", spB, wS, ".EXTERNAL."],
  ["sb-b-e", spB, wE, ".EXTERNAL."],
  ["sb-b-p", spB, wP, ".INTERNAL."],
];
for (const [name, sp, el, flag] of sb) {
  e(`IFCRELSPACEBOUNDARY('${guid(name)}',$,$,$,${sp},${el},$,.PHYSICAL.,${flag})`);
}

// ---- 出力 ----
const header = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('two-rooms.ifc','2026-07-22T00:00:00',('ken'),('koyu'),'koyu gen-ifc4','koyu gen-ifc4','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;`;
process.stdout.write(header + "\n" + lines.join("\n") + "\nENDSEC;\nEND-ISO-10303-21;\n");
