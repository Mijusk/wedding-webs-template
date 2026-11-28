import { run, isStill, clamp, smooth, span } from "./loop.js";

// Movimiento de «Floración». Todo se escribe como variables de CSS en el elemento que las usa:
//   --b  cuánto está abierta una flor (0 capullo, 1 abierta). Los pétalos giran y se separan con calc().
//   --r  cuánto se ha abierto una foto en círculo (0 nada, 1 entera).
//   --f  cuánto se ha abierto el abanico de colores.
// La flor de la portada se abre sola a medias al cargar y termina de abrirse al bajar. Las demás
// florecen cuando llegan a la mitad de la pantalla. Los pétalos que caen se mueven con CSS; al
// hacer scroll les da un poco de «viento». Con «reducir movimiento», todo abierto y quieto.

const INTRO_MS = 2600;
const INTRO_OPEN = 0.62;

let hero = null;
let flowers = [];
let blooms = [];
let fans = [];
let rises = [];
let fall = null;
let closingFlower = null;
let introStart = 0;
let introPlayed = false;
let still = false;
let busy = false;
let lastY = 0;
let wind = 0;
let maxY = 0;

const docTop = (el) => { let y = 0, n = el; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; };
const set = (o, k, v) => { const r = Math.round(v * 1000) / 1000; if (o[k] !== r) { o[k] = r; o.el.style.setProperty(`--${k}`, r); } };
const easeOutQuint = (t) => 1 - (1 - t) ** 4;

function measure({ vh }) {
  still = isStill();
  maxY = Math.max(0, document.documentElement.scrollHeight - vh);
  for (const list of [flowers, blooms, fans]) list.forEach((o) => { o.top = docTop(o.el); o.h = o.el.offsetHeight; });
  rises.forEach((r) => { r.top = docTop(r.el); });
  if (closingFlower) {
    // Que se abra del todo aunque el final de la página no deje subirla hasta la mitad.
    const end = Math.min(closingFlower.top + closingFlower.h / 2 - vh * 0.48, maxY);
    closingFlower.y1 = end;
    closingFlower.y0 = end - vh * 0.75;
  }
  if (still) {
    flowers.forEach((f) => set(f, "b", 1));
    blooms.forEach((b) => set(b, "r", 1));
    fans.forEach((f) => set(f, "f", 1));
    rises.forEach((r) => { r.up = true; r.el.classList.add("is-up"); });
    hero?.el.classList.add("is-ready", "is-done");
  }
}

function frame({ y, vh, t, dt }) {
  busy = false;
  if (still) return;
  // Portada
  if (hero) {
    if (!introStart) introStart = t;
    const ip = introPlayed ? 1 : clamp((t - introStart - 150) / INTRO_MS);
    if (ip < 1) busy = true;
    else if (!introPlayed) { introPlayed = true; hero.el.classList.add("is-done"); }
    const scrolled = INTRO_OPEN + (1 - INTRO_OPEN) * smooth(0, vh * 0.55, y);
    set(hero.flower, "b", y > 0 ? Math.max(INTRO_OPEN * easeOutQuint(ip), scrolled) : INTRO_OPEN * easeOutQuint(ip));
    set(hero.flower, "turn", smooth(0, vh, y));
  }
  for (const f of flowers) {
    if (f === hero?.flower) continue;
    const c = f.top + f.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    if (f === closingFlower) set(f, "b", span(f.y0, f.y1, y));
    else set(f, "b", span(vh * 0.96, vh * 0.52, c));
  }
  for (const b of blooms) {
    const c = b.top + b.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    set(b, "r", span(vh * 1.05, vh * 0.5, c));
  }
  for (const f of fans) {
    const c = f.top + f.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    set(f, "f", span(vh * 0.95, vh * 0.55, c));
  }
  for (const r of rises) if (!r.up && r.top < y + vh * 0.9) { r.up = true; r.el.classList.add("is-up"); }
  // Pétalos que caen: aparecen al bajar de la portada; el scroll los empuja un poco.
  if (fall) {
    const v = dt > 0 ? (y - lastY) / dt : 0;
    lastY = y;
    wind += (clamp(v * 140, -110, 110) - wind) * (1 - Math.exp(-dt / 260));
    if (Math.abs(wind) > 0.4) busy = true; else wind = 0;
    fall.wind.style.transform = `translate3d(0, ${(-wind).toFixed(1)}px, 0)`;
    const on = y > vh * 0.35;
    if (on !== fall.on) { fall.on = on; fall.el.classList.toggle("is-on", on); }
  }
}

export function startMotion(root) {
  const h = root.querySelector("[data-hero]");
  flowers = [...root.querySelectorAll("[data-flower]")].map((el) => ({ el }));
  hero = h ? { el: h, flower: flowers.find((f) => h.contains(f.el)) || { el: h } } : null;
  closingFlower = flowers.find((f) => f.el.classList.contains("flower--closing")) || null;
  blooms = [...root.querySelectorAll("[data-bloom]")].map((el) => ({ el }));
  fans = [...root.querySelectorAll("[data-fan]")].map((el) => ({ el }));
  rises = [...root.querySelectorAll("[data-rise]")].map((el) => ({ el, up: false }));
  const f = root.querySelector(".fall");
  fall = f ? { el: f, wind: f.querySelector(".fall__wind"), on: false } : null;
  lastY = scrollY;
  introStart = 0;
  if (hero) {
    if (introPlayed) hero.el.classList.add("is-ready", "is-done");
    else requestAnimationFrame(() => hero?.el.classList.add("is-ready"));
  }
  run({ measure, frame, animating: () => busy, reset: () => {} }, root);
}
