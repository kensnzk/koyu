import type { Form } from "./derive.js";
import { area } from "./poly.js";

/** Physical dimensions use model geometry. Space totals retain Core's per-space rounding. */
export function areaSchedule(form: Form) {
  const levels = form.levels.map(({ name: level }) => {
    let indoor = 0;
    let semiOutdoor = 0;
    let outdoor = 0;
    for (const space of form.spaces) {
      if (space.level !== level || space.void || space.areaM2 === undefined) continue;
      const hundredths = Math.round(space.areaM2 * 100);
      if (space.indoor) indoor += hundredths;
      else if (space.outside) outdoor += hundredths;
      else if (space.semiOutdoor) semiOutdoor += hundredths;
    }
    return { level, indoorM2: indoor / 100, semiOutdoorM2: semiOutdoor / 100, outdoorM2: outdoor / 100 };
  });

  const roofs = (form.roofs ?? []).map((roof) => ({
    ref: roof.ref,
    level: roof.level,
    projectedAreaM2: roof.projectedAreaM2,
    modeledProjectionM2: roof.modeledProjectionM2,
    ...(roof.surfaceAreaM2 === undefined ? {} : { surfaceAreaM2: roof.surfaceAreaM2 }),
    assumptions: roof.assumptions,
  }));
  const implicitRoofSlabs = form.slabs.filter((slab) => slab.kind === "roof").map((slab) => ({
    space: slab.space, level: slab.level, areaM2: area(slab.outline) / 1e6,
  }));
  const columns = form.columns.map((column) => ({
    ref: column.ref, level: column.level, areaM2: column.w * column.d / 1e6,
    volumeM3: column.w * column.d * (column.z1 - column.z0) / 1e9,
  }));
  const beams = (form.beams ?? []).map(({ ref, level, areaM2, volumeM3 }) =>
    ({ ref, level, areaM2, volumeM3 }));
  const foundations = (form.foundations ?? []).map(({ ref, type, level, areaM2, volumeM3 }) =>
    ({ ref, type, level, areaM2, volumeM3 }));
  return { levels, roofs, implicitRoofSlabs, columns, beams, foundations };
}
