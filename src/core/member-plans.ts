// Horizontal projections of authored roof surfaces and structural members.
import type { Form, PlanClass, PlanEntity } from "./derive.js";
import type { Pt } from "./model.js";
import { area, subtract } from "./poly.js";
import { AREA_EPS, SPAN_EPS } from "./tolerance.js";

type Vertex = Pt & { z: number };

/** Clip a convex face on its plane, preserving z for the next cut. */
function clipZ(vertices: Vertex[], z: number, keepAbove: boolean): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    if (keepAbove ? a.z >= z : a.z <= z) out.push(a);
    if ((a.z < z && z < b.z) || (b.z < z && z < a.z)) {
      const t = (z - a.z) / (b.z - a.z);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), z });
    }
  }
  return out;
}

export function memberPlanEntities(
  form: Pick<Form, "roofs" | "beams" | "foundations">, level: string, cut: number,
): PlanEntity[] {
  const entities: PlanEntity[] = [];
  for (const of_ of ["beam", "foundation"] as const) {
    const members = of_ === "beam" ? form.beams : form.foundations;
    for (const member of members ?? []) {
      if (member.level !== level) continue;
      const cls = cut < member.z0 - SPAN_EPS ? "above" : cut > member.z1 + SPAN_EPS ? "below" : "cut";
      entities.push({ of: of_, ref: member.ref, class: cls, polygon: member.outline });
    }
  }
  for (const roof of form.roofs ?? []) {
    if (roof.level !== level) continue;
    const base = { of: "roof" as const, ref: roof.ref };
    for (const { vertices } of roof.faces) {
      const add = (cls: PlanClass, ring: Vertex[]) => {
        if (area(ring) > AREA_EPS) {
          entities.push({ ...base, class: cls, polygon: ring.map(({ x, y }) => ({ x, y })) });
        }
      };
      const low = Math.min(...vertices.map((p) => p.z));
      const high = Math.max(...vertices.map((p) => p.z));
      if (high < cut) add("below", vertices);
      else if (low > cut + roof.thickness) add("above", vertices);
      else if (low >= cut && high <= cut + roof.thickness) add("cut", vertices);
      else {
        const below = clipZ(vertices, cut, false);
        add("below", below);
        add("above", clipZ(vertices, cut + roof.thickness, true));
        if (roof.thickness > 0) {
          add("cut", clipZ(clipZ(vertices, cut, true), cut + roof.thickness, false));
        } else {
          // A surface intersects a plane along a line, with zero plan area.
          const ends = below.filter((p) => p.z === cut);
          const a = ends[0], b = ends[ends.length - 1];
          if (a && b && (a.x !== b.x || a.y !== b.y)) {
            entities.push({ ...base, class: "cut", lines: [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }] });
          }
        }
      }
    }
    const faces = roof.faces.map((face) => face.vertices);
    // An outline can extend beyond the portion for which heights are known.
    for (const piece of roof.outline) {
      for (const polygon of subtract(piece, faces)) {
        entities.push({ ...base, class: "footprint", polygon });
      }
    }
  }
  return entities;
}
