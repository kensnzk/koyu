import { koyuMark } from "./brand.js";

// Shared presentation for standalone SVG sheets. The selected palette belongs to one render.
export const DRAWING_STYLES = ["ink", "blueprint", "classic"] as const;
export type DrawingStyle = (typeof DRAWING_STYLES)[number];

export interface SheetOptions {
  /** Colour scheme of the SVG drawing. */
  drawingStyle?: DrawingStyle;
}

const classic = {
  paper: "#faf8f4", ink: "#1f1f1f", grid: "#b5aa94", faint: "#b3ab9c", label: "#8a8171",
  room: "#f1ebdd", semiOutdoor: "#eef1e9", outdoor: "#dfe6da", subdivision: "#e7dfcc",
  segment: "#77716a", glass: "#b9c3c0", beyond: "#b8b0a0", guide: "#A84940",
  members: { roof: "#367b81", beam: "#a36625", foundation: "#72628e" },
  axo: { floor: "#cfc7b6", roof: "#8d8577", ceiling: "#e2dbca", wall: "#b8b0a0",
    column: "#5d574d", run: "#7f8f8a", ground: "#eceadf" },
};
export type SheetPalette = typeof classic;

const palettes: Record<DrawingStyle, SheetPalette> = {
  ink: {
    paper: "#ffffff", ink: "#101619", grid: "#647078", faint: "#747c80", label: "#4c585e",
    room: "#fafafa", semiOutdoor: "#f0f2f2", outdoor: "#e2e7e6", subdivision: "#d2d7d7",
    segment: "#556067", glass: "#c0d1d5", beyond: "#d2d7d9", guide: "#983d32",
    members: { roof: "#495e68", beam: "#57534b", foundation: "#625e69" },
    axo: { floor: "#d6dbdd", roof: "#a9b3b7", ceiling: "#e7e9e9", wall: "#bfcbcf",
      column: "#64717a", run: "#8b9a9f", ground: "#edf0ef" },
  },
  blueprint: {
    paper: "#061426", ink: "#f1f8ff", grid: "#84b6d5", faint: "#96b6c9", label: "#d0e6f3",
    room: "#0b2139", semiOutdoor: "#132f45", outdoor: "#1b3b4d", subdivision: "#284a63",
    segment: "#accde4", glass: "#537e99", beyond: "#294861", guide: "#ffd99e",
    members: { roof: "#85d8e4", beam: "#ffd092", foundation: "#c7b7ed" },
    axo: { floor: "#6f95ac", roof: "#5c809b", ceiling: "#a2becb", wall: "#779bb4",
      column: "#b6d1e0", run: "#90bfc6", ground: "#395e76" },
  },
  classic,
};

export function sheetPalette(style: DrawingStyle = "ink"): SheetPalette {
  if (!Object.hasOwn(palettes, style)) throw new Error(`Unknown drawing style: ${style}`);
  return palettes[style];
}

/** Two decimal places — enough for a coordinate on paper, and it keeps the path text short. */
export const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Text on its way into markup. Only the three characters that would end the surrounding element —
 * no name from the source is ever put inside an attribute, so quotes need no treatment.
 */
export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function memberInk(palette: SheetPalette, subject: string): string | undefined {
  const members = palette.members;
  return Object.hasOwn(members, subject) ? members[subject as keyof typeof members] : undefined;
}

/** Identify projected parts for selection or inspection, including paths with quoted names. */
export function subjectAttrs(subject: string, ref: string): string {
  return `data-of="${esc(subject).replace(/"/g, "&quot;")}" data-ref="${esc(ref).replace(/"/g, "&quot;")}"`;
}

/** The opening element, the paper under the drawing, and the mark in the corner. */
export function openSheet(w: number, h: number, palette: SheetPalette): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">`,
    `<rect width="${w}" height="${h}" fill="${palette.paper}"/>`,
    koyuMark(14, 13, MARK_WIDTH, palette.ink),
  ];
}

/** Width in sheet units of the square brand symbol. */
export const MARK_WIDTH = 19;

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
