// Public Form surface. derive() is the only public operation that assembles shape.

// The constructors of matter. `Form` holds centre lines, thicknesses and z; raising matter from
// those is part of the derivation, so **there is exactly one implementation and it is this one.**
// A consumer that cannot import them has to rewrite them, and then the parts are shared while the
// rules of assembly are not — which is the door to "two shapes from one Form".
export {
  band,
  bandLine,
  columnRect,
  runPrism,
  thicken,
  type FormPrism,
} from "./core/derive.js";

export {
  derive,
  DERIVATION_CONSTANTS,
  type DeriveOptions,
  type Form,
  type FormBoundary,
  type FormColumn,
  type FormInput,
  type FormLevel,
  type FormOpening,
  type FormPanel,
  type FormPlan,
  type FormRun,
  type FormSeg,
  type FormSite,
  type FormSpace,
  type FormSwing,
  type PlanClass,
  type PlanEntity,
  type PlanRole,
  type PlanSubject,
} from "./core/derive.js";

export { TOLERANCES } from "./core/tolerance.js";

export type { Slab, SlabKind } from "./core/fabric.js";

export type {
  RunDevice,
  RunForm,
  RunPart,
  RunSolid,
  Seg2,
  VerticalRun,
} from "./core/vertical.js";
