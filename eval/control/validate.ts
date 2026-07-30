// The W3 control group's validator — it applies schema.json.
//
// **Why write it here instead of adding a dependency.** The repository keeps zero runtime
// dependencies, and eval/ could carry a devDependency, but the thing that matters more is
// **not being accused of beating a strawman**. `schema.json` is standard JSON Schema
// (draft 2020-12), so a third party can apply it with ajv or any other implementation. If this
// one file is weak, that weakness can be pointed at **specifically**.
//
// Supported keywords are exactly the ones schema.json actually uses:
//   type / const / enum / required / additionalProperties / properties / items
//   minItems / maxItems / minLength / minimum / exclusiveMinimum / pattern / $ref / $defs
//
// **What JSON Schema cannot say is the point of the experiment.**
//   * Referential integrity — whether `opening.wall` names a wall that exists
//   * Geometric consistency — whether a wall's endpoints lie on a room edge, whether rooms overlap
//   * Agreement of derived values — whether `areaM2` equals the area of `pieces`, whether
//     `groups[].areaM2` equals the sum over its members
// In muro, `check` says the first two structurally, and the third cannot break because nothing
// is stored. In the control every one of them **breaks silently**. Counting that silence is the
// job of `eval/control/oracle.ts`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface SchemaError {
  path: string;
  message: string;
}

type Schema = Record<string, unknown>;

const SCHEMA_PATH = fileURLToPath(new URL("schema.json", import.meta.url));

export function loadSchema(): Schema {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Schema;
}

const typeOf = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? "number" : typeof v;

/** Walk a local pointer such as `#/$defs/point` */
function resolve(root: Schema, ref: string): Schema {
  if (!ref.startsWith("#/")) throw new Error(`this validator only supports local $ref: ${ref}`);
  let cur: unknown = root;
  for (const seg of ref.slice(2).split("/")) {
    cur = (cur as Record<string, unknown>)[seg];
    if (cur === undefined) throw new Error(`the $ref does not resolve: ${ref}`);
  }
  return cur as Schema;
}

function check(root: Schema, schema: Schema, value: unknown, path: string, out: SchemaError[]): void {
  if (typeof schema["$ref"] === "string") {
    check(root, resolve(root, schema["$ref"]), value, path, out);
    return;
  }
  const push = (message: string): void => {
    out.push({ path: path === "" ? "(root)" : path, message });
  };

  if (schema["const"] !== undefined && value !== schema["const"]) {
    push(`must be ${JSON.stringify(schema["const"])}, got ${JSON.stringify(value)}`);
    return;
  }
  if (Array.isArray(schema["enum"]) && !schema["enum"].includes(value)) {
    push(`must be one of ${JSON.stringify(schema["enum"])}, got ${JSON.stringify(value)}`);
    return;
  }
  const t = schema["type"];
  const types = t === undefined ? undefined : Array.isArray(t) ? (t as string[]) : [t as string];
  if (types !== undefined) {
    const actual = typeOf(value);
    const ok = types.some((want) => (want === "integer" ? Number.isInteger(value) : actual === want));
    if (!ok) {
      push(`must be ${types.join(" | ")}, got ${actual}`);
      return;
    }
  }

  if (typeof value === "string") {
    const min = schema["minLength"];
    if (typeof min === "number" && value.length < min) push(`must be at least ${min} characters`);
    const pat = schema["pattern"];
    if (typeof pat === "string" && !new RegExp(pat).test(value)) push(`must match ${pat}, got ${JSON.stringify(value)}`);
  }

  if (typeof value === "number") {
    const min = schema["minimum"];
    if (typeof min === "number" && value < min) push(`must be >= ${min}, got ${value}`);
    const xmin = schema["exclusiveMinimum"];
    if (typeof xmin === "number" && value <= xmin) push(`must be > ${xmin}, got ${value}`);
  }

  if (Array.isArray(value)) {
    const min = schema["minItems"];
    if (typeof min === "number" && value.length < min) push(`must have at least ${min} items, got ${value.length}`);
    const max = schema["maxItems"];
    if (typeof max === "number" && value.length > max) push(`must have at most ${max} items, got ${value.length}`);
    const items = schema["items"];
    if (items !== undefined) {
      for (const [i, v] of value.entries()) check(root, items as Schema, v, `${path}[${i}]`, out);
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const props = (schema["properties"] ?? {}) as Record<string, Schema>;
    for (const key of (schema["required"] ?? []) as string[]) {
      if (!(key in obj)) push(`is missing the required property ${key}`);
    }
    if (schema["additionalProperties"] === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) push(`carries the unknown property ${key}`);
      }
    }
    const extra = schema["additionalProperties"];
    for (const [key, v] of Object.entries(obj)) {
      const sub = props[key];
      if (sub !== undefined) check(root, sub, v, path === "" ? key : `${path}.${key}`, out);
      else if (extra !== undefined && extra !== false && extra !== true) {
        check(root, extra as Schema, v, path === "" ? key : `${path}.${key}`, out);
      }
    }
  }
}

/** Validate against schema.json. Returns the violations (empty means it passed) */
export function validateBuilding(value: unknown, schema: Schema = loadSchema()): SchemaError[] {
  const out: SchemaError[] = [];
  check(schema, schema, value, "", out);
  return out;
}

// ---- CLI ----

if (process.argv[1]?.endsWith("validate.ts") === true) {
  const file = process.argv[2];
  if (file === undefined) {
    console.error("usage: tsx eval/control/validate.ts <building.json>");
    process.exit(2);
  }
  const errors = validateBuilding(JSON.parse(readFileSync(file, "utf8")));
  if (errors.length === 0) {
    console.log("schema: ok");
    process.exit(0);
  }
  for (const e of errors.slice(0, 40)) console.log(`${e.path}: ${e.message}`);
  if (errors.length > 40) console.log(`… and ${errors.length - 40} more`);
  process.exit(1);
}
