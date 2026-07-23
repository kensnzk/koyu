// IFCXS — 敷地の問い (MUN-149/150)
// 敷地面積・接道・建蔽率・容積率を、宣言ではなく構成から導出する。
// 敷地 = site:1 属性を持つゾーン。地上の外部空間 (庭・アプローチ) はL1上の実在の空間として
// 建物の周りをタイルし、道路・隣地は /out を割った複数のexterior空間 (道路は road:幅員)。

import { segmentLength, segmentsFor } from "./graph.js";
import {
  areaM2,
  isSemiOutdoor,
  unionAreaM2,
  type Model,
  type Space,
  type Zone,
} from "./model.js";

export interface RoadFrontage {
  road: Space;
  /** 幅員 mm (road:属性) */
  width: number;
  /** 接道長 mm (導出) */
  frontage: number;
}

export interface SiteReport {
  siteZone?: Zone;
  /** 宣言された敷地面積 m² (zoneのarea:属性 — 測量値) */
  declaredArea?: number;
  /** 導出された敷地面積 m² (敷地内空間+建物水平投影の合併) */
  derivedArea: number;
  /** 建築面積 m² (屋内空間の水平投影の合併 — 庇・バルコニーの算入は粗い) */
  footprint: number;
  /** 延べ面積 m² (屋内床面積の合計) */
  totalFloor: number;
  roads: RoadFrontage[];
}

export function siteReport(model: Model): SiteReport {
  const siteZone = [...model.zones.values()].find((z) => z.attrs["site"] === 1);
  const declared = siteZone?.attrs["area"];

  const spaces = [...model.spaces.values()];
  const indoor = spaces.filter(
    (s) =>
      s.rects.length > 0 && s.level && s.type !== "void" && s.type !== "exterior" &&
      !isSemiOutdoor(model, s),
  );
  const siteChildren = siteZone
    ? spaces.filter((s) => s.path.startsWith(siteZone.path + "/") && s.rects.length > 0)
    : [];

  const derivedArea = unionAreaM2([
    ...siteChildren.flatMap((s) => s.rects),
    ...indoor.flatMap((s) => s.rects),
  ]);
  const footprint = unionAreaM2(indoor.flatMap((s) => s.rects));
  const totalFloor =
    Math.round(indoor.reduce((sum, s) => sum + (areaM2(s) ?? 0), 0) * 100) / 100;

  // 接道: road:幅員 を持つexterior空間ごとに、敷地 (siteゾーン配下の空間) との境界線分の長さを合算。
  // 建物の外壁が道路に面していても、それは接道ではない
  const roads: RoadFrontage[] = [];
  for (const road of spaces) {
    if (road.type !== "exterior" || typeof road.attrs["road"] !== "number") continue;
    let frontage = 0;
    for (const b of model.boundaries) {
      const otherPath = b.a === road.path ? b.b : b.b === road.path ? b.a : undefined;
      if (!otherPath) continue;
      if (!siteZone || !otherPath.startsWith(siteZone.path + "/")) continue;
      for (const seg of segmentsFor(model, b)) frontage += segmentLength(seg);
    }
    roads.push({ road, width: road.attrs["road"], frontage: Math.round(frontage) });
  }

  return {
    ...(siteZone ? { siteZone } : {}),
    ...(typeof declared === "number" ? { declaredArea: declared } : {}),
    derivedArea,
    footprint,
    totalFloor,
    roads,
  };
}
