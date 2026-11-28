import { run, isStill, clamp, smooth, span, easeInOut } from "./loop.js";

// Movimiento de «Persiana». Todo sale de la posición del scroll y se escribe como variables de
// CSS (una por cosa): la sombra de las lamas adelgaza con calc() en css/style.css.
//   Portada: al abrir, las lamas se entreabren solas y entran franjas de sol sobre la foto; al
//            bajar, se abren del todo, la luz se desliza (el sol se mueve) y se apaga, y la foto
//            se funde con la pared. La portada se queda fija mientras tanto (sticky).
//   Ventanas: cada foto entra a la sombra de las lamas, que se abren cuando llega al centro.
//   Programa: cada hora se ilumina al pasar por la franja de sol (el centro de la pantalla).
//   Sol: en cada pared hay una mancha de sol y sombra de olivo que se desplaza despacio.
// Con «reducir movimiento», las persianas no salen y todo está quieto y visible.

const INTRO_MS = 1300;
const INTRO_OPEN = 0.6;    // cuánto se abren las lamas solas al principio

let hero = null;
let walls = [];
let windows = [];
let lit = [];
let rises = [];
let introStart = 0;
let introPlayed = false;
let still = false;
let busy = false;
let size = { vw: 0, vh: 0 };

const docTop = (el) => { let y = 0, n = el; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; };
const set = (o, k, v, el = o.el) => { const r = Math.round(v * 1000) / 1000; if (o[k] !== r) { o[k] = r; el.style.setProperty(`--${k}`, r); } };

function measure({ vw, vh }) {
  size = { vw, vh };
  still = isStill();
  if (hero) { hero.top = docTop(hero.el); hero.h = hero.el.offsetHeight; }
  walls.forEach((w) => { w.top = docTop(w.el); w.h = w.el.offsetHeight; });
  windows.forEach((w) => { w.top = docTop(w.el); w.h = w.el.offsetHeight; });
  lit.forEach((l) => { l.top = docTop(l.el); l.h = l.el.offsetHeight; });
  rises.forEach((r) => { r.top = docTop(r.el); });
  if (still) {
    rises.forEach((r) => { r.up = true; r.el.classList.add("is-up"); });
    hero?.el.classList.add("is-ready", "is-done");
  }
}

function frame({ y, vh, t }) {
  busy = false;
  if (still) {
    lit.forEach((l) => set(l, "lit", 1));
    return;
  }
  // Portada
  if (hero) {
    if (!introStart) introStart = t;
    const ip = introPlayed ? 1 : clamp((t - introStart - 120) / INTRO_MS);
    if (ip < 1) busy = true;
    else if (!introPlayed) { introPlayed = true; hero.el.classList.add("is-done"); }
    const travel = Math.max(1, hero.h - vh);
    const hp = clamp((y - hero.top) / travel);
    const scrolled = hp > 0 ? INTRO_OPEN + (1 - INTRO_OPEN) * smooth(0, 0.5, hp) : 0;
    const open = Math.max(INTRO_OPEN * easeInOut(ip), scrolled);
    // Cada variable va solo en el elemento que la usa: así el navegador recalcula lo mínimo.
    set(hero.blind, "o", open);
    set(hero.blind, "drift", hp * 16);
    set(hero.blind, "fade", smooth(0.4, 0.9, hp));
    set(hero.dim, "dim", 1 - smooth(0, 0.8, ip));
    set(hero.photo, "hp", hp);
    set(hero.body, "hp", hp);
    set(hero.fade, "end", smooth(0.55, 1, hp));
  }
  // Paredes: el sol se desplaza según dónde esté la pared en la pantalla (-1 abajo, 1 arriba).
  for (const w of walls) {
    const near = w.top < y + vh * 1.3 && w.top + w.h > y - vh * 0.3;
    if (near !== w.near) { w.near = near; w.el.classList.toggle("is-near", near); }
    if (!near) continue;
    set(w.patch, "sp", clamp(((y + vh / 2) - (w.top + w.h / 2)) / (w.h / 2 + vh / 2), -1, 1));
  }
  // Ventanas: la persiana se abre al llegar la foto al centro y sube al final.
  for (const w of windows) {
    const c = w.top + w.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    set(w, "o", span(vh * 1.02, vh * 0.46, c));
  }
  // Programa: la franja de sol está en el centro de la pantalla.
  for (const l of lit) {
    const c = l.top + l.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    set(l, "lit", 1 - smooth(0, vh * 0.3, Math.abs(c - vh * 0.52)));
  }
  for (const r of rises) if (!r.up && r.top < y + vh * 0.9) { r.up = true; r.el.classList.add("is-up"); }
}

export function startMotion(root) {
  const h = root.querySelector("[data-hero]");
  const part = (sel) => ({ el: h.querySelector(sel) || h });
  hero = h ? { el: h, blind: part(".blind"), dim: part(".hero__dim"), photo: part(".hero__photo"), body: part(".hero__body"), fade: part(".hero__fade") } : null;
  walls = [...root.querySelectorAll(".wall")].map((el, i) => {
    // Una mancha de sol por pared, a un lado y a otro; sombra de olivo en una sí y otra no.
    if (!el.querySelector(".patch")) el.insertAdjacentHTML("afterbegin", `<div class="patch patch--${i % 2 ? "r" : "l"}${i % 2 ? "" : " has-leaves"}" aria-hidden="true"><i class="patch__light"></i>${i % 2 ? "" : `<i class="patch__leaves"></i>`}</div>`);
    return { el, patch: { el: el.querySelector(".patch") } };
  });
  windows = [...root.querySelectorAll("[data-window]")].map((el) => ({ el }));
  lit = [...root.querySelectorAll("[data-lit]")].map((el) => ({ el }));
  rises = [...root.querySelectorAll("[data-rise]")].map((el) => ({ el, up: false }));
  introStart = 0;
  if (hero) {
    if (introPlayed) hero.el.classList.add("is-ready", "is-done");
    else requestAnimationFrame(() => hero?.el.classList.add("is-ready"));
  }
  run({ measure, frame, animating: () => busy, reset: () => {} }, root);
}
