import { run, isStill, clamp, smooth, span, lerp, easeOut, easeInOut } from "./loop.js";

// Movimiento de «Promesa». Todo sale de la posición del scroll:
//   Frases (.lit): --p dice cuánto se ha leído; cada palabra se enciende con calc() en el CSS.
//   Lentes (.lens): un óvalo con foto que crece desde su hueco en la frase (.slot) hasta cubrir
//     el escenario. Es una elipse √2 veces más grande que el escenario, encogida con scale():
//     así, a tamaño 1, sus bordes ya quedan fuera de la pantalla y la foto se ve entera y nítida.
//     La foto de dentro se escala al revés para no deformarse. Solo transform: va fluido en el móvil.
//   Escenarios ([data-stage]): se quedan fijos (sticky) mientras pasa lo de dentro.
//     Portada: el óvalo entre los dos nombres se abre como un ojo al cargar; al bajar crece y
//       aparta los nombres; encima de la foto se enciende la frase de la portada.
//     Capítulo: se enciende la frase y después su óvalo crece hasta llenar la pantalla.
//     Cierre: al revés; la foto llena la pantalla y se cierra en su óvalo bajo la pregunta.
//   Galería: cada foto se abre como un iris al llegar al centro. Programa: cada hora se ilumina.
// Con «reducir movimiento», nada se fija ni se mueve: frases encendidas y fotos enteras.

const INTRO_MS = 2300;
const R2 = Math.SQRT2;
const SOFT = 3; // de cuántas palabras es el degradado entre lo leído y lo que falta

let hero = null;
let stages = [];
let lits = [];
let grows = [];
let glows = [];
let rises = [];
let introStart = 0;
let introPlayed = false;
let still = false;
let busy = false;

const docTop = (el) => { let y = 0, n = el; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; };
const set = (o, k, v, el = o.el) => { const r = Math.round(v * 1000) / 1000; if (o[k] !== r) { o[k] = r; el.style.setProperty(`--${k}`, r); } };
const tf = (o, k, el, s) => { if (o[k] !== s) { o[k] = s; el.style.transform = s; } };
const f3 = (v) => Math.round(v * 1e4) / 1e4;
const wordLit = (p, n, i) => clamp((p * (n + SOFT) - i) / SOFT);

// Lente: e = 0 en su hueco, 1 cubriendo el escenario; open = cuánto está abierto el óvalo (ojo).
function lensMeasure(L, box, slot) {
  L.W = box.clientWidth; L.H = box.clientHeight;
  if (slot) {
    const b = box.getBoundingClientRect(), r = slot.getBoundingClientRect();
    L.w0 = r.width; L.h0 = r.height;
    L.dx = r.left + r.width / 2 - (b.left + b.width / 2);
    L.dy = r.top + r.height / 2 - (b.top + b.height / 2);
  } else {
    L.w0 = L.W * 0.52; L.h0 = L.H * 0.64; L.dx = 0; L.dy = 0;
  }
}
function lensPlace(L, e, open = 1) {
  const sx = lerp(L.w0 / (R2 * L.W || 1), 1, e);
  const sy0 = lerp(L.h0 / (R2 * L.H || 1), 1, e);
  const o = Math.max(0.02, open);
  const sy = sy0 * o;
  const u = Math.max(Math.min(R2 * sx, 1), Math.min(R2 * sy0, 1));
  tf(L, "t1", L.lens, `translate3d(${(L.dx * (1 - e)).toFixed(1)}px, ${(L.dy * (1 - e)).toFixed(1)}px, 0) scale(${f3(sx)}, ${f3(sy)})`);
  tf(L, "t2", L.img, `scale(${f3(u / sx)}, ${f3(u / sy)})`);
  set(L, "lo", open > 0.03 ? Math.min(1, open * 2) : 0, L.lens);
  // Tamaño que ocupa ahora el óvalo (para apartar los nombres de la portada).
  return { w: R2 * L.W * sx, h: R2 * L.H * sy };
}

function near(o, top, h, y, vh) {
  const on = top < y + vh * 1.6 && top + h > y - vh * 0.6;
  if (on !== o.near) { o.near = on; o.el.classList.toggle("is-near", on); }
  return on;
}

function measure({ vh }) {
  still = isStill();
  for (const s of stages) {
    s.top = docTop(s.el); s.h = s.el.offsetHeight; s.sh = s.stage.offsetHeight;
    lensMeasure(s, s.stage, s.slot);
    if (s.names) s.names.forEach((nm) => {
      const r = nm.el.getBoundingClientRect(), b = s.slot.getBoundingClientRect();
      const vx = r.left + r.width / 2 - (b.left + b.width / 2), vy = r.top + r.height / 2 - (b.top + b.height / 2);
      const d = Math.hypot(vx, vy) || 1;
      nm.vx = vx / d; nm.vy = vy / d;
    });
    s.t1 = s.t2 = null;
  }
  lits.forEach((l) => { l.top = docTop(l.el); l.h = l.el.offsetHeight; });
  grows.forEach((g) => { g.top = docTop(g.el); g.h = g.el.offsetHeight; lensMeasure(g, g.el); g.t1 = g.t2 = null; });
  glows.forEach((g) => { g.top = docTop(g.el); g.h = g.el.offsetHeight; });
  rises.forEach((r) => { r.top = docTop(r.el); });
  if (still) {
    rises.forEach((r) => { r.up = true; r.el.classList.add("is-up"); });
    hero?.el.classList.add("is-ready", "is-done");
  }
}

