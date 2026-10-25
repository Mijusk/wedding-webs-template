#!/usr/bin/env node
// Pasa a la base de datos una boda que vive en una rama de git o en una carpeta (el sistema de antes).
// Sube sus fotos al almacenamiento, cambia las rutas por las URLs nuevas y crea la fila en "weddings".
//
//   node scripts/importar-boda.mjs --rama boda-lucia-martin [--slug lucia-y-martin] [--publicar]
//   node scripts/importar-boda.mjs --carpeta plantillas/editorial --slug lucia-y-martin [--publicar]
//   node scripts/importar-boda.mjs ... --prueba     (enseña lo que haría, sin tocar nada)
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env.local o en el entorno).
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, relative, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { validate, describe } from "../lib/config-schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "wedding-assets";
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(`--${name}`);
const dry = flag("prueba");

for (const f of [".env.local", ".env"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const URL_ = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!dry && (!URL_ || !KEY)) die("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ponlas en .env.local).");

const headers = (extra = {}) => ({ apikey: KEY, ...(KEY.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {}), ...extra });
async function api(path, init = {}) {
  const res = await fetch(`${URL_}${path}`, { ...init, headers: headers({ "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }
const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim();

// ── Dónde está la boda ──
let worktree = null;
let folder;
if (arg("rama")) {
  const branch = arg("rama");
  try { git("rev-parse", "--verify", `${branch}^{commit}`); }
  catch { try { git("fetch", "--depth=1", "origin", `${branch}:${branch}`); } catch { die(`No encuentro la rama ${branch}.`); } }
  worktree = mkdtempSync(join(tmpdir(), "boda-"));
  git("worktree", "add", "--detach", worktree, branch);
  // La boda es el config.json que cambia respecto a main.
  const changed = git("diff", "--name-only", `main...${branch}`).split("\n").filter((f) => /(^|\/)config\.json$/.test(f) && !f.startsWith("studio/"));
  if (!changed.length) cleanup(), die(`En la rama ${branch} no ha cambiado ningún config.json respecto a main.`);
  if (changed.length > 1 && !arg("carpeta")) cleanup(), die(`En la rama hay varias webs cambiadas (${changed.join(", ")}). Elige una con --carpeta.`);
  folder = join(worktree, arg("carpeta") || dirname(changed[0]));
} else if (arg("carpeta")) {
  folder = resolve(ROOT, arg("carpeta"));
} else {
  die("Indica --rama <nombre> o --carpeta <ruta>. Ver la cabecera de este archivo.");
}

function cleanup() {
  if (worktree) { try { git("worktree", "remove", "--force", worktree); } catch { rmSync(worktree, { recursive: true, force: true }); } }
}

try {
  const base = worktree || ROOT;
  const rel = relative(base, folder).replace(/\\/g, "/");
  const template = rel === "" ? "clasica" : /^plantillas\/[a-z0-9-]+$/.test(rel) ? rel.split("/")[1] : null;
  if (!template) die(`${rel} no es la carpeta de una plantilla (la raíz o plantillas/<nombre>).`);
  const cfgPath = join(folder, "config.json");
  if (!existsSync(cfgPath)) die(`No hay config.json en ${rel || "la raíz"}.`);
  const config = JSON.parse(readFileSync(cfgPath, "utf8"));
  const [a = "", b = ""] = config.event?.couple || [];
  const slug = (arg("slug") || `${a}-y-${b}`).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Fotos locales que usa el config (rutas relativas a la carpeta de la web).
  const local = (s) => typeof s === "string" && !/^(https?:|data:|\/)/.test(s) && existsSync(join(folder, s));
  const refs = new Set([config.event?.photo, ...(config.gallery || []), ...(config.story?.chapters || []).map((c) => c.photo)].filter(local));
  const share = ["compartir.jpg", "icono.png"].filter((f) => existsSync(join(folder, f)));

  // El RSVP iba a una hoja de Google: ahora va a nuestra base; la hoja se mantiene como copia.
  const sheet = /^https:\/\/script\.google\.com\//.test(config.rsvp?.endpoint || "") ? config.rsvp.endpoint : null;
  if (config.rsvp) config.rsvp.endpoint = "";

  console.log(`Boda: ${a} y ${b} · plantilla ${template} · /b/${slug}`);
  console.log(`Fotos a subir: ${refs.size}${share.length ? ` + ${share.join(", ")}` : ""}${sheet ? " · las respuestas seguirán copiándose a su hoja de Google" : ""}`);
  if (dry) { console.log("(prueba: no se ha tocado nada)"); cleanup(); process.exit(0); }

  const [exists] = await api(`/rest/v1/weddings?slug=eq.${slug}&select=id`);
  if (exists) die(`Ya hay una boda con la dirección /b/${slug}. Usa --slug para elegir otra.`);

  const [w] = await api("/rest/v1/weddings", { method: "POST", body: JSON.stringify({ slug, template, config, rsvp_sheet_endpoint: sheet, notes: `Importada de ${arg("rama") ? `la rama ${arg("rama")}` : rel || "la raíz"}` }) });
  const urls = new Map();
  let sort = 0;
  const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  for (const ref of [...refs, ...share]) {
    const bytes = readFileSync(join(folder, ref));
    const ext = extname(ref).toLowerCase();
    const path = `weddings/${w.id}/${share.includes(ref) ? ref.replace(/\.\w+$/, "") + "-" : ""}${randomUUID()}${ext}`;
    const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: headers({ "Content-Type": MIME[ext] || "application/octet-stream" }), body: bytes });
    if (!res.ok) throw new Error(`No se pudo subir ${ref}: ${res.status} ${await res.text()}`);
    const url = `${URL_}/storage/v1/object/public/${BUCKET}/${path}`;
    urls.set(ref, url);
    await api("/rest/v1/wedding_assets", { method: "POST", body: JSON.stringify({
      wedding_id: w.id, bucket: BUCKET, path, url, bytes: bytes.length, mime: MIME[ext], original_name: ref,
      kind: ref === "compartir.jpg" ? "compartir" : ref === "icono.png" ? "icono" : "foto", sort: sort++,
    }) });
    console.log(`  ↑ ${ref}`);
  }
  const swap = (s) => urls.get(s) || s;
  config.event.photo = swap(config.event.photo);
  if (config.gallery) config.gallery = config.gallery.map(swap);
  config.story?.chapters?.forEach((c) => { if (c.photo) c.photo = swap(c.photo); });
  if (urls.has("compartir.jpg") || urls.has("icono.png")) {
    config.share = { ...(urls.has("compartir.jpg") ? { image: urls.get("compartir.jpg") } : {}), ...(urls.has("icono.png") ? { icon: urls.get("icono.png") } : {}) };
  }
  const schema = JSON.parse(readFileSync(join(ROOT, "schema/wedding-config.schema.json"), "utf8"));
  const errors = validate(schema, config);
  if (errors.length) console.warn(`⚠ El config tiene avisos (revísalos en el panel):\n${describe(errors)}`);
  await api(`/rest/v1/weddings?id=eq.${w.id}`, { method: "PATCH", body: JSON.stringify({ config }) });
  if (flag("publicar")) {
    await api("/rest/v1/rpc/publish_wedding", { method: "POST", body: JSON.stringify({ p_wedding_id: w.id, p_note: "Importada" }) });
    console.log(`✓ Importada y publicada: /b/${slug}`);
  } else {
    console.log(`✓ Importada como borrador. Revísala en el panel (#/bodas/${w.id}) y publícala.`);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
