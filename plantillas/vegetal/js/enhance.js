import { isPreview } from "./config.js";

// Vegetal: al bajar, la hoja de papel vegetal de la portada se levanta y deja ver la foto
// nítida. Va ligado al scroll con un único listener (pasivo) y un rAF por fotograma.
//
// En la vista previa del escaparate main.js vuelve a pintar todo con cada cambio y llama a
// enhance otra vez: los listeners se añaden una sola vez (bound) y solo se actualizan las
// referencias a los elementos nuevos, así nunca se duplican.
// Con prefers-reduced-motion no hay movimiento: la hoja se queda fija y legible (CSS).

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let introPlayed = false;
let bound = false;
let queued = false;
let s = null; // { hero, sheet, photo, tagline, top, range, lift }

export function enhance(main) {
  const hero = main.querySelector(".hero");
  // La entrada de la hoja se ve la primera vez; en la vista previa no se repite en cada cambio.
  if (hero && isPreview && introPlayed) hero.classList.add("is-static");
  introPlayed = true;

  s = hero && !reduced.matches ? {
    hero,
    sheet: hero.querySelector(".hero__sheet"),
    photo: hero.querySelector(".hero__photo"),
    tagline: hero.querySelector(".hero__tagline"),
    top: 0, range: 1, lift: 0,
  } : null;
  if (!s) return;

  if (!bound) {
    bound = true;
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", () => { measure(); schedule(); }, { passive: true });
    document.fonts?.ready.then(() => { measure(); schedule(); });
  }
  measure();
  update();
}

// Las medidas (lecturas de layout) solo al montar y al cambiar de tamaño; el scroll solo escribe.
function measure() {
  if (!s || !s.hero.isConnected) return;
  s.top = s.hero.getBoundingClientRect().top + scrollY;
  s.range = Math.max(1, s.hero.offsetHeight - innerHeight);
  s.lift = s.sheet ? s.sheet.offsetTop + s.sheet.offsetHeight + 40 : 0;
}

function schedule() {
  if (queued || !s) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
}

const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t); // suave al empezar y al terminar, como levantar una hoja

function update() {
  if (!s || !s.hero.isConnected) return;
  const p = clamp((scrollY - s.top) / s.range);
  const q = clamp(p / 0.72); // la hoja termina de subir antes y la foto queda limpia un rato
  const e = ease(q);
  if (s.sheet) {
    s.sheet.style.transform = q ? `translate3d(0, ${(-e * s.lift).toFixed(1)}px, 0) rotate(${(-e * 1.6).toFixed(2)}deg)` : "";
    // Fuera de la pantalla no hay nada que desenfocar: se oculta y no cuesta nada.
    s.sheet.style.visibility = q >= 1 ? "hidden" : "";
  }
  if (s.photo) s.photo.style.transform = `scale(${(1.06 - 0.06 * e).toFixed(4)})`;
  if (s.tagline) {
    const t = clamp((p - 0.5) / 0.3);
    s.tagline.style.opacity = t.toFixed(3);
    s.tagline.style.transform = `translate3d(0, ${((1 - t) * 14).toFixed(1)}px, 0)`;
  }
}
