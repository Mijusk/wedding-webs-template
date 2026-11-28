import { esc } from "./util.js";
import { track } from "./analytics.js";

// Botones para filtrar los estilos por tipo (studio.json > categories): «Con movimiento»,
// «Florales», «De noche»… Los usan la portada y «Todas las plantillas» (app/catalog.js) y la
// cuadrícula de «Probar» (app/picker.js). Se elige uno cada vez; tocar otra vez el elegido
// vuelve a «Todos». Un estilo puede estar en varios tipos.

// Los tipos que tienen algún estilo de `styles`, con cuántos tiene cada uno.
export function categoriesOf(studio, styles) {
  const ids = new Set(styles.map((s) => s.id));
  return (studio.categories || [])
    .map((c) => ({ id: c.id, name: c.name, set: new Set(c.styles.filter((id) => ids.has(id))) }))
    .filter((c) => c.set.size);
}

// Frase para un enlace: «los 9 estilos de noche», «los 7 estilos florales».
export const phraseOf = (cat, n) => `los ${n} estilos ${cat.name.toLowerCase()}`;

// el: el contenedor vacío de los botones. onChange(tipo, cat) al cambiar (tipo "" = todos).
// desde: para la analítica (portada, plantillas, probar).
export function setupFilters(el, { studio, styles, initial = "", desde, onChange }) {
  const cats = categoriesOf(studio, styles);
  let value = cats.some((c) => c.id === initial) ? initial : "";
  const api = {
    get value() { return value; },
    get category() { return cats.find((c) => c.id === value) || null; },
    matches: (id) => !value || api.category.set.has(id),
    select,
  };
  if (!el || !cats.length) { if (el) el.hidden = true; return api; }

  const chip = (id, name, n) => `<button class="chip" type="button" data-tipo="${esc(id)}" aria-pressed="${id === value}">`
    + `${esc(name)}<span class="chip__n" aria-hidden="true">${n}</span></button>`;
  el.innerHTML = chip("", "Todos", styles.length) + cats.map((c) => chip(c.id, c.name, c.set.size)).join("");
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Filtrar los estilos por tipo");
  el.hidden = false;
  el.querySelectorAll(".chip").forEach((b) => {
    const cat = cats.find((c) => c.id === b.dataset.tipo);
    b.setAttribute("aria-label", `${cat ? cat.name : "Todos"}: ${cat ? cat.set.size : styles.length} estilos`);
  });

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tipo]");
    if (!b) return;
    select(b.dataset.tipo === value ? "" : b.dataset.tipo, { user: true });
  });
  if (el.dataset.sticky !== undefined) stickBelowHeader(el.closest(".filters-bar") || el);
  requestAnimationFrame(() => center(false));

  function select(next, { user = false } = {}) {
    if (!cats.some((c) => c.id === next)) next = "";
    if (next === value) return;
    value = next;
    el.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === value)));
    center(true);
    if (user) track("filtro_estilos", { tipo: value || "todos", desde });
    onChange?.(value, api.category);
  }

  // En el móvil los botones van en una fila que se desliza: el elegido, hacia el centro.
  function center(smooth) {
    if (el.scrollWidth <= el.clientWidth + 1) return;
    const b = el.querySelector('[aria-pressed="true"]');
    const r = b.getBoundingClientRect(), box = el.getBoundingClientRect();
    const left = el.scrollLeft + r.left + r.width / 2 - (box.left + box.width / 2);
    el.scrollTo({ left: Math.max(0, left), behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  }
  return api;
}

// Las tarjetas que se ven al cambiar de tipo entran suaves, una detrás de otra (studio.css).
export function replayIn(cards) {
  cards.forEach((c, i) => { c.style.setProperty("--fi", Math.min(i, 8)); c.classList.remove("is-filtered"); });
  void cards[0]?.offsetWidth;
  cards.forEach((c) => c.classList.add("is-filtered"));
}

// Fila fija bajo la cabecera de la página (que también es fija y cambia de alto en el móvil).
function stickBelowHeader(el) {
  const top = document.querySelector(".top");
  if (!top) return;
  const set = () => el.style.setProperty("--top-h", `${top.offsetHeight}px`);
  set();
  new ResizeObserver(set).observe(top);
}
