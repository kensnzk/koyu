// Public Form surface. derive() is the only public operation that assembles shape.

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
