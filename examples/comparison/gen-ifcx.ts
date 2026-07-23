// 二室一扉を IFCX (IFC5 alpha) として生成する。
// buildingSMART/IFC5-development の hello-wall.ifcx の流儀に倣う:
// UUIDパス + children による階層、usd::usdgeom::mesh によるメッシュ同梱、
// bsi::ifc::class による分類。開口のブーリアンは省略し (hello-wallではType側の
// Voidで表現される)、扉は壁の子の箱として置いた理想化である点に注意。
//   実行: npx tsx examples/comparison/gen-ifcx.ts > examples/comparison/two-rooms.ifcx

import { createHash } from "node:crypto";

function uuid(name: string): string {
  const h = createHash("md5").update(`koyu:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** 直方体メッシュ (単位: m)。8頂点・12三角形 */
function boxMesh(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
  const m = (v: number) => v / 1000;
  const p = [
    [m(x1), m(y1), m(z1)], [m(x2), m(y1), m(z1)], [m(x2), m(y2), m(z1)], [m(x1), m(y2), m(z1)],
    [m(x1), m(y1), m(z2)], [m(x2), m(y1), m(z2)], [m(x2), m(y2), m(z2)], [m(x1), m(y2), m(z2)],
  ];
  const f = [
    0, 2, 1, 0, 3, 2, // 底
    4, 5, 6, 4, 6, 7, // 天
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];
  return { faceVertexIndices: f, points: p };
}

type Node = {
  path: string;
  children?: Record<string, string>;
  inherits?: Record<string, string>;
  attributes?: Record<string, unknown>;
};
const data: Node[] = [];

function cls(code: string) {
  return {
    "bsi::ifc::class": {
      code,
      uri: `https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/${code}`,
    },
  };
}

/** 要素 = クラス属性 + Bodyメッシュ子 (+さらに子要素) */
function element(
  name: string,
  code: string,
  mesh: ReturnType<typeof boxMesh>,
  color: [number, number, number],
  extraChildren: Record<string, string> = {},
): string {
  const id = uuid(name);
  const bodyId = uuid(`${name}/Body`);
  data.push({
    path: id,
    children: { Body: bodyId, ...extraChildren },
    attributes: cls(code),
  });
  data.push({
    path: bodyId,
    attributes: {
      "usd::usdgeom::mesh": mesh,
      "bsi::ifc::presentation::diffuseColor": color,
      "bsi::ifc::presentation::opacity": code === "IfcSpace" ? 0.3 : 1,
    },
  });
  return id;
}

const GRAY: [number, number, number] = [0.55, 0.55, 0.55];
const WOOD: [number, number, number] = [0.72, 0.55, 0.35];
const AIR: [number, number, number] = [0.85, 0.9, 1.0];
const H = 2400;

// 扉 (壁の子)
const d1 = element("Door_1", "IfcDoor", boxMesh(3570, 1860, 0, 3630, 2640, 2000), WOOD);
const d2 = element("Door_2", "IfcDoor", boxMesh(4950, -30, 0, 5850, 30, 2100), WOOD);

// 壁 5枚 (壁芯はkoyuのgridと同じ。外周150・界壁120)
const wN = element("Wall_N", "IfcWall", boxMesh(-75, 4425, 0, 7275, 4575, H), GRAY);
const wS = element("Wall_S", "IfcWall", boxMesh(-75, -75, 0, 7275, 75, H), GRAY, { Door_2: d2 });
const wW = element("Wall_W", "IfcWall", boxMesh(-75, 75, 0, 75, 4425, H), GRAY);
const wE = element("Wall_E", "IfcWall", boxMesh(7125, 75, 0, 7275, 4425, H), GRAY);
const wP = element("Wall_P", "IfcWall", boxMesh(3540, 75, 0, 3660, 4425, H), GRAY, { Door_1: d1 });

// 空間 2つ
const spA = element("Space_a", "IfcSpace", boxMesh(0, 0, 0, 3600, 4500, H), AIR);
const spB = element("Space_b", "IfcSpace", boxMesh(3600, 0, 0, 7200, 4500, H), AIR);

// 階層 (hello-wallと同じく root → Project → Site → Building → Storey → 要素)
const storey = uuid("storey");
data.unshift(
  { path: uuid("root"), children: { Two_Rooms_Project: uuid("project") } },
  { path: uuid("project"), children: { Site: uuid("site") }, attributes: cls("IfcProject") },
  { path: uuid("site"), children: { Building: uuid("building") }, attributes: cls("IfcSite") },
  { path: uuid("building"), children: { L1: storey }, attributes: cls("IfcBuilding") },
  {
    path: storey,
    children: {
      Space_a: spA,
      Space_b: spB,
      Wall_N: wN,
      Wall_S: wS,
      Wall_W: wW,
      Wall_E: wE,
      Wall_P: wP,
    },
    attributes: cls("IfcBuildingStorey"),
  },
);

const file = {
  header: {
    id: "koyu/examples/comparison/two-rooms.ifcx",
    ifcxVersion: "ifcx_alpha",
    dataVersion: "1.0.0",
    author: "shinozaki.ken.141@gmail.com",
    timestamp: "2026-07-22",
  },
  imports: [
    { uri: "https://ifcx.dev/@standards.buildingsmart.org/ifc/core/ifc@v5a.ifcx" },
    { uri: "https://ifcx.dev/@standards.buildingsmart.org/ifc/core/prop@v5a.ifcx" },
    { uri: "https://ifcx.dev/@openusd.org/usd@v1.ifcx" },
  ],
  schemas: {},
  data,
};
process.stdout.write(JSON.stringify(file, null, 2) + "\n");
