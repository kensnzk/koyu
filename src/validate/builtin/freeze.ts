/** Deep-freeze trusted built-in component values before they cross the public boundary. */
export function freezeBuiltin<T>(value: T): T {
  const seen = new Set<object>();

  const visit = (candidate: unknown): void => {
    if ((typeof candidate !== "object" && typeof candidate !== "function") || candidate === null) return;
    const object = candidate as object;
    if (seen.has(object)) return;
    seen.add(object);
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor && "value" in descriptor) visit(descriptor.value);
    }
    Object.freeze(object);
  };

  visit(value);
  return value;
}
