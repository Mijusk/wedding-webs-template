import { skyAt } from "./sky.js";

// Todo lo que se mueve al bajar en «Del día a la noche». Un solo listener de scroll (con
// requestAnimationFrame) y solo transform/opacity, para que vaya fino también en móviles normales.
//
// - Cielo: el color de la página, el sol, la luna y las estrellas siguen la hora de lo que se
//   está leyendo (data-sky de cada sección y de cada momento del programa).
// - Portada: las letras de los nombres, con la foto dentro, crecen hasta abrirse a la foto entera.
// - Lo esencial: las dos tarjetas caen sobre la mesa como polaroids.
// - Historia: la sección se queda quieta y los capítulos pasan de lado.
// - Programa: la hora enorme cruza la pantalla en un sentido y el texto en el otro.
// - Galería: las fotos suben a distinta velocidad según su profundidad, con los nombres detrás.
//
// Con «reducir movimiento» del sistema no se mueve nada: solo cambia el color del cielo.

const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - (1 - t) ** 3;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

let S = null; // estado de la página pintada
let bound = false;
let queued = false;
let lastSky = NaN;
let lastTheme = 0;

// Estrellas siempre iguales (semilla fija), redondas en cualquier pantalla.
function starsSvg() {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: 90 }, (_, i) => {
    const r = rnd() < 0.12 ? 2.2 : 0.8 + rnd() * 1.1;
    return `<circle cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * 1000).toFixed(0)}" r="${r.toFixed(1)}"${i % 7 === 0 ? ` class="tw" style="animation-delay:${(rnd() * 4).toFixed(1)}s"` : ""}/>`;
  }).join("");
  return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">${dots}</svg>`;
}

function ensureSky() {
  if (document.querySelector(".sky")) return;
  document.body.insertAdjacentHTML("afterbegin", `<div class="sky" aria-hidden="true">
    <div class="sky__stars">${starsSvg()}</div><div class="sky__sun"></div><div class="sky__moon"></div></div>`);
}

// Momento de cada sección: las que no lo traen se reparten entre las que sí.
function skyStops(main) {
  const els = [...main.querySelectorAll("[data-sky]")];
  const vals = els.map((el) => (el.dataset.sky === "" ? NaN : Number(el.dataset.sky)));
  if (!els.length) return [];
  if (!Number.isFinite(vals[0])) vals[0] = -330;
  const known = vals.map((v, i) => (Number.isFinite(v) ? i : -1)).filter((i) => i >= 0);
  const lastKnown = known[known.length - 1];
  if (lastKnown < vals.length - 1) {
    // Después del último momento del programa, ya de noche; sin programa, el día entero.
    const end = known.length > 1 ? Math.max(vals[lastKnown] + 70, 170) : 170;
    vals[vals.length - 1] = end;
    known.push(vals.length - 1);
  }
  for (let k = 0; k < known.length - 1; k++) {
    const i = known[k], j = known[k + 1];
    for (let x = i + 1; x < j; x++) vals[x] = vals[i] + ((vals[j] - vals[i]) * (x - i)) / (j - i);
  }
  return els.map((el, i) => ({ el, value: vals[i], anchor: 0 }));
}

const absTop = (el) => el.getBoundingClientRect().top + scrollY;

