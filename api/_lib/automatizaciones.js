// Automatizaciones: manda los emails que tocan (lo decide la base de datos: app.automation_items) y
// hace las tareas y la retención (api_automation_sweep). Lo llaman el aviso diario (api/cron.js),
// el escaparate al llegar un lead (api/lead.js) y el panel al publicar una web (api/pedido.js).
//
// Cada envío se «reserva» antes de mandarlo: si dos avisos llegan a la vez, solo uno lo manda.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { rpc, config } from "./supabase.js";
import { sendEmail } from "./avisos.js";
import { renderTemplate } from "../../lib/email.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_PER_RUN = 150; // lo que no dé tiempo, al día siguiente (sigue dentro de su plazo)

// Nombres de los estilos del escaparate (studio.json). Si no se puede leer: el id con mayúscula.
let styles = null;
async function styleName(id) {
  if (!id) return "";
  if (!styles) {
    try {
      const studio = JSON.parse(await readFile(join(ROOT, "studio/studio.json"), "utf8"));
      styles = Object.fromEntries(studio.styles.map((s) => [s.id, s.name]));
    } catch { styles = {}; }
  }
  return styles[id] || id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ");
}

// ── Baja de los emails comerciales ──────────────────────────

const b64 = (s) => Buffer.from(s).toString("base64url");
function signKey() {
  return createHash("sha256").update(`baja:${process.env.UNSUBSCRIBE_SECRET || config().serviceKey}`).digest();
}
const sign = (email) => createHmac("sha256", signKey()).update(email.toLowerCase()).digest("base64url").slice(0, 22);

export function unsubscribeUrl(site, email) {
  return `${site}/api/lead?baja=${b64(email.toLowerCase())}&t=${sign(email)}`;
}

// Devuelve el email si el enlace es auténtico; si no, null.
export function unsubscribeEmail(b, t) {
  let email;
  try { email = Buffer.from(String(b || ""), "base64url").toString("utf8"); } catch { return null; }
  if (!/^\S+@\S+\.\S+$/.test(email)) return null;
  const expected = Buffer.from(sign(email));
  const got = Buffer.from(String(t || ""));
  return got.length === expected.length && timingSafeEqual(got, expected) ? email : null;
}

// ── Enviar ───────────────────────────────────────────────────

const pretty = (c) => (c?.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || "");

function linkFor(item, site) {
  const l = item.link || {};
  switch (l.type) {
    case "prueba": return `${site}/studio/?prueba=${encodeURIComponent(l.token)}`;
    case "seguimiento": return `${site}/seguimiento/${pretty(l.code)}`;
    case "web": return `${site}/b/${l.slug}`;
    case "invitacion": return `${site}/b/${l.slug}?i=${encodeURIComponent(l.token)}`;
    case "panel": return `${site}/pareja/`;
    default: return null;
  }
}

async function varsFor(item, site, link) {
  const v = { ...(item.vars || {}) };
  if (v.estilo !== undefined) v.estilo = await styleName(v.estilo);
  v.enlace = link || "";
  if (item.link?.slug) v.enlace_web = `${site}/b/${item.link.slug}`;
  v.enlace_panel = `${site}/pareja/`;
  if (v.resenas) {
    v.enlaces_resena = [v.resenas.google && `Google: ${v.resenas.google}`, v.resenas.bodas_net && `Bodas.net: ${v.resenas.bodas_net}`]
      .filter(Boolean).join("\n");
    delete v.resenas;
  }
  return v;
}

const refs = (item) => ({
  automation_id: item.automation_id, key: item.key, email: item.email, lead_id: item.lead_id || null,
  client_id: item.client_id || null, wedding_id: item.wedding_id || null, order_id: item.order_id || null,
});

export async function sendItem(item, site) {
  if (!(await rpc("api_automation_claim", { p_automation_id: item.automation_id, p_key: item.key }))) return "repetido";
  let status = "fallido", detail = null;
  try {
    const link = linkFor(item, site);
    const unsubscribe = item.commercial ? unsubscribeUrl(site, item.email) : null;
    const mail = renderTemplate(item, await varsFor(item, site, link), { link, unsubscribe });
    const r = await sendEmail({
      to: item.email, template: item.code, leadId: item.lead_id, clientId: item.client_id, weddingId: item.wedding_id,
      replyTo: item.reply_to || undefined, meta: { automatizacion: item.code },
      headers: unsubscribe ? { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
      ...mail,
    });
    status = r.status;
    detail = r.error || null;
  } catch (e) {
    detail = e.message;
  }
  await rpc("api_automation_done", { p_run: { ...refs(item), status, detail } }).catch((e) => console.error("automatización", e.message));
  return status;
}

async function sendAll(items, site) {
  const count = { enviados: 0, simulados: 0, fallidos: 0, repetidos: 0, pendientes: Math.max(items.length - MAX_PER_RUN, 0) };
  for (const item of items.slice(0, MAX_PER_RUN)) {
    const s = await sendItem(item, site);
    if (s === "enviado") count.enviados++;
    else if (s === "simulado") count.simulados++;
    else if (s === "repetido") count.repetidos++;
    else count.fallidos++;
  }
  return count;
}

// Todo lo que toca hoy: emails, tareas y retención.
export async function runDue(site) {
  const emails = await sendAll(await rpc("api_automation_due"), site);
  const sweep = await rpc("api_automation_sweep");
  return { emails, ...sweep };
}

// Lo que toca a un lead o una boda concretos ahora mismo (si la automatización está activa).
export async function runEvent(code, id, site) {
  try {
    return await sendAll(await rpc("api_automation_event", { p_code: code, p_id: id }), site);
  } catch (e) {
    console.error("automatización", code, e.message);
    return null; // nunca rompe lo que la ha llamado; el aviso diario lo reintenta
  }
}
