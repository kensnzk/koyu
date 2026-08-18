// koyu — reading back what was written, from a mark or a scene node (`@kensnzk/koyu/draw`)
//
// `Mark.written` and `SceneNode.written` give a place in **canonical boundary order**. Reaching the
// attributes from that place needs the model, and needs it read in exactly one way: `Form`'s index
// is an index into `canonicalBoundaryOrder(model)`, never into `model.boundaries`. Declaration
// order is information the canonical form discards, so indexing by it does not throw — **it reads
// another boundary's `spec`**, on some models and not others (ADR-0041).
//
// **Why this and not the ordering function itself.** Two things go wrong when a consumer holds the
// sorted array. It sorts per lookup — both viewers did, once per boundary, re-sorting the whole
// building each time, which is the cost ADR-0041 names. And the raw array invites
// `model.boundaries[i]` to be substituted for it by anyone who does not know the difference, which
// is the failure the ordering exists to prevent. A window that answers "what was written here"
// closes both: sorted once per model, and there is no array to mis-index.
//
// This lives in the presentation face because it is not part of the language. `spec` is a carried
// free word — core neither reads it nor promises what it means (docs/reference/muro/attributes.md);
// only a drawing ever asks.
import { canonicalBoundaryOrder, type Model } from "../core/model.js";

/** What a model wrote at a place the `Form` points to. */
export interface Written {
  /** the `spec` on a boundary, by its place in canonical order */
  boundarySpec(boundary: number): string | undefined;
  /** the `spec` on a segment that does not count */
  segSpec(boundary: number, index: number): string | undefined;
  /** the `spec` on an opening */
  openingSpec(boundary: number, index: number): string | undefined;
  /** any carried attribute on a boundary, including a namespaced one */
  boundaryAttr(boundary: number, key: string): string | number | boolean | undefined;
  /** any carried attribute on an opening */
  openingAttr(boundary: number, index: number, key: string): string | number | boolean | undefined;
}

// A model is a value, so the answer for one never changes. Sorting is O(n log n) over every
// boundary; doing it once per model is the whole point of the cache.
const cache = new WeakMap<Model, Written>();

/**
 * A window onto what a model wrote, addressed the way `Form` addresses it.
 *
 * ```ts
 * const written = writtenOf(model);
 * for (const n of sceneOf(form).nodes) {
 *   const spec = n.written && written.boundarySpec(n.written.boundary);
 *   // deciding that a spec containing "glass" means transparent is the viewer's judgement
 * }
 * ```
 */
export function writtenOf(model: Model): Written {
  const hit = cache.get(model);
  if (hit) return hit;
  const ordered = canonicalBoundaryOrder(model);
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const made: Written = {
    boundarySpec: (b) => str(ordered[b]?.attrs["spec"]),
    segSpec: (b, i) => str(ordered[b]?.segs[i]?.attrs["spec"]),
    openingSpec: (b, i) => str(ordered[b]?.openings[i]?.attrs["spec"]),
    boundaryAttr: (b, key) => ordered[b]?.attrs[key],
    openingAttr: (b, i, key) => ordered[b]?.openings[i]?.attrs[key],
  };
  cache.set(model, made);
  return made;
}
