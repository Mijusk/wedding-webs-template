// Pinta la web de una boda: toma el index.html de su plantilla (tal cual, sin tocar su diseño),
// le pone <base> para que sus CSS/JS/fuentes carguen desde la carpeta de la plantilla, mete el
// config de la boda en la página y cambia las etiquetas para WhatsApp por las de esta pareja.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { esc, jsonForHtml } from "./http.js";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// Carpeta de cada plantilla. "clasica" es la de la raíz del repositorio.
export const templateDir = (template) => (template === "clasica" ? "" : `plantillas/${template}/`);

// Las plantillas que hay (las mismas que studio/studio.json > templates).
export const TEMPLATES = ["clasica", "editorial", "minimal", "verbena", "postal", "villa", "etiqueta", "lacre", "acuarela",
  "monograma", "negro", "toile", "palacio", "jardin", "lino", "azulejo", "carrete", "carta", "vegetal", "capilla", "botanica",
  "costa", "estrellas", "galeria", "ciudades"];

export const templateExists = (template) =>
  TEMPLATES.includes(template) || (/^[a-z0-9-]+$/.test(template || "") && existsSync(join(ROOT, templateDir(template), "index.html")));

const cache = new Map();
// Del disco (vercel.json incluye los index.html en la función). Si no estuviera, se pide a la propia web.
async function readTemplate(template, origin) {
  if (!cache.has(template)) {
    let html;
    try {
      html = await readFile(join(ROOT, templateDir(template), "index.html"), "utf8");
    } catch {
      // En las vistas previas de Vercel protegidas, la clave de "Protection Bypass for Automation" deja pasar.
      const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      const res = await fetch(`${origin}/${templateDir(template)}index.html`, {
        headers: bypass ? { "x-vercel-protection-bypass": bypass } : {}, signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`No se pudo leer la plantilla ${template}`);
      html = await res.text();
    }
    cache.set(template, html);
  }
  return cache.get(template);
}

const LONG_DATE = (iso, locale = "es-ES") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

const absolute = (url, base) => {
  try { return new URL(url, base).href; } catch { return ""; }
};

// Etiquetas de cabecera para esta boda (lo que antes escribía herramientas/compartir.html).
export function shareTags(config, { pageUrl, templateBase }) {
  const [a = "", b = ""] = config.event?.couple || [];
  const names = `${a} y ${b}`;
  const place = config.venue?.city || config.venue?.name || "";
  const desc = [LONG_DATE(config.event?.date, config.locale), place].filter(Boolean).join(" · ")
    + ". Toda la información y la confirmación de asistencia.";
  const image = config.share?.image || absolute(config.event?.photo || "", templateBase);
  const icon = config.share?.icon || "";
  return [
    `<title>${esc(names)}</title>`,
    `<meta name="robots" content="noindex, nofollow">`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="${esc((config.locale || "es-ES").replace("-", "_"))}">`,
    `<meta property="og:title" content="${esc(`${names} se casan`)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    config.share?.image ? `<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">` : "",
    image ? `<meta property="og:image:alt" content="${esc(names)}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    icon ? `<link rel="icon" href="${esc(icon)}">\n<link rel="apple-touch-icon" href="${esc(icon)}">` : "",
  ].filter(Boolean).join("\n");
}

const PREVIEW_BADGE = `<div role="note" style="position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;
  font:600 12px/1.2 system-ui,-apple-system,sans-serif;letter-spacing:.02em;background:rgba(20,20,20,.82);color:#fff;
  padding:7px 12px;border-radius:999px;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.2)">Vista previa · aún no es la web publicada</div>`;

export async function renderWedding(data, { origin, pageUrl }) {
  const template = data.template;
  if (!templateExists(template)) throw new Error(`Plantilla desconocida: ${template}`);
  const dir = templateDir(template);
  const templateBase = `${origin}/${dir}`;
  const config = structuredClone(data.config);

  // El RSVP de esta boda se guarda en nuestra base de datos. En la vista previa se simula
  // (así las pruebas de la pareja o de Luis no ensucian la lista de invitados).
  config.rsvp = { ...(config.rsvp || {}), endpoint: data.draft ? "" : `/api/rsvp?w=${encodeURIComponent(data.slug)}` };
  // RSVP ampliado si el plan de la boda lo incluye: lo pinta /lib/rsvp-ampliado.js con el estilo de la plantilla.
  if (data.features?.rsvp_ampliado) {
    config.rsvp.extended = {
      invite: data.invite || null,
      inviteInvalid: Boolean(data.invite_invalid),
      bus: config.rsvp.bus === true,
      dietary: config.rsvp.dietary !== false,
    };
  }

  let html = await readTemplate(template, origin);
  html = html.replace(/<head>/i, `<head>\n<base href="/${dir}">`);
  const block = /<!-- compartir:start[\s\S]*?<!-- compartir:end -->/;
  // El color de la barra del navegador en el móvil es de la plantilla: se conserva.
  const themeColor = (html.match(block)?.[0] || "").match(/<meta name="theme-color"[^>]*>/)?.[0] || "";
  const tags = [shareTags(config, { pageUrl, templateBase }), themeColor].filter(Boolean).join("\n");
  html = block.test(html)
    ? html.replace(block, () => `<!-- compartir:start · generado por el servidor -->\n${tags}\n<!-- compartir:end -->`)
    : html.replace(/<\/head>/i, () => `${tags}\n</head>`);
  html = html.replace(/<\/head>/i, () =>
    `<script type="application/json" id="wedding-config">${jsonForHtml(config)}</script>\n</head>`);
  if (data.draft) html = html.replace(/<\/body>/i, () => `${PREVIEW_BADGE}\n</body>`);
  return html;
}

// Página de "no encontrada" o "ya no disponible", con el diseño de 404.html.
const FALLBACK_404 = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>No encontramos esta página</title></head>
<body style="font:17px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">
<main><h1>No encontramos esta página</h1><p class="lead">Revisa el enlace que te enviaron.</p></main></body></html>`;

export async function renderNotFound({ title, text } = {}) {
  let html = await readFile(join(ROOT, "404.html"), "utf8").catch(() => FALLBACK_404);
  if (title) html = html.replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${esc(title)}</h1>`);
  if (text) html = html.replace(/<p class="lead">[\s\S]*?<\/p>/, () => `<p class="lead">${esc(text)}</p>`);
  return html;
}