function frame({ y, vh, t }) {
  busy = false;
  if (still) return;
  for (const s of stages) {
    const range = Math.max(1, s.h - s.sh);
    const raw = (y - s.top) / range;
    if (!near(s, s.top, s.h, y, vh) && s.kind !== "hero") continue;
    const p = clamp(raw);
    if (s.kind === "hero") {
      if (!introStart) introStart = t;
      const ip = introPlayed ? 1 : clamp((t - introStart - 120) / INTRO_MS);
      if (ip < 1) busy = true;
      else if (!introPlayed) { introPlayed = true; s.el.classList.add("is-done"); }
      const e = easeInOut(span(0.02, 0.56, p));
      const open = Math.max(easeInOut(span(0.06, 0.42, ip)), smooth(0, 0.03, p));
      const box = lensPlace(s, e, open);
      // Los nombres se apartan con el borde del óvalo y se desvanecen.
      const fade = 1 - smooth(0.2, 0.62, e);
      for (const nm of s.names) {
        const off = Math.abs(nm.vx) * (box.w - s.w0) / 2 + Math.abs(nm.vy) * (box.h - s.h0) / 2;
        tf(nm, "t", nm.el, off > 0.5 ? `translate3d(${(nm.vx * off).toFixed(1)}px, ${(nm.vy * off).toFixed(1)}px, 0)` : "");
        set(nm, "nf", fade);
      }
      set(s, "q", smooth(0, 0.14, p), s.body);
      set(s, "v", smooth(0.5, 0.72, p), s.veil);
      if (s.lit) { set(s.lit, "p", span(0.6, 0.92, p)); set(s.lit, "show", smooth(0.5, 0.62, p)); }
    } else if (s.kind === "chapter") {
      const pl = span(-0.22, 0.4, raw);
      set(s.lit, "p", pl);
      const a = s.slotIndex >= 0 ? wordLit(pl, s.lit.n, s.slotIndex) : 1;
      const e = easeInOut(span(0.47, 0.86, p));
      lensPlace(s, e, Math.max(easeOut(a), e > 0 ? 1 : 0));
      set(s, "bf", 1 - smooth(0.5, 0.68, p), s.body);
      set(s, "v", smooth(0.78, 0.94, p), s.veil);
      if (s.caption) set(s, "c", smooth(0.82, 0.96, p), s.caption);
    } else if (s.kind === "closing") {
      set(s.lit, "p", span(-0.3, 0.26, raw));
      const e = 1 - easeInOut(span(0.3, 0.74, p));
      lensPlace(s, e, 1);
      set(s, "v", e, s.veil);
      const end = smooth(0.68, 0.9, p);
      set(s, "end", end, s.endEl);
      if ((end > 0.02) !== s.isEnd) { s.isEnd = end > 0.02; s.el.classList.toggle("is-end", s.isEnd); }
    }
  }
  for (const l of lits) {
    if (l.top > y + vh * 1.2 || l.top + l.h < y - vh * 0.2) continue;
    set(l, "p", span(l.top - vh * 0.86, l.top + l.h - vh * 0.5, y));
  }
  for (const g of grows) {
    if (!near(g, g.top, g.h, y, vh)) continue;
    const c = g.top + g.h / 2 - y;
    lensPlace(g, easeOut(span(vh * 1.04, vh * 0.42, c)), 1);
  }
  for (const g of glows) {
    const c = g.top + g.h / 2 - y;
    if (c < -vh || c > vh * 2) continue;
    set(g, "g", 1 - smooth(0, vh * 0.3, Math.abs(c - vh * 0.5)));
  }
  for (const r of rises) if (!r.up && r.top < y + vh * 0.88) { r.up = true; r.el.classList.add("is-up"); }
}

const litOf = (el) => (el ? { el, n: +el.style.getPropertyValue("--n") || el.querySelectorAll(".w").length } : null);

export function startMotion(root) {
  stages = [...root.querySelectorAll("[data-stage]")].map((el) => {
    const stage = el.querySelector(".stage");
    const lens = stage.querySelector(".lens");
    const slot = stage.querySelector("[data-slot]");
    const s = {
      el, kind: el.dataset.stage, stage, lens, img: lens.querySelector("img"), slot,
      slotIndex: slot ? +slot.dataset.slot : -1,
      veil: stage.querySelector(".veil") || stage,
      lit: litOf(stage.querySelector("[data-lit-stage]")),
      body: stage.querySelector(".hero__body, .chapter__body") || stage,
      caption: stage.querySelector(".chapter__caption"),
      endEl: stage.querySelector(".closing__end") || stage,
    };
    if (s.kind === "hero") s.names = [...stage.querySelectorAll("[data-name]")].map((n) => ({ el: n }));
    return s;
  });
  hero = stages.find((s) => s.kind === "hero") || null;
  lits = [...root.querySelectorAll("[data-lit]")].map((el) => ({ el }));
  grows = [...root.querySelectorAll("[data-grow]")].map((el) => {
    const lens = el.querySelector(".lens");
    return { el, lens, img: lens.querySelector("img") };
  });
  glows = [...root.querySelectorAll("[data-glow]")].map((el) => ({ el }));
  rises = [...root.querySelectorAll("[data-rise]")].map((el) => ({ el, up: false }));
  introStart = 0;
  if (hero) {
    if (introPlayed) hero.el.classList.add("is-ready", "is-done", "is-instant");
    else requestAnimationFrame(() => hero?.el.classList.add("is-ready"));
  }
  run({ measure, frame, animating: () => busy, reset: () => {} }, root);
}
