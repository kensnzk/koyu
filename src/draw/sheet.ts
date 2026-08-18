// koyu — the page every drawing is put on.
//
// **Nothing here decides shape.** This module holds what a sheet of paper is: the two inks, the
// escaping a piece of text needs before it can sit in markup, the rounding that keeps a path
// readable, the opening element, and the accumulator that measures how far the drawing reaches.
//
// It exists because there are three renderers now. While `plan.ts` and `axo.ts` were the only two,
// each carrying its own copy of `esc` and its own spelling of `#1f1f1f`, the duplication was
// cheap; a third copy is the point at which "the paper is the same paper" stops being visible in
// the code. What is **not** here is anything the three do differently — the world-to-paper mapping
// (a plan flips y, an axonometric does not), the title block, the margin. Sharing those would mean
// parameterising them until the shared version says less than the three separate ones did.

// The palette. Shared so that a plan and a section of the same building read as one set of
// drawings — which is the whole use of being able to lay them side by side. Every one of these may
// change; none of them is on a frozen surface.

/** The drawing ink. */
export const INK = "#1f1f1f";
/** The paper. */
export const PAPER = "#faf8f4";
/** The air of a room, cut open. */
export const ROOM = "#f1ebdd";
/** Given lines — the grid, and the level datums that are the grid of a section. */
export const GRID = "#b5aa94";
/** A line that is present but not the subject. */
export const FAINT = "#b3ab9c";

/** Two decimal places — enough for a coordinate on paper, and it keeps the path text short. */
export const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Text on its way into markup. Only the three characters that would end the surrounding element —
 * no name from the source is ever put inside an attribute, so quotes need no treatment.
 */
export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The opening element, the paper under the drawing, and the mark in the corner. */
export function openSheet(w: number, h: number): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">`,
    `<rect width="${w}" height="${h}" fill="${PAPER}"/>`,
    koyuMark(14, 13, 19),
  ];
}

// The mark, drawn rather than linked. A drawing koyu makes should say so on its face, and an SVG
// that reaches for a file is a drawing that arrives broken as often as not — so the two paths are
// here, in the light-mode colours, because the paper is light.
//
// The outline is a room in plan: a wall running round, stopping short at the foot to leave a
// doorway, one partition inside it, and an opening in red. Which is the whole notation in one
// figure, and the reason it is the mark.
const MARK_INK = "#171A18";
const MARK_OPENING = "#A84940";
const MARK_W = 803.138;
const MARK_H = 872.069;
const MARK_X = 224.392;
const MARK_Y = 171.361;

/** The koyu mark, its top-left corner at (x, y) and `size` tall. */
export function koyuMark(x: number, y: number, size: number): string {
  const k = size / MARK_H;
  const tx = r2(x - MARK_X * k);
  const ty = r2(y - MARK_Y * k);
  return (
    `<g transform="translate(${tx} ${ty}) scale(${r2(k * 1000) / 1000})">` +
    `<path d="M1027.53 171.361L224.461 171.363L224.392 1043.39L361.454 1043.42L361.567 308.689L889.587 308.679L889.581 904.864L566.4 904.876L566.387 524.585L419.01 452.015L419.047 1043.39L1027.51 1043.43L1027.53 171.361Z" fill="${MARK_INK}"/>` +
    `<path d="M707 445.022L811.864 445L811.858 613.697C811.831 648.974 812.209 684.759 811.831 720L707.005 719.933L707 445.022Z" fill="${MARK_OPENING}"/>` +
    `</g>`
  );
}

/** How wide the mark drawn by `openSheet` is, so a caller can keep clear of it. */
export const MARK_WIDTH = (19 / MARK_H) * MARK_W;

/**
 * How far the drawing reaches.
 *
 * **It folds; it does not spread.** `Math.min(...points)` passes one argument per point and a large
 * model runs past the limit on the number of arguments a call may take — a wall split by its
 * openings is one body per interval, so the bundled examples reach past a hundred thousand points.
 */
export class Extent {
  min0 = Infinity;
  max0 = -Infinity;
  min1 = Infinity;
  max1 = -Infinity;

  see(a: number, b: number): void {
    if (a < this.min0) this.min0 = a;
    if (a > this.max0) this.max0 = a;
    if (b < this.min1) this.min1 = b;
    if (b > this.max1) this.max1 = b;
  }

  /** Whether anything was ever seen. */
  get empty(): boolean {
    return this.min0 === Infinity;
  }
}
