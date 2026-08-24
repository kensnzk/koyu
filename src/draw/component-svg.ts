import type { Asset } from "../core/model.js";

export interface ComponentSvg {
  dataUri: string;
  viewBox: { width: number; height: number };
}

/**
 * Validate an SVG before it is embedded as an isolated image. Isolation preserves Figma-style
 * defs, masks and clip paths without letting IDs collide with the plan sheet.
 */
export function componentSvg(asset: Asset, source: string): ComponentSvg {
  const text = source.trim();
  const root = /<svg\b([^>]*)>/i.exec(text);
  if (!root) throw new Error(`Component asset ${asset.name} plan-svg does not contain an svg root`);
  const number = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
  const viewBox = new RegExp(
    `\\bviewBox\\s*=\\s*["']\\s*(${number})\\s+(${number})\\s+(${number})\\s+(${number})\\s*["']`,
    "i",
  ).exec(root[1]!);
  if (!viewBox) throw new Error(`Component asset ${asset.name} plan-svg requires a positive viewBox`);
  const width = Number(viewBox[3]);
  const height = Number(viewBox[4]);
  if (!(width > 0 && height > 0)) throw new Error(`Component asset ${asset.name} plan-svg requires a positive viewBox`);

  const forbidden = [
    /<!DOCTYPE/i,
    /<!ENTITY/i,
    /<script\b/i,
    /<foreignObject\b/i,
    /<(?:animate|animateMotion|animateTransform|set)\b/i,
    /\s(?:[A-Za-z_][\w.-]*:)?on[a-z]+\s*=/i,
    /javascript\s*:/i,
    /@import\b/i,
  ];
  if (forbidden.some((pattern) => pattern.test(text))) {
    throw new Error(`Component asset ${asset.name} plan-svg contains active or external content`);
  }
  for (const match of text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1]!;
    if (!safeReference(value)) {
      throw new Error(`Component asset ${asset.name} plan-svg contains an external reference: ${value}`);
    }
  }
  for (const match of text.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) {
    const value = match[1]!.replace(/^["']|["']$/g, "").trim();
    if (!safeReference(value)) {
      throw new Error(`Component asset ${asset.name} plan-svg contains an external reference: ${value}`);
    }
  }

  const w = asset.attrs["w"];
  const d = asset.attrs["d"];
  if (typeof w !== "number" || !(w > 0) || typeof d !== "number" || !(d > 0)) {
    throw new Error(`Component asset ${asset.name} requires positive w: and d:`);
  }
  const sourceRatio = width / height;
  const physicalRatio = w / d;
  const ratioError = Math.abs(sourceRatio - physicalRatio) / physicalRatio;
  if (ratioError > 0.001) {
    throw new Error(
      `Component asset ${asset.name} plan-svg viewBox ratio ${round(sourceRatio)} does not match w:d ratio ${round(physicalRatio)}`,
    );
  }

  return {
    dataUri: `data:image/svg+xml,${encodeURIComponent(text).replace(/'/g, "%27").replace(/"/g, "%22")}`,
    viewBox: { width, height },
  };
}

function safeReference(value: string): boolean {
  if (value.startsWith("#")) return true;
  return /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
