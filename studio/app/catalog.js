import { esc } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { toConfig } from "./wedding.js";
import { findDemoPhotos, applyDemoPhotos } from "./demo.js";

// Catálogo de estilos: lo comparten la portada del escaparate (index.html) y la página con
// todas las plantillas (plantillas.html).

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

// Los precios viven en la base de datos (tabla products). Si la API no responde a tiempo,
// el escaparate se queda con los de studio.json: nunca se queda sin precios.
async function applyLivePrices(studio) {
  try {
    const res = await fetch("/api/productos", { signal: AbortSignal.timeout?.(2500) });
    if (!res.ok) return;
    const { products = [] } = await res.json();
    for (const tier of studio.pricing?.tiers || []) {
      const p = products.find((x) => x.code === tier.id);
      if (!p) continue;
      const euros = p.price_cents / 100;
      tier.price = [euros, p.price_is_from ? null : euros];
    }
  } catch { /* sin API: precios de studio.json */ }
}

export async function loadCatalog() {
  const studio = await getJson("studio.json");
  await applyLivePrices(studio);
  const styles = studio.styles;
  const available = styles.filter((s) => s.status === "available");
  const urlOf = (style) => studio.templates[style.template].url;
  // Cada plantilla trae su config de ejemplo: sirve de demo y de base para cada web generada.
  const templateIds = [...new Set(available.map((s) => s.template))];
  const bases = Object.fromEntries(await Promise.all(templateIds.map(async (id) =>
    [id, await getJson(new URL("config.json", new URL(studio.templates[id].url, location.href)))])));
  const demoPhotos = await findDemoPhotos(studio.demoPhotos);
  Object.values(bases).forEach((base) => applyDemoPhotos(base, demoPhotos));
  const configFor = (style, wedding) => toConfig(bases[style.template], wedding, style);
  return { studio, styles, available, templateIds, demoPhotos, urlOf, configFor, withTheme: (style) => configFor(style, null) };
}

// Pinta las tarjetas. `links` = true en la página de plantillas: los botones llevan a la portada,
// que es donde están el generador y la vista previa.
export function renderStyleCards(grid, { studio, styles, urlOf, withTheme }, { links = false } = {}) {
  const actions = (s) => links ? `
        <a class="btn btn--small" href="./?probar=${encodeURIComponent(s.id)}">Probar con vuestra boda</a>
        <a class="btn btn--small btn--ghost" href="./?ver=${encodeURIComponent(s.id)}">Ver ejemplo</a>` : `
        <button class="btn btn--small" type="button" data-try="${esc(s.id)}">Probar con vuestra boda</button>
        <button class="btn btn--small btn--ghost" type="button" data-demo="${esc(s.id)}">Ver ejemplo</button>`;
  grid.innerHTML = styles.map((s) => s.status === "available" ? `
    <article class="style-card">
      <div class="scaled" data-base-width="1280" data-base-height="960" data-style="${esc(s.id)}">
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
    showInFrame(box.querySelector("iframe"), urlOf(style), withTheme(style));
  };
  const boxes = [...grid.querySelectorAll(".scaled")];
  boxes.forEach(fitScaled);
  if (!("IntersectionObserver" in window)) return boxes.forEach(load);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
  }, { rootMargin: "400px 0px" });
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
