import {
  canonicalSpaceOrder,
  compareCanonical,
  pointInPolygon,
  regionOf,
  type Area,
  type Asset,
  type Model,
  type Pt,
  type Space,
} from "./model.js";
import { EPS } from "./tolerance.js";

export type ComponentAlignment = "min" | "center" | "max";

/** A placed component is physical plan geometry without any drawing vocabulary. */
export interface PlacedComponent {
  space: string;
  area: string;
  asset: string;
  level: string;
  centre: Pt;
  w: number;
  d: number;
  rotation: number;
  footprint: Pt[];
}

export interface ComponentIssue {
  code: "CMP01" | "CMP02";
  message: string;
  line: number;
  file?: string;
  path: string[];
}

export interface ComponentPlacementResult {
  components: PlacedComponent[];
  issues: ComponentIssue[];
}

/**
 * Resolve every area-hosted component. A named area is the only placement frame: there is no
 * second absolute-position spelling that could drift away from the space allocation.
 */
export function placedComponents(model: Model): ComponentPlacementResult {
  const components: PlacedComponent[] = [];
  const issues: ComponentIssue[] = [];

  for (const space of canonicalSpaceOrder(model)) {
    const areas = [...space.areas].sort((a, b) => compareCanonical(areaKey(a), areaKey(b)));
    for (const area of areas) {
      const ref = area.attrs["asset"];
      const at = location(space, area);
      if (ref === undefined) {
        const orphan = ["align-x", "align-y", "offset-x", "offset-y", "rotate"]
          .find((key) => area.attrs[key] !== undefined);
        if (orphan) {
          issues.push({
            code: "CMP01",
            message: `${orphan}: on an area requires asset: because it only controls component placement`,
            ...at,
          });
        }
        continue;
      }
      if (typeof ref !== "string") {
        issues.push({ code: "CMP01", message: `asset on an area names a component asset: asset:${ref}`, ...at });
        continue;
      }
      const name = area.attrs["name"];
      if (typeof name !== "string" || name.length === 0) {
        issues.push({
          code: "CMP01",
          message: `An area that places asset ${ref} requires name: (the name identifies the placed component)`,
          ...at,
        });
        continue;
      }
      const asset = model.assets.get(ref);
      if (!asset) {
        issues.push({ code: "CMP01", message: `Undefined component asset on area ${name}: ${ref}`, ...at });
        continue;
      }
      if (asset.kind !== "component") {
        issues.push({
          code: "CMP01",
          message: `The asset ${ref} is a ${asset.kind} (an area can place only a component asset)`,
          ...at,
        });
        continue;
      }
      const dimensions = componentDimensions(asset);
      if (!dimensions || !space.level) continue;
      const settings = placementSettings(area);
      if (settings === undefined) continue;
      if ("message" in settings) {
        issues.push({ code: "CMP01", message: `${settings.message} on area ${name}`, ...at });
        continue;
      }

      const component = place(space, area, asset, name, dimensions, settings);
      components.push(component);
      const insideHost = inside(area, component.footprint);
      const insideSpace = regionOf(space).some((piece) =>
        component.footprint.every((point) => pointInPolygon(point, piece, EPS))
      );
      if (!insideHost) {
        const alternate = place(space, area, asset, name, dimensions, {
          ...settings,
          rotation: (settings.rotation + 90) % 360,
        });
        const suggestion = inside(area, alternate.footprint) ? "; rotate it by a further 90 degrees to fit" : "";
        issues.push({
          code: "CMP02",
          message: `${ref} extends outside its host area ${name}${suggestion}`,
          ...at,
        });
      } else if (!insideSpace) {
        issues.push({
          code: "CMP02",
          message: `${ref} extends outside its parent space ${space.path}`,
          ...at,
        });
      }
    }
  }

  return { components, issues };
}

