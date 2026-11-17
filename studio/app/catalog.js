import { esc } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { toConfig } from "./wedding.js";
import { demoPhotoUrls, applyDemoPhotos } from "./demo.js";

// Catálogo de estilos: lo comparten la portada del escaparate (index.html) y la página con
// todas las plantillas (plantillas.html).

async function getJson(url) {
  // Sin "no-store": la caché la marcan las cabeceras de vercel.json (corta y con revalidación).
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

// Los precios viven en la base de datos (tabla products). La página se pinta con los de
// studio.json y, si la API responde, se actualizan después (devuelve true si cambió algo).
// Nunca bloquea la portada ni deja el escaparate sin precios.
export async function applyLivePrices(studio) {
  try {
    const res = await fetch("/api/productos", { signal: AbortSignal.timeout?.(8000) });
    if (!res.ok) return false;
    const { products = [], pagos = false } = await res.json();
    let changed = false;
    for (const tier of studio.pricing?.tiers || []) {
      const p = products.find((x) => x.code === tier.id);
      if (!p) continue;
      const euros = p.price_cents / 100;
      tier.price = [euros, p.price_is_from ? null : euros];
      tier.checkout = Boolean(pagos && p.online_checkout); // se puede pagar al momento (Stripe)
      changed = true;
    }
    return changed;
  } catch { return false; /* sin API: precios de studio.json */ }
}

export const loadStudio = () => getJson("studio.json");

// Catálogo a partir de studio.json, sin pedir nada más: el config de ejemplo de cada plantilla
// (base de la demo y de cada web generada) se pide la primera vez que hace falta.
export function makeCatalog(studio) {
  const styles = studio.styles;
  const available = styles.filter((s) => s.status === "available");
  const urlOf = (style) => studio.templates[style.template].url;
  const templateIds = [...new Set(available.map((s) => s.template))];
  const demoPhotos = demoPhotoUrls(studio.demoPhotos);
  const bases = new Map();
  const baseFor = (id) => {
    if (!bases.has(id)) {
      const url = new URL("config.json", new URL(studio.templates[id].url, location.href));
      bases.set(id, getJson(url).then((base) => applyDemoPhotos(base, demoPhotos))
        .catch((e) => { bases.delete(id); throw e; })); // si falla, se reintenta la próxima vez
    }
    return bases.get(id);
  };
  const configFor = async (style, wedding) => toConfig(await baseFor(style.template), wedding, style);
  return { studio, styles, available, templateIds, demoPhotos, urlOf, configFor, withTheme: (style) => configFor(style, null) };
}

export async function loadCatalog() {
  return makeCatalog(await loadStudio());
}

// Pinta las tarjetas. `links` = true en la página de plantillas: los botones llevan a la portada,
// que es donde están el generador y la vista previa.
export function renderStyleCards(grid, { studio, styles, urlOf, withTheme }, { links = false } = {}) {
  const actions = (s) => links ? `
        <a class="btn btn--small" href="./?probar=${encodeURIComponent(s.id)}">Probar con vuestra boda</a>
        <a class="btn btn--small btn--ghost" href="./?ver=${encodeURIComponent(s.id)}">Ver en vivo</a>` : `
        <button class="btn btn--small" type="button" data-try="${esc(s.id)}">Probar con vuestra boda</button>
        <button class="btn btn--small btn--ghost" type="button" data-demo="${esc(s.id)}">Ver en vivo</button>`;
  grid.innerHTML = styles.map((s) => s.status === "available" ? `
    <article class="style-card">
      <div class="scaled" data-style="${esc(s.id)}">
        <iframe title="Ejemplo del estilo ${esc(s.name)}" tabindex="-1" aria-hidden="true"></iframe>
      </div>
      <div><h3>${esc(s.name)}</h3><p class="style-card__meta">Plantilla ${esc(studio.templates[s.template].name)}</p></div>
      <p class="style-card__desc">${esc(s.description)}</p>
      <div class="style-card__actions">${actions(s)}
      </div>
    </article>` : `
    <article class="style-card style-card--soon">
      <div class="soon-box">Próximamente</div>
      <div><h3>${esc(s.name)}</h3><p class="style-card__meta"><span class="tag">Nueva plantilla</span></p></div>
      <p class="style-card__desc">${esc(s.description)}</p>
    </article>`).join("");

  // Cada ejemplo es una web entera: se carga solo cuando la tarjeta está cerca y visible.
  const load = (box) => {
    if (box.dataset.loaded) return;
    box.dataset.loaded = "1";
    const style = styles.find((s) => s.id === box.dataset.style);
    withTheme(style)
      .then((config) => showInFrame(box.querySelector("iframe"), urlOf(style), config))
      .catch((e) => { delete box.dataset.loaded; console.error("[WeddingWebs] ejemplo", style.id, e); });
  };
  // En móvil, la web en su vista de móvil (390 px de ancho, casi a tamaño real y legible); en
  // pantallas grandes, la de escritorio. Si se cruza el límite, se cambia sin recargar.
  const boxes = [...grid.querySelectorAll(".scaled")];
  const small = matchMedia("(max-width: 600px)");
  const size = () => boxes.forEach((box) => {
    [box.dataset.baseWidth, box.dataset.baseHeight] = small.matches ? [390, 520] : [1280, 960];
    fitScaled(box);
  });
  size();
  small.addEventListener?.("change", size);
  if (!("IntersectionObserver" in window)) return boxes.forEach(load);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
  }, { rootMargin: "250px 0px" });
  boxes.forEach((b) => io.observe(b));
}

// En la portada solo caben dos filas; si hay más, el resto se ve en plantillas.html.
export function limitToTwoRows(grid, more) {
  const cards = [...grid.children];
  const fit = () => {
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const max = Math.max(cols * 2, 4);
    cards.forEach((c, i) => { c.hidden = i >= max; });
    more.hidden = cards.length <= max;
    more.querySelector("[data-count]").textContent = `Ver todas las plantillas (${cards.length})`;
  };
  fit();
  let width = grid.clientWidth;
  new ResizeObserver(() => { if (grid.clientWidth !== width) { width = grid.clientWidth; fit(); } }).observe(grid);
}
