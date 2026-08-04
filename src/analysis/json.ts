export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export class JsonBoundaryError extends TypeError {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "JsonBoundaryError";
    this.path = path;
  }
}

/** True only for finite JSON primitives, arrays, and plain string-keyed objects without cycles. */
export function isJsonValue(value: unknown): value is JsonValue {
  try {
    assertJsonValue(value);
    return true;
  } catch {
    return false;
  }
}

export function assertJsonValue(value: unknown, path = "$", ancestors = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new JsonBoundaryError(path, "number must be finite");
    return;
  }
  if (typeof value !== "object") {
    throw new JsonBoundaryError(path, `${typeof value} is not a JSON value`);
  }
  if (ancestors.has(value)) throw new JsonBoundaryError(path, "cyclic value is not JSON");

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new JsonBoundaryError(path, "object must have Object.prototype or a null prototype");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
          throw new JsonBoundaryError(path, "array has a non-index own property");
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!("value" in descriptor) || !descriptor.enumerable) {
          throw new JsonBoundaryError(`${path}[${key}]`, "array entries must be enumerable data properties");
        }
      }
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) throw new JsonBoundaryError(`${path}[${index}]`, "sparse arrays are not JSON values");
        assertJsonValue(value[index], `${path}[${index}]`, ancestors);
      }
      return;
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new JsonBoundaryError(path, "symbol keys are not JSON object keys");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable) {
        throw new JsonBoundaryError(`${path}.${key}`, "object members must be enumerable data properties");
      }
      assertJsonValue(descriptor.value, `${path}.${key}`, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Clones a JSON boundary value deterministically. Non-index keys use Unicode code-point order;
 * ECMAScript integer-index keys retain the language's mandatory numeric enumeration order.
 */
export function canonicalJsonValue(value: unknown): JsonValue {
  assertJsonValue(value);
  return canonical(value);
}

function canonical(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return typeof value === "number" && Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);

  const record = value as { readonly [key: string]: JsonValue };
  const out: Record<string, JsonValue> = {};
  for (const key of Object.keys(record).sort(codePointCompare)) {
    Object.defineProperty(out, key, {
      value: canonical(record[key]!),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return out;
}

export function codePointCompare(a: string, b: string): number {
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  while (true) {
    const x = left.next();
    const y = right.next();
    if (x.done || y.done) return x.done === y.done ? 0 : x.done ? -1 : 1;
    const xPoint = x.value.codePointAt(0)!;
    const yPoint = y.value.codePointAt(0)!;
    if (xPoint !== yPoint) return xPoint < yPoint ? -1 : 1;
  }
}
