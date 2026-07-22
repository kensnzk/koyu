// 生成した two-rooms.ifc を ThatOpen の web-ifc でパースし、
// エンティティ数とジオメトリが実際に組み上がることを確かめる。
//   実行: npx tsx examples/comparison/validate-ifc.ts examples/comparison/two-rooms.ifc

import { readFileSync } from "node:fs";
import * as WebIFC from "web-ifc";

const file = process.argv[2];
if (!file) {
  console.error("使い方: validate-ifc.ts <file.ifc>");
  process.exit(2);
}

const api = new WebIFC.IfcAPI();
await api.Init();
const modelID = api.OpenModel(new Uint8Array(readFileSync(file)));

const types: Array<[string, number]> = [
  ["IfcWall", WebIFC.IFCWALL],
  ["IfcSpace", WebIFC.IFCSPACE],
  ["IfcDoor", WebIFC.IFCDOOR],
  ["IfcOpeningElement", WebIFC.IFCOPENINGELEMENT],
  ["IfcRelSpaceBoundary", WebIFC.IFCRELSPACEBOUNDARY],
  ["IfcRelVoidsElement", WebIFC.IFCRELVOIDSELEMENT],
];
for (const [name, t] of types) {
  console.log(`${name}: ${api.GetLineIDsWithType(modelID, t).size()}`);
}

let meshes = 0;
api.StreamAllMeshes(modelID, () => meshes++);
console.log(`組み上がったメッシュ: ${meshes}`);
api.CloseModel(modelID);