function measure() {
  if (!S) return;
  const vh = innerHeight, vw = document.documentElement.clientWidth;
  S.vh = vh; S.vw = vw;
  const moving = !still.matches;

  // Historia: alto de la sección = lo que hay que recorrer de lado + una pantalla.
  if (S.hs) {
    const { box, track } = S.hs;
    const dist = Math.max(0, track.scrollWidth - vw);
    const pinned = moving && dist > 40;
    box.classList.toggle("is-pinned", pinned);
    box.style.height = pinned ? `${Math.round(dist + vh)}px` : "";
    if (!pinned) track.style.transform = "";
    S.hs.dist = dist; S.hs.pinned = pinned;
  }
  // Galería: cuanto más fotos, más recorrido.
  if (S.layers) {
    const { box, items } = S.layers;
    box.style.height = moving ? `${Math.round(vh * (1.5 + 0.32 * items.length))}px` : "";
  }

  if (S.hero) { S.hero.top = absTop(S.hero.el); S.hero.h = S.hero.el.offsetHeight; }
  if (S.cards) S.cards.top = absTop(S.cards.el);
  if (S.hs) { S.hs.top = absTop(S.hs.box); S.hs.h = S.hs.box.offsetHeight; }
  S.moments.forEach((m) => { m.top = absTop(m.el); m.h = m.el.offsetHeight; });
  if (S.layers) {
    const L = S.layers;
    L.top = absTop(L.box); L.h = L.box.offsetHeight;
    L.namesW = L.names ? L.names.scrollWidth : 0;
    const n = L.items.length, K = 2.1;
    L.items.forEach((it, i) => {
      // Cada foto pasa por el centro de la pantalla en su momento (p) y a su velocidad.
      const hFrac = it.el.offsetHeight / vh;
      const p = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1);
      it.k = K * it.depth;
      it.y0 = 0.5 - hFrac / 2 + p * it.k;
    });
  }
  S.stops.forEach((s) => {
    const top = absTop(s.el), h = s.el.offsetHeight;
    s.anchor = s.el.classList.contains("hero") ? top + vh * 0.5 : top + Math.min(h, vh) * 0.5;
  });
  lastSky = NaN;
  frame();
}

function frame() {
  queued = false;
  if (!S) return;
  const y = scrollY, vh = S.vh, vw = S.vw;
  const moving = !still.matches;

  if (moving && S.hero && y < S.hero.top + S.hero.h) {
    const H = S.hero, p = clamp((y - H.top) / Math.max(1, H.h - vh));
    const grow = ease(clamp(p / 0.8));
    H.names.style.transform = `scale(${(1 + 5 * grow).toFixed(3)})`;
    H.names.style.opacity = (1 - smooth(0.42, 0.78, p)).toFixed(3);
    H.mask.style.opacity = (1 - smooth(0.12, 0.6, p)).toFixed(3);
    H.photo.style.transform = `scale(${(1.16 - 0.16 * ease(p)).toFixed(4)})`;
    const after = smooth(0.7, 0.93, p);
    H.after.style.opacity = after.toFixed(3);
    H.after.style.transform = `translate3d(0, ${((1 - after) * 26).toFixed(1)}px, 0)`;
    H.veil.style.opacity = after.toFixed(3);
    H.frame.style.opacity = (1 - smooth(0, 0.16, p)).toFixed(3);
    if (H.hint) H.hint.style.opacity = (1 - smooth(0, 0.05, p)).toFixed(3);
  }

  if (moving && S.cards && y + vh > S.cards.top - vh * 0.2 && y < S.cards.top + vh * 1.5) {
    S.cards.items.forEach((c, i) => {
      const q = ease(clamp((y + vh - S.cards.top - i * vh * 0.1) / (vh * 0.72)));
      const from = i % 2 ? { x: 0.34, y: 0.6, r: 17, end: 2.2 } : { x: -0.34, y: 0.45, r: -19, end: -2.6 };
      const k = 1 - q;
      c.style.transform = `translate3d(${(from.x * vw * k).toFixed(1)}px, ${(from.y * vh * k).toFixed(1)}px, 0) rotate(${(from.end + (from.r - from.end) * k).toFixed(2)}deg)`;
    });
  }

  if (S.hs?.pinned && y + vh > S.hs.top && y < S.hs.top + S.hs.h) {
    const p = clamp((y - S.hs.top) / Math.max(1, S.hs.h - vh));
    S.hs.track.style.transform = `translate3d(${(-p * S.hs.dist).toFixed(1)}px, 0, 0)`;
    if (S.hs.word) S.hs.word.style.transform = `translate3d(${(vw * 0.15 - p * S.hs.dist * 0.4).toFixed(1)}px, 0, 0)`;
  }

  if (moving) {
    S.moments.forEach((m) => {
      if (y + vh < m.top || y > m.top + m.h) return;
      const r = clamp((y + vh / 2 - (m.top + m.h / 2)) / (m.h / 2 + vh / 2), -1, 1);
      m.time.style.transform = `translate3d(${(-r * vw * 0.16).toFixed(1)}px, 0, 0)`;
      m.what.style.transform = `translate3d(${(r * vw * 0.05).toFixed(1)}px, 0, 0)`;
      m.what.style.opacity = (1 - smooth(0.5, 0.95, Math.abs(r))).toFixed(3);
    });
  }

  if (moving && S.layers && y + vh > S.layers.top && y < S.layers.top + S.layers.h) {
    const L = S.layers, p = clamp((y - L.top) / Math.max(1, L.h - vh));
    L.items.forEach((it) => {
      it.el.style.transform = `translate3d(0, ${((it.y0 - p * it.k) * vh).toFixed(1)}px, 0)`;
    });
    if (L.names) L.names.style.transform = `translate3d(${(vw * 0.1 - p * (L.namesW - vw * 0.5)).toFixed(1)}px, 0, 0)`;
    if (L.head) L.head.style.opacity = (1 - smooth(0.12, 0.3, p)).toFixed(3);
  }

  paintSky(y + vh * 0.5);
}

