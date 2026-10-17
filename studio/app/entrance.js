import { $ } from "./util.js";

// Entrada del escaparate: cortina con el monograma de las dos W y un contador (primera visita),
// la cortina sube y la portada aparece por capas. Después, las fotos se mueven un poco con el
// ratón y al bajar, y cada bloque de la página aparece al llegar a él.
// Los estados viven en clases de <html> (ver studio/entrance.css y el script del <head>).
const root = document.documentElement;
const MIN_CURTAIN_MS = 1900;
const t0 = performance.now();
let started = false;
const counter = { finish: false, done: Promise.resolve() };

splitLetters($("[data-brand-letters]"));
if (root.classList.contains("is-loading")) runCounter();

// La llama main.js cuando la portada ya tiene sus textos (o si algo falla al cargar).
export async function startEntrance() {
  if (started) return;
  started = true;
  splitWords($("[data-words]"));
  try { sessionStorage.setItem("ww-entrance", "1"); } catch { /* sin almacenamiento */ }

  if (root.classList.contains("is-loading")) {
    await Promise.race([document.fonts?.ready, sleep(1500)]);
    await sleep(Math.max(0, MIN_CURTAIN_MS - (performance.now() - t0)));
    counter.finish = true;
    await counter.done;
    const curtain = $("#preloader");
    curtain.classList.add("is-leaving");
    curtain.addEventListener("transitionend", () => curtain.remove(), { once: true });
  }
  requestAnimationFrame(() => {
    root.classList.add("is-ready");
    // Al terminar, se quitan los estados de entrada para que nada quede a medias.
    setTimeout(() => root.classList.remove("is-loading", "is-entering"), 3200);
  });
  if (!root.classList.contains("no-motion")) {
    parallax();
    magnetic();
  }
}

// Bloques que aparecen al llegar a ellos. Se puede llamar otra vez tras pintar contenido nuevo.
export function revealOnScroll(selector) {
  if (root.classList.contains("no-motion") || !("IntersectionObserver" in window)) return;
  root.classList.add("reveal-on");
  const io = revealOnScroll.io ||= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(selector).forEach((el) => {
    if (el.hasAttribute("data-reveal")) return;
    const siblings = [...el.parentElement.children].filter((c) => c.matches(selector));
    el.style.setProperty("--ri", Math.min(siblings.indexOf(el), 5));
    el.setAttribute("data-reveal", "");
    io.observe(el);
  });
}

// ── Piezas ───────────────────────────────────────────────

function runCounter() {
  const out = $("#preloader-count");
  counter.done = new Promise((resolve) => {
    let shown = 0;
    const tick = () => {
      // Sube sola hasta 90 en el tiempo mínimo; el último tramo, cuando todo está listo.
      const p = Math.min(1, (performance.now() - t0) / MIN_CURTAIN_MS);
      const target = counter.finish ? 100 : 90 * (1 - Math.pow(1 - p, 2));
      shown += (target - shown) * (counter.finish ? 0.18 : 0.12);
      if (counter.finish && target - shown < 0.6) shown = 100;
      out.textContent = String(Math.round(shown)).padStart(3, "0");
      shown >= 100 ? setTimeout(resolve, 120) : requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function splitLetters(el) {
  if (!el) return;
  el.setAttribute("aria-label", el.textContent);
  el.innerHTML = [...el.textContent].map((c, i) => `<span aria-hidden="true" style="--li:${i}">${c}</span>`).join("");
}

// Cada palabra en su caja, para que suba desde detrás de la línea. El texto sigue siendo uno solo
// para los lectores de pantalla.
function splitWords(el) {
  if (!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute("aria-label", words.join(" "));
  el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--wi:${i}">${escapeHtml(w)}</span></span>`).join(" ");
}

// Fotos de la portada: se desplazan según la posición del ratón y del scroll, cada una a su
// profundidad (--depth), con un poco de inercia.
function parallax() {
  const gallery = $(".hero__gallery");
  if (!gallery) return;
  const fine = matchMedia("(pointer: fine)").matches;
  const aim = { x: 0, y: 0 }, now = { x: 0, y: 0, s: 0 };
  if (fine) addEventListener("pointermove", (e) => {
    aim.x = (e.clientX / innerWidth) * 2 - 1;
    aim.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(gallery);
  const loop = () => {
    if (visible) {
      now.x += (aim.x - now.x) * 0.06;
      now.y += (aim.y - now.y) * 0.06;
      now.s += (scrollY - now.s) * 0.12;
      gallery.style.setProperty("--mx", now.x.toFixed(3));
      gallery.style.setProperty("--my", now.y.toFixed(3));
      gallery.style.setProperty("--sy", now.s.toFixed(1));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function magnetic() {
  if (!matchMedia("(pointer: fine)").matches) return;
  document.querySelectorAll(".btn--magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25, y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
