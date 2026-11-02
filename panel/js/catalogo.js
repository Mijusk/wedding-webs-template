// Catálogo de plantillas y estilos: el mismo studio/studio.json del escaparate y el config de
// ejemplo de cada plantilla. Así el panel nunca se desincroniza del escaparate.
import { toConfig, utcOffset } from "/studio/app/wedding.js";

let studio = null;
const bases = new Map();

export async function catalog() {
  studio ||= await fetch("/studio/studio.json", { cache: "no-store" }).then((r) => r.json());
  return studio;
}

export const templateDir = (template) => (template === "clasica" ? "/" : `/plantillas/${template}/`);

export async function baseConfig(template) {
  if (!bases.has(template)) {
    bases.set(template, fetch(`${templateDir(template)}config.json`, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`No encuentro el config de ejemplo de la plantilla ${template}.`);
      return r.json();
    }));
  }
  return structuredClone(await bases.get(template));
}

export async function styles() {
  return (await catalog()).styles.filter((s) => s.status === "available");
}

export async function styleOf(config, template) {
  const all = await styles();
  return all.find((s) => s.template === template && s.theme === config?.theme) || all.find((s) => s.template === template);
}

export const templateName = async (template) => (await catalog()).templates[template]?.name || template;

// Nombres de las secciones para enseñarlas (los mismos que ve la pareja en el escaparate).
export async function sectionInfo() {
  const list = (await catalog()).sections?.list || {};
  return {
    hero: { name: "Portada", fixed: true }, closing: { name: "Cierre", fixed: true }, ...list,
  };
}

// Config nuevo para una boda: el de ejemplo de la plantilla con los datos de la pareja.
export async function newWeddingConfig(style, w) {
  const base = await baseConfig(style.template);
  return JSON.parse(JSON.stringify(toConfig(base, { photos: [], ...w }, style))); // sin campos vacíos
}

// Fotos que no son una URL (las de la prueba del escaparate no se guardan): las de ejemplo.
export async function withSamplePhotos(config, template) {
  const base = await baseConfig(template);
  const ok = (s) => typeof s === "string" && /^(https?:|\/|assets\/|\.\.?\/)/.test(s);
  const c = structuredClone(config);
  if (c.event && !ok(c.event.photo)) c.event.photo = base.event.photo;
  if (Array.isArray(c.gallery)) c.gallery = c.gallery.map((g, i) => (ok(g) ? g : base.gallery?.[i % (base.gallery?.length || 1)] || base.event.photo));
  c.story?.chapters?.forEach((ch, i) => { if ("photo" in ch && !ok(ch.photo)) ch.photo = base.story?.chapters?.[i]?.photo || base.event.photo; });
  return c;
}

export { toConfig, utcOffset };

// Pinta una plantilla en un iframe con su modo de vista previa (#preview): misma página que la
// web real, el config llega por postMessage. Devuelve una función para actualizarlo al momento.
export function livePreview(iframe, template) {
  let latest = null;
  let ready = false;
  const send = () => { if (ready && latest) iframe.contentWindow?.postMessage({ type: "wedding:config", config: latest }, location.origin); };
  const onMessage = (e) => {
    if (e.source === iframe.contentWindow && e.origin === location.origin && e.data?.type === "wedding:ready") { ready = true; send(); }
  };
  addEventListener("message", onMessage);
  const load = (tpl) => { ready = false; iframe.src = `${templateDir(tpl)}index.html#preview`; };
  load(template);
  return {
    update(config) { latest = config; send(); },
    setTemplate(tpl) { load(tpl); },
    destroy() { removeEventListener("message", onMessage); },
  };
}
