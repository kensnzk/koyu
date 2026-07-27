// 検証 — 敷地に対する建物の判断 (ADR-0009 / ADR-0011)
//
// 敷地形状そのものの健全性 (重複頂点・自己交差・対応ゾーンの不在) は **core に残る** —
// 与件が壊れていれば形が作れないので、あれは読解の一部である。
//
// ここが持つのは建物と敷地の**関係についての判断**の二つだけ:
//   - 建物が敷地からはみ出していないか (形は一意に出る。出た形が法に触れるかは別の話)
//   - 測量値として書かれた面積と、多角形から導出される面積が食い違わないか
//
// 建蔽率・容積率は**数**なので core の siteReport が返す。上限と較べるのは、
// 用途地域という原本の外の事実を要するので、ここでも持たない — 持てるようになったら足す。

import { polygonAreaM2, regionOf, shapeEscapesPolygon, type Model } from "../core/model.js";
import { siteReport } from "../core/site.js";
import { finding, type Finding } from "./index.js";

/** 敷地の許容 mm — 境界上は内側扱い */
const EPS_SITE = 1;
/** 面積照合の許容 ㎡ */
const AREA_TOLERANCE = 0.05;
/** 接道長の下限 mm — 法43条 (接道義務) の粗い写し */
export const FRONTAGE_MIN = 2000;

export function siteFindings(model: Model): Finding[] {
  const out: Finding[] = [];
  const withRect = [...model.spaces.values()].filter((s) => s.rects.length > 0);

  // 接道 — core が返すのは接道長という数だけで、2m という下限は建築の側の規則である
  const report = siteReport(model);
  for (const road of report.roads) {
    if (road.frontage >= FRONTAGE_MIN) continue;
    out.push(
      finding(
        "site.frontage",
        `接道長が足りません: ${road.road.path} — ${road.frontage}mm (${FRONTAGE_MIN}mm 以上)`,
        { line: road.road.line, file: road.road.file, path: [road.road.path] },
      ),
    );
  }

  for (const poly of model.polygons.values()) {
    const zone = model.zones.get(poly.path);
    // 形の健全性と対応ゾーンの不在は core が既に言っている — ここでは黙って飛ばす
    if (!zone || zone.attrs["site"] !== 1) continue;

    const declared = zone.attrs["area"];
    if (typeof declared === "number") {
      const derived = polygonAreaM2(poly.points);
      if (Math.abs(declared - derived) >= AREA_TOLERANCE) {
        out.push(
          finding(
            "site.area",
            `敷地面積の宣言と導出が食い違います: 宣言 ${declared}㎡ / 導出 ${derived.toFixed(2)}㎡`,
            { line: zone.line, file: zone.file, path: [zone.path] },
          ),
        );
      }
    }

    for (const s of withRect) {
      if (s.type === "exterior" || s.path.startsWith(poly.path + "/")) continue;
      // 照合するのは割付ではなく**導出された領域** — 敷地なりに切った外形はここで通る
      for (const r of regionOf(s)) {
        const esc = shapeEscapesPolygon(r, poly.points, EPS_SITE);
        if (esc) {
          out.push(
            finding(
              "site.escape",
              `${s.path} が敷地形状からはみ出しています (${Math.round(esc.x)},${Math.round(esc.y)} 付近)`,
              { line: s.line, file: s.file, path: [s.path] },
            ),
          );
          break;
        }
      }
    }
  }
  return out;
}