function paintSky(reading) {
  const stops = S.stops;
  if (!stops.length) return;
  let value = stops[0].value;
  if (reading >= stops[stops.length - 1].anchor) value = stops[stops.length - 1].value;
  else {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (reading < a.anchor) break;
      if (reading < b.anchor) {
        const t = smooth(0.15, 0.85, (reading - a.anchor) / Math.max(1, b.anchor - a.anchor));
        value = a.value + (b.value - a.value) * t;
        break;
      }
    }
  }
  if (Math.abs(value - lastSky) < 0.4) return;
  lastSky = value;
  const c = skyAt(value);
  const root = document.documentElement.style;
  root.setProperty("--sky", c.sky);
  root.setProperty("--low", c.low);
  root.setProperty("--ink", c.ink);
  root.setProperty("--muted", c.muted);
  root.setProperty("--line", c.line);
  root.setProperty("--accent", c.accent);
  root.setProperty("--on-accent", c.onAccent);
  root.setProperty("--sun", c.sun.toFixed(3));
  root.setProperty("--stars", c.stars.toFixed(3));
  document.documentElement.classList.toggle("is-night", c.dark);
  // El color de la barra del navegador en el móvil, sin cambiarlo en cada fotograma.
  const now = performance.now();
  if (now - lastTheme > 300) {
    lastTheme = now;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.sky);
  }
}

const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
let measureQueued = false;
const remeasure = () => {
  if (measureQueued) return;
  measureQueued = true;
  requestAnimationFrame(() => { measureQueued = false; measure(); });
};

export function startMotion(main, config) {
  ensureSky();
  document.documentElement.classList.toggle("is-still", still.matches);
  const q = (sel) => main.querySelector(sel);
  const hero = q(".hero");
  const cards = q(".details .cards");
  const hsBox = q(".story .hs");
  const layersBox = q(".gallery .layers");
  S = {
    hero: hero && {
      el: hero, mask: hero.querySelector(".hero__mask"), names: hero.querySelector(".hero__names"), photo: hero.querySelector(".hero__photo"),
      after: hero.querySelector(".hero__after"), veil: hero.querySelector(".hero__veil"),
      frame: hero.querySelector(".hero__frame"), hint: hero.querySelector(".hero__hint"),
    },
    cards: cards && { el: cards, items: [...cards.querySelectorAll(".card")] },
    hs: hsBox && { box: hsBox, track: hsBox.querySelector(".hs__track"), word: hsBox.querySelector(".hs__word") },
    moments: [...main.querySelectorAll(".moment")].map((el) => ({
      el, time: el.querySelector(".moment__time"), what: el.querySelector(".moment__what"),
    })),
    layers: layersBox && {
      box: layersBox, names: layersBox.querySelector(".layers__names"), head: layersBox.querySelector(".head"),
      items: [...layersBox.querySelectorAll(".layer")].map((el) => ({ el, depth: Number(el.dataset.depth) || 1 })),
    },
    stops: skyStops(main),
    vh: innerHeight, vw: document.documentElement.clientWidth,
  };
  measure();
  // Las fotos y las letras cambian el alto de la página al cargar: se vuelve a medir.
  main.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", remeasure, { once: true }); });
  document.fonts?.ready.then(remeasure);

  if (bound) return;
  bound = true;
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", remeasure);
  still.addEventListener?.("change", () => {
    document.documentElement.classList.toggle("is-still", still.matches);
    if (still.matches) document.querySelectorAll("[style*='transform']").forEach((el) => { if (!el.closest(".sky")) el.style.transform = ""; });
    remeasure();
  });
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.getElementById("app"));
}
