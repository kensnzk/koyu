// Non-orthogonal edges of a grid cell. Keep distances along the edge in millimetres
// so a door width and a partially shared face use the same metric as an X/Y bay.
import type { Segment } from "./graph.js";
import type { Pt } from "./model.js";
import { EPS } from "./tolerance.js";

function diagonalEdges(ring: Pt[]): Segment[] {
  const edges: Segment[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < EPS || Math.abs(dy) < EPS) continue;
    // Derived rings wind counterclockwise, so their outward normal is (dy,-dx).
    const edgeOfA = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "E" : "W") : (dx > 0 ? "S" : "N");
    const [p, q] = dx > 0 ? [a, b] : [b, a];
    edges.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, horizontal: false, diagonal: true, edgeOfA });
  }
  return edges;
}

function intervalOn(edge: Segment, other: Segment): [number, number] | undefined {
  const dx = edge.x2 - edge.x1, dy = edge.y2 - edge.y1;
  const len = Math.hypot(dx, dy);
  const distance = (x: number, y: number) => (dx * (y - edge.y1) - dy * (x - edge.x1)) / len;
  if (Math.abs(distance(other.x1, other.y1)) > EPS || Math.abs(distance(other.x2, other.y2)) > EPS) return;
  const along = (x: number, y: number) => (dx * (x - edge.x1) + dy * (y - edge.y1)) / len;
  const a = along(other.x1, other.y1), b = along(other.x2, other.y2);
  return [Math.min(a, b), Math.max(a, b)];
}

function portion(e: Segment, lo: number, hi: number): Segment {
  const dx = e.x2 - e.x1, dy = e.y2 - e.y1, len = Math.hypot(dx, dy);
  return { ...e, x1: e.x1 + lo * dx / len, y1: e.y1 + lo * dy / len,
    x2: e.x1 + hi * dx / len, y2: e.y1 + hi * dy / len };
}

/** Keep either the covered part or its complement, against one collinear segment. */
export function clipDiagonal(edge: Segment, other: Segment, keepCovered: boolean): Segment[] {
  const span = intervalOn(edge, other);
  const len = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1);
  const lo = span ? Math.max(0, span[0]) : len, hi = span ? Math.min(len, span[1]) : 0;
  if (hi - lo <= EPS) return keepCovered ? [] : [edge];
  if (keepCovered) return [portion(edge, lo, hi)];
  const parts: Segment[] = [];
  if (lo > EPS) parts.push(portion(edge, 0, lo));
  if (hi < len - EPS) parts.push(portion(edge, hi, len));
  return parts;
}

export function sharedCellEdges(a: Pt[][], b: Pt[][]): Segment[] {
  const peers = b.flatMap(diagonalEdges);
  return a.flatMap(diagonalEdges).flatMap(edge => peers
    .filter(peer => peer.edgeOfA !== edge.edgeOfA)
    .flatMap(peer => clipDiagonal(edge, peer, true)));
}

export function exposedCellEdges(pieces: Pt[][], others: Pt[][]): Segment[] {
  const peers = [...pieces, ...others].flatMap(diagonalEdges);
  return pieces.flatMap(diagonalEdges).flatMap(edge => {
    let free = [edge];
    for (const peer of peers) {
      if (peer.edgeOfA !== edge.edgeOfA) free = free.flatMap(part => clipDiagonal(part, peer, false));
    }
    return free;
  });
}

/** A neighboring allocation may split a single side into several collinear pieces. */
export function mergeDiagonals(edges: Segment[]): Segment[] {
  const merged: Segment[] = [];
  for (const edge of edges) {
    let span = edge;
    for (let i = merged.length - 1; i >= 0; i--) {
      const peer = merged[i]!;
      if (peer.edgeOfA !== edge.edgeOfA) continue;
      const along = intervalOn(span, peer), len = Math.hypot(span.x2 - span.x1, span.y2 - span.y1);
      if (!along || along[0] > len + EPS || along[1] < -EPS) continue;
      span = portion(span, Math.min(0, along[0]), Math.max(len, along[1]));
      merged.splice(i, 1);
    }
    merged.push(span);
  }
  return merged;
}
