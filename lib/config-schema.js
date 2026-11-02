// Validador de JSON Schema (el subconjunto que usa schema/wedding-config.schema.json), sin dependencias.
// Funciona igual en Node (scripts, API) y en el navegador (panel).
//
//   import { validate } from "/lib/config-schema.js";
//   const errors = validate(schema, config);   // [] si está bien; si no, [{ path, message }]

const TYPES = {
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: Number.isInteger,
  boolean: (v) => typeof v === "boolean",
  null: (v) => v === null,
};

const TYPE_NAMES = { object: "un objeto", array: "una lista", string: "un texto", number: "un número", integer: "un número entero", boolean: "sí o no", null: "vacío" };

export function validate(schema, value, path = "", errors = []) {
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => TYPES[t]?.(value))) {
      errors.push({ path, message: `debería ser ${types.map((t) => TYPE_NAMES[t] || t).join(" o ")}` });
      return errors;
    }
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    errors.push({ path, message: `no es un valor permitido (${schema.enum.join(", ")})` });
  }
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) errors.push({ path, message: schema.minLength === 1 ? "no puede estar vacío" : `necesita al menos ${schema.minLength} caracteres` });
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push({ path, message: `tiene más de ${schema.maxLength} caracteres` });
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errors.push({ path, message: "no tiene el formato esperado" });
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) errors.push({ path, message: `debería ser ${schema.minimum} o más` });
    if (schema.maximum != null && value > schema.maximum) errors.push({ path, message: `debería ser ${schema.maximum} o menos` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push({ path, message: `necesita al menos ${schema.minItems} elemento(s)` });
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push({ path, message: `tiene más de ${schema.maxItems} elementos` });
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((v, i) => {
        const k = JSON.stringify(v);
        if (seen.has(k)) errors.push({ path: `${path}[${i}]`, message: "está repetido" });
        seen.add(k);
      });
    }
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (TYPES.object(value)) {
    for (const key of schema.required || []) {
      if (value[key] === undefined) errors.push({ path: join(path, key), message: "falta" });
    }
    const props = schema.properties || {};
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue; // como en JSON: un campo sin valor es un campo que no está
      if (props[key]) validate(props[key], v, join(path, key), errors);
      else if (schema.additionalProperties === false) errors.push({ path: join(path, key), message: "campo desconocido" });
      else if (typeof schema.additionalProperties === "object") validate(schema.additionalProperties, v, join(path, key), errors);
    }
  }
  return errors;
}

const join = (path, key) => (path ? `${path}.${key}` : key);

// Texto corto para enseñar a Luis: "event.date: no tiene el formato esperado".
export const describe = (errors) => errors.map((e) => `${e.path || "(config)"}: ${e.message}`).join("\n");
