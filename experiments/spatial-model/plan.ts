import { area, boundsOf } from "../../src/core/poly.js";
import type { SpatialReport } from "./model.js";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export function spatialPlan(report: SpatialReport, level: string): string {
  if (report.state === "invalid") throw new Error("Correct spatial diagnostics before drawing a plan");
  if (!report.levels.some(l => l.name === level)) throw new Error(`Undeclared level: ${level}`);
  const spaces = report.spaces.filter(s => s.level === level && s.outline.length > 0);
  const bounds = boundsOf(spaces.flatMap(s => s.outline));
  if (!bounds) throw new Error(`No spatial regions on level ${level}`);
  const scale = 680 / Math.max(bounds.x2 - bounds.x1, bounds.y2 - bounds.y1, 1);
  const x = (v: number) => 60 + (v - bounds.x1) * scale;
  const y = (v: number) => 100 + (bounds.y2 - v) * scale;
  const width = Math.max(800, (bounds.x2 - bounds.x1) * scale + 120);
  const height = (bounds.y2 - bounds.y1) * scale + 230;
  const palette = ["#d9e7dd", "#e8dccb", "#d9e3ed", "#e9d6d0", "#ded9eb"];
  const grids = report.grid.X.coords.map((v, i) => v < bounds.x1 || v > bounds.x2 ? "" :
    `<line x1="${x(v)}" y1="85" x2="${x(v)}" y2="${y(bounds.y1) + 18}" stroke="#cbd5cc" stroke-dasharray="2 5"/><text x="${x(v)}" y="${y(bounds.y1) + 35}" text-anchor="middle" class="small">${escape(report.grid.X.names[i]!)}</text>`).join("") +
    report.grid.Y.coords.map((v, i) => v < bounds.y1 || v > bounds.y2 ? "" :
      `<line x1="42" y1="${y(v)}" x2="${x(bounds.x2) + 18}" y2="${y(v)}" stroke="#cbd5cc" stroke-dasharray="2 5"/><text x="34" y="${y(v) + 4}" text-anchor="end" class="small">${escape(report.grid.Y.names[i]!)}</text>`).join("");
  const body = spaces.map((space, i) => {
    const polygons = space.outline.map(points => `<polygon points="${points.map(p => `${x(p.x)},${y(p.y)}`).join(" ")}" fill="${palette[i % palette.length]}" stroke="#fff" stroke-width="2"/>`).join("");
    const piece = [...space.outline].sort((a, b) => area(b) - area(a))[0]!;
    const cx = x(piece.reduce((sum, p) => sum + p.x, 0) / piece.length);
    const cy = y(piece.reduce((sum, p) => sum + p.y, 0) / piece.length);
    return `<g data-space="${escape(space.path)}">${polygons}<text x="${cx}" y="${cy - 4}" text-anchor="middle">${escape(space.name)}</text><text x="${cx}" y="${cy + 17}" text-anchor="middle" class="small">${space.areaM2 ?? "?"} m²</text></g>`;
  }).join("");
  const lines = report.relations.filter(r => r.level === level).map(r => {
    const s = r.segment;
    const declared = r.resolution === "declared";
    return `<line data-resolution="${r.resolution}" x1="${x(s.x1)}" y1="${y(s.y1)}" x2="${x(s.x2)}" y2="${y(s.y2)}" stroke="${declared ? "#273c35" : "#73877c"}" stroke-width="${declared ? 3 : 1}"${declared ? "" : ' stroke-dasharray="5 5"'}><title>${escape(`${r.a} / ${r.b}: ${r.type ?? "unresolved"}; passage ${r.passage}`)}</title></line>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Spatial model ${escape(level)}">
<style>text{font-family:Arial,sans-serif;fill:#273c35;font-size:16px}.small{font-size:12px;fill:#52665c}.title{font-size:24px}</style>
<rect width="100%" height="100%" fill="#fafbf8"/>
<text x="60" y="38" class="title">Spatial model · ${escape(level)}</text>
<text x="60" y="63" class="small">Space allocation · ${report.levels.find(l => l.name === level)!.areaM2} m² · +Y upward</text>
${grids}${body}${lines}
<text x="60" y="${height - 48}" class="small">Dashed: unresolved boundary · Solid: declared relation</text>
<text x="60" y="${height - 27}" class="small">Circulation, daylight and egress: not evaluated</text>
</svg>\n`;
}
