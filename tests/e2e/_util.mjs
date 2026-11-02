// Utilidades de las pruebas de extremo a extremo (navegador real con Playwright).
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const SITE = process.env.SITE || "http://localhost:3000";

// Variables de .env.local (las mismas que usa el servidor local).
export function env() {
  const out = { ...process.env };
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return out;
}

// Playwright del proyecto o, si no está instalado aquí, el global.
export async function playwright() {
  try { return await import("playwright"); } catch { /* sigue */ }
  const root = execSync("npm root -g").toString().trim();
  return import(pathToFileURL(join(root, "playwright/index.mjs")).href);
}

// Un paquete del proyecto o, si no está, el instalado globalmente (p. ej. sharp para comparar capturas).
export function optionalModule(name) {
  try { return createRequire(import.meta.url)(name); } catch { /* sigue */ }
  try { return createRequire(execSync("npm root -g").toString().trim() + "/")(name); } catch { return null; }
}

// Llamadas a Supabase con la clave secreta (solo para preparar y limpiar datos de prueba).
export function supabase() {
  const e = env();
  const url = e.SUPABASE_URL.replace(/\/+$/, "");
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=representation" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const call = async (path, init = {}) => {
    const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
    return data;
  };
  return {
    rpc: (name, args) => call(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args || {}) }),
    select: (q) => call(`/rest/v1/${q}`),
    insert: (table, rows) => call(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify(rows) }),
    update: (q, patch) => call(`/rest/v1/${q}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: (q) => call(`/rest/v1/${q}`, { method: "DELETE" }),
  };
}