function componentDimensions(asset: Asset): { w: number; d: number } | undefined {
  const w = asset.attrs["w"];
  const d = asset.attrs["d"];
  return typeof w === "number" && w > 0 && typeof d === "number" && d > 0 ? { w, d } : undefined;
}

function placementSettings(area: Area):
  | { alignX: ComponentAlignment; alignY: ComponentAlignment; offsetX: number; offsetY: number; rotation: number }
  | { message: string }
  | undefined {
  const alignX = area.attrs["align-x"] ?? "center";
  const alignY = area.attrs["align-y"] ?? "center";
  const offsetX = area.attrs["offset-x"] ?? 0;
  const offsetY = area.attrs["offset-y"] ?? 0;
  const rotation = area.attrs["rotate"] ?? 0;
  // The attribute ledger owns these enum errors as ATT02. Omit the unresolved component here so
  // one invalid value does not also produce CMP01 for the same spelling.
  if (!isAlignment(alignX) || !isAlignment(alignY)) return undefined;
  if (typeof offsetX !== "number" || !Number.isFinite(offsetX)) {
    return { message: `offset-x is a finite number in mm: offset-x:${offsetX}` };
  }
  if (typeof offsetY !== "number" || !Number.isFinite(offsetY)) {
    return { message: `offset-y is a finite number in mm: offset-y:${offsetY}` };
  }
  if (typeof rotation !== "number" || !Number.isFinite(rotation) || rotation < 0 || rotation >= 360) {
    return { message: `rotate is a number in 0 <= degrees < 360: rotate:${rotation}` };
  }
  return { alignX, alignY, offsetX, offsetY, rotation };
}

function place(
  space: Space,
  area: Area,
  asset: Asset,
  name: string,
  dimensions: { w: number; d: number },
  settings: { alignX: ComponentAlignment; alignY: ComponentAlignment; offsetX: number; offsetY: number; rotation: number },
): PlacedComponent {
  const rad = settings.rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfX = Math.abs(cos) * dimensions.w / 2 + Math.abs(sin) * dimensions.d / 2;
  const halfY = Math.abs(sin) * dimensions.w / 2 + Math.abs(cos) * dimensions.d / 2;
  const cx = aligned(area.rect.x1, area.rect.x2, halfX, settings.alignX) + settings.offsetX;
  const cy = aligned(area.rect.y1, area.rect.y2, halfY, settings.alignY) + settings.offsetY;
  const corners: Pt[] = [
    { x: -dimensions.w / 2, y: -dimensions.d / 2 },
    { x: dimensions.w / 2, y: -dimensions.d / 2 },
    { x: dimensions.w / 2, y: dimensions.d / 2 },
    { x: -dimensions.w / 2, y: dimensions.d / 2 },
  ];
  const footprint = corners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
  return {
    space: space.path,
    area: name,
    asset: asset.name,
    level: space.level!,
    centre: { x: cx, y: cy },
    w: dimensions.w,
    d: dimensions.d,
    rotation: settings.rotation,
    footprint,
  };
}

function aligned(lo: number, hi: number, half: number, alignment: ComponentAlignment): number {
  if (alignment === "min") return lo + half;
  if (alignment === "max") return hi - half;
  return (lo + hi) / 2;
}

function inside(area: Area, footprint: readonly Pt[]): boolean {
  return footprint.every((p) =>
    p.x >= area.rect.x1 - EPS && p.x <= area.rect.x2 + EPS
    && p.y >= area.rect.y1 - EPS && p.y <= area.rect.y2 + EPS
  );
}

function isAlignment(value: unknown): value is ComponentAlignment {
  return value === "min" || value === "center" || value === "max";
}

function location(space: Space, area: Area): { line: number; file?: string; path: string[] } {
  return { line: area.line, ...(space.file ? { file: space.file } : {}), path: [space.path] };
}

function areaKey(area: Area): string {
  const name = area.attrs["name"];
  return `${typeof name === "string" ? name : ""}\u0000${JSON.stringify([area.grid, area.attrs])}`;
}
