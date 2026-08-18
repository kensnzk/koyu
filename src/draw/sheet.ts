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

/** The drawing ink. */
export const INK = "#1f1f1f";
/** The paper. */
export const PAPER = "#faf8f4";

/** Two decimal places — enough for a coordinate on paper, and it keeps the path text short. */
export const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Text on its way into markup. Only the three characters that would end the surrounding element —
 * no name from the source is ever put inside an attribute, so quotes need no treatment.
 */
export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The opening element and the paper under the drawing. */
export function openSheet(w: number, h: number): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">`,
    `<rect width="${w}" height="${h}" fill="${PAPER}"/>`,
  ];
}

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
