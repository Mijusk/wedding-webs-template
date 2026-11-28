import { esc } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { toConfig, withDefaults } from "./wedding.js";
import { demoPhotoUrls, applyDemoPhotos } from "./demo.js";
import { setupFilters, phraseOf, replayIn } from "./filters.js";

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
  // wedding.partial: solo algunos datos suyos (de primeras, los nombres); el resto, del ejemplo
  // de cada plantilla, así cada estilo se ve entero con su propia fecha y lugar de ejemplo.
  const configFor = async (style, wedding) => {
    const base = await baseFor(style.template);
    return toConfig(base, wedding?.partial ? withDefaults(base, wedding) : wedding, style);
  };
  // Vista previa en vivo con lo que lleven escrito: lo que falta sale del ejemplo de la plantilla.
  const previewFor = async (style, partial) => {
    const base = await baseFor(style.template);
    return toConfig(base, withDefaults(base, partial), style);
  };
  return { studio, styles, available, templateIds, demoPhotos, urlOf, configFor, previewFor, withTheme: (style) => configFor(style, null) };
}

export async function loadCatalog() {
  return makeCatalog(await loadStudio());
}

// Qué tarjetas se ven: las del tipo elegido en los filtros y, en la portada, solo las que caben
// en dos filas (limitToTwoRows). after(n): avisos con cuántas son del tipo elegido.
const views = new WeakMap();
const viewOf = (grid) => {
  if (!views.has(grid)) views.set(grid, { match: () => true, max: Infinity, after: [], hide: () => {} });
  return views.get(grid);
};
function refresh(grid) {
  const v = viewOf(grid);
  let n = 0;
  for (const card of grid.children) {
    const ok = v.match(card.dataset.id);
    if (ok) n++;
    const hidden = !ok || n > v.max;
    if (hidden && !card.hidden) v.hide(card);
    card.hidden = hidden;
  }
  v.after.forEach((f) => f(n));
}

// Pinta las tarjetas. `links` = true en la página de plantillas: los botones llevan a la portada,
// que es donde están el generador y la vista previa.
// Si la cuadrícula tiene data-filters (el id de un contenedor vacío), encima van los botones
// para filtrar por tipo. En la página de plantillas, el tipo va en la dirección (?tipo=florales).
export function renderStyleCards(grid, { studio, styles, urlOf, withTheme }, { links = false } = {}) {
  const actions = (s) => links ? `
        <a class="btn btn--small" href="./?probar=${encodeURIComponent(s.id)}">Probar con vuestra boda</a>
        <a class="btn btn--small btn--ghost" href="./?ver=${encodeURIComponent(s.id)}">Ver en vivo</a>` : `
        <button class="btn btn--small" type="button" data-try="${esc(s.id)}">Probar con vuestra boda</button>
        <button class="btn btn--small btn--ghost" type="button" data-demo="${esc(s.id)}">Ver en vivo</button>`;
  grid.innerHTML = styles.map((s) => s.status === "available" ? `
    <article class="style-card" data-id="${esc(s.id)}">
      <div class="scaled" data-style="${esc(s.id)}">
        <iframe title="Ejemplo del estilo ${esc(s.name)}" tabindex="-1" aria-hidden="true"></iframe>
      </div>
      <div><h3>${esc(s.name)}</h3><p class="style-card__meta">Plantilla ${esc(studio.templates[s.template].name)}</p></div>
      <p class="style-card__desc">${esc(s.description)}</p>
      <div class="style-card__actions">${actions(s)}
      </div>
    </article>` : `
    <article class="style-card style-card--soon" data-id="${esc(s.id)}">
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
  filtersFor(grid, studio, styles, links);
  if (!("IntersectionObserver" in window)) return boxes.forEach(load);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
  }, { rootMargin: "250px 60%" }); // también la siguiente de la fila que se desliza (móvil)
  boxes.forEach((b) => io.observe(b));
  // Las que se esconden al filtrar se descargan (no se acumulan webs abiertas en el móvil) y se
  // vuelven a cargar si se enseñan otra vez.
  viewOf(grid).hide = (card) => {
    const box = card.querySelector(".scaled");
    const frame = box?.querySelector("iframe");
    if (!frame?.dataset.ready) return;
    frame.dataset.src = "";
    frame.dataset.ready = "";
    frame.removeAttribute("src");
    delete box.dataset.loaded;
    io.observe(box);
  };
}

function filtersFor(grid, studio, styles, links) {
  const el = grid.dataset.filters && document.getElementById(grid.dataset.filters);
  if (!el) return;
  const params = new URLSearchParams(location.search);
  const filters = setupFilters(el, {
    studio, styles: styles.filter((s) => s.status === "available"),
    initial: links ? params.get("tipo") || "" : "",
    desde: links ? "plantillas" : "portada",
    onChange: (tipo) => {
      if (links) {
        tipo ? params.set("tipo", tipo) : params.delete("tipo");
        const q = params.toString();
        history.replaceState(history.state, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
      }
      refresh(grid);
      replayIn([...grid.children].filter((c) => !c.hidden));
      // Desde el principio: en el móvil, la fila de la portada vuelve a la primera; en la página
      // de plantillas, si ya habían bajado, arriba de la cuadrícula.
      grid.scrollLeft = 0;
      const bar = el.closest(".filters-bar") || el;
      const top = grid.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - parseFloat(getComputedStyle(bar).marginBottom);
      if (top < -1) scrollBy({ top, behavior: "instant" });
    },
  });
  const v = viewOf(grid);
  v.match = filters.matches;
  v.filters = filters;
  refresh(grid);
}

// En la portada solo caben dos filas; si hay más, el resto se ve en plantillas.html. En el
// móvil van en una fila que se desliza de lado (studio.css): ocho, para ver unos cuantos de un
// vistazo sin cargar decenas de webs a la vez.
// Con un tipo elegido en los filtros, son las primeras de ese tipo y el enlace lleva a todas las
// de ese tipo.
export function limitToTwoRows(grid, more) {
  const v = viewOf(grid);
  const phone = matchMedia("(max-width: 600px)");
  const link = more.querySelector("[data-count]");
  v.after.push((n) => {
    const cat = v.filters?.category;
    more.hidden = n <= v.max;
    link.textContent = cat ? `Ver ${phraseOf(cat, n)}` : `Ver todas las plantillas (${n})`;
    link.href = cat ? `plantillas.html?tipo=${encodeURIComponent(cat.id)}` : "plantillas.html";
  });
  const fit = () => {
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    v.max = phone.matches ? 8 : Math.max(cols * 2, 4);
    refresh(grid);
  };
  fit();
  let width = grid.clientWidth;
  new ResizeObserver(() => { if (grid.clientWidth !== width) { width = grid.clientWidth; fit(); } }).observe(grid);
}
