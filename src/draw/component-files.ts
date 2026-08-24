import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { placedComponents } from "../core/components.js";
import type { Model } from "../core/model.js";

/**
 * Read component plan artwork for a filesystem-backed model. The bytes enter drawing only: they
 * are absent from Model, canonical JSON and Form. A composed override resolves relative to the
 * layer that supplied the winning plan-svg value.
 */
export function componentSvgFiles(model: Model, level?: string): Readonly<Record<string, string>> {
  const sources: Record<string, string> = {};
  const needed = new Set(
    placedComponents(model).components
      .filter((component) => level === undefined || component.level === level)
      .map((component) => component.asset),
  );
  for (const asset of model.assets.values()) {
    if (asset.kind !== "component" || !needed.has(asset.name)) continue;
    const ref = asset.attrs["plan-svg"];
    if (typeof ref !== "string" || (!ref.startsWith("./") && !ref.startsWith("../"))) continue;
    const layer = model.attrSrc.get(`asset:${asset.name}:plan-svg`);
    const from = layer === undefined ? asset.file : model.layers[layer] ?? asset.file;
    if (!from) {
      throw new Error(`Component asset ${asset.name} plan-svg cannot be resolved from a source file`);
    }
    const file = resolve(dirname(from), ref);
    try {
      sources[asset.name] = readFileSync(file, "utf8");
    } catch {
      throw new Error(`Cannot read plan SVG for component asset ${asset.name}: ${ref}`);
    }
  }
  return sources;
}
