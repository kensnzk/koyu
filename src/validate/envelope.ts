// 検証 — 外皮の連続 (ADR-0025)
//
// 方針が「保証しないもの」に**外皮の連続**を名指しで挙げている (spec/scope.md §3)。
// core に残るのは `envelopeGaps` — 何にも面していない外周の**線分を返す導出**であって、
// それが穴かどうかの判断はしない。判断はここが引き受ける。
//
// 判定は粗い。**外部への境界を一本でも書いたレベルだけ**を見る — 外皮をまだ模型に
// していない階を「穴が開いている」とは言わない。「書き始めたなら閉じきる」という
// 整合の要求であって、完全性の要求ではない。粗さが許されるのは、ここが凍らないからである。

import { envelopeGaps, segmentLength } from "../core/graph.js";
import { isSemiOutdoor, type Model } from "../core/model.js";
import { finding, type Finding } from "./index.js";

const VERTICAL = new Set(["stair", "shaft", "void"]);

export function envelopeFindings(model: Model): Finding[] {
  const out: Finding[] = [];
  const siteZones = [...model.zones.values()].filter((z) => z.attrs["site"] === 1).map((z) => z.path);

  // 外皮を書き始めているレベル = 領域を持たない空間 (外部) との境界が宣言されているレベル
  const envelopedLevels = new Set<string>();
  for (const b of model.boundaries) {
    if (b.derived || VERTICAL.has(b.kind)) continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    const outer = sa.rects.length === 0 ? sb : sb.rects.length === 0 ? sa : undefined;
    if (outer?.level) envelopedLevels.add(outer.level);
  }

  for (const s of model.spaces.values()) {
    if (s.rects.length === 0) continue;
    if (!s.level || !envelopedLevels.has(s.level)) continue;
    // 外部・半屋外・外構のタイルは囲われていないのが正常
    if (s.type === "exterior" || isSemiOutdoor(model, s)) continue;
    if (siteZones.some((z) => s.path.startsWith(z + "/"))) continue;

    const gaps = envelopeGaps(model, s);
    if (gaps.length === 0) continue;

    // **どの辺かを言う。**合計長だけでは、edge を書き分けている図面で直す辺が特定できない
    const byDir = new Map<string, number>();
    for (const g of gaps) {
      const d = g.edgeOfA ?? (g.horizontal ? "N/S" : "E/W");
      byDir.set(d, (byDir.get(d) ?? 0) + segmentLength(g));
    }
    const total = gaps.reduce((a, g) => a + segmentLength(g), 0);
    const where = [...byDir].map(([d, mm]) => `${d} ${Math.round(mm)}mm`).join(" / ");
    out.push(
      finding(
        "envelope.gap",
        `外皮に面していない外周があります: ${s.path} — ${where} (合計 ${Math.round(total)}mm・${gaps.length}区間)。外部への境界を書きます`,
        { line: s.line, file: s.file, path: [s.path] },
      ),
    );
  }
  return out;
}
