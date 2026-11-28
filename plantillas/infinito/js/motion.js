import { run, request, isStill, clamp, easeInOut, smooth, span } from "./loop.js";

// «Infinito»: un solo plano fijo (.dive__stage) y una cámara que entra por ventanas.
//
// Cada escena k tiene una ventana W_k (un arco o un óvalo con la proporción de la pantalla). La
// escena k+1 vive dentro de esa ventana: es la escena entera, a escala r = ancho de la ventana /
// ancho de la pantalla, centrada en ella. Bajar hace tres cosas, en este orden:
//   1. quieto: se lee la escena;
//   2. se abre la ventana (el texto se aparta y el marco crece desde el centro con la siguiente dentro);
//   3. la cámara entra: la escena k crece (1/r)^g veces alrededor del punto fijo de la ventana, así
//      la ventana acaba exactamente en la pantalla y la escena k+1 queda a tamaño real.
// La última escena (el cierre) enseña en su ventana la portada: entrar en ella deja la web como al
// principio. Solo se tocan transform, opacity y clip-path; las escenas que no se ven, a opacidad 0
// (siguen en el árbol de accesibilidad: al llegar a una con el tabulador, la cámara va a ella).

// Cuánto se baja en cada paso, en pantallas: quieto, abrir, entrar.
const STEP = {
  hero: [0.12, 0, 1.0],
  title: [0.55, 0.38, 0.95],
  photo: [0.42, 0.36, 0.9],
  quick: [0.18, 0.3, 0.78],
  last: [0.6, 0.42, 1.05],
};
const END_HOLD = 0.35; // la portada, otra vez, antes de soltar el plano

let S = null;
let introPlayed = false; // en la vista previa la web se vuelve a pintar: la entrada, solo la primera vez

const affine = (a, x, y) => ({ a, x, y });
const compose = (A, B) => affine(A.a * B.a, A.a * B.x + A.x, A.a * B.y + A.y);
const css = (T) => `translate3d(${T.x.toFixed(2)}px, ${T.y.toFixed(2)}px, 0) scale(${T.a.toFixed(5)})`;

function setStyle(el, prop, value) {
  if (el._last?.[prop] === value) return;
  (el._last ||= {})[prop] = value;
  el.style[prop] = value;
}

function measure({ vw, vh }) {
  if (!S) return;
  const { stage, scenes, dive } = S;
  const moving = !isStill();
  S.moving = moving;
  const sw = stage.clientWidth || vw;
  const sh = stage.clientHeight || vh;
  S.sw = sw; S.sh = sh; S.vh = vh;
  const landscape = sw > sh * 1.05;
  dive.classList.toggle("is-landscape", landscape);

  scenes.forEach((s, i) => {
    s.shape = s.open0 ? (landscape ? "rect" : "arch") : i % 2 ? (landscape ? "rect" : "arch") : "oval";
    s.el.dataset.shape = s.shape;
  });

  if (!moving) {
    dive.style.height = "";
    scenes.forEach((s) => {
      [s.el, s.over].forEach((el) => {
        if (!el) return;
        ["transform", "opacity", "clipPath", "zIndex", "pointerEvents", "willChange"].forEach((p) => { el.style[p] = ""; });
        el._last = {};
      });
      s.parts.forEach((p) => { p.style.opacity = ""; p.style.transform = ""; if (p._last) p._last = {}; });
      if (s.win) { s.win.style.transform = ""; s.win.style.opacity = ""; }
      if (s.img) { s.img.style.transform = ""; loadImg(s); s.img.loading = "lazy"; }
    });
    S.index.hidden = true;
    const still = stage.querySelector(".scene__still");
    if (still && !still.getAttribute("src")) still.src = still.dataset.src;
    pill(true);
    return;
  }
  S.index.hidden = false;

  // Ventanas: se leen sin transformaciones (offset*), en coordenadas de su escena.
  S.Sc = { x: sw / 2, y: sh / 2 };
  scenes.forEach((s) => {
    const w = s.win;
    const W = { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight };
    const r = Math.min(W.w / sw, W.h / sh);
    const Wc = { x: W.x + W.w / 2, y: W.y + W.h / 2 };
    // M: de la escena siguiente a esta (la siguiente, a escala r y centrada en la ventana).
    s.M = affine(r, Wc.x - r * S.Sc.x, Wc.y - r * S.Sc.y);
    // Punto fijo de la entrada por esta ventana.
    s.P = { x: s.M.x / (1 - r), y: s.M.y / (1 - r) };
    s.r = r;
  });

  // Pasos: el de cada escena hacia la siguiente; el último, hacia la portada.
  let pos = 0;
  S.steps = scenes.map((s, i) => {
    const kind = i === 0 ? "hero" : s.last ? "last" : s.quick ? "quick" : s.kind;
    const [H, O, D] = (STEP[kind] || STEP.title).map((v) => v * sh);
    const step = { start: pos, H, O, D, len: H + O + D };
    pos += step.len;
    return step;
  });
  S.endHold = END_HOLD * sh;
  S.total = pos + S.endHold;
  dive.style.height = `${Math.round(S.total + sh)}px`;
  S.top = dive.getBoundingClientRect().top + scrollY;
  buildIndex();
}

function loadImg(s) {
  if (s.img && s.img.dataset.src && !s.img.getAttribute("src")) s.img.src = s.img.dataset.src;
}

// Pinta una escena con la transformación T. parts: 0 (texto fuera) .. 1 (texto en su sitio).
function paint(s, T, { z, parts = 0, shade = parts, clip = "none", winOpen = 0, imgScale = 1 }) {
  const live = T.a > 0.995 && T.a < 1.005 ? "auto" : "none";
  for (const [el, zz] of [[s.el, z], [s.over, z + 10]]) {
    if (!el) continue;
    setStyle(el, "transform", css(T));
    setStyle(el, "zIndex", String(zz));
    setStyle(el, "opacity", "1");
    setStyle(el, "clipPath", clip);
    setStyle(el, "pointerEvents", live);
  }
  if (s.img) { loadImg(s); setStyle(s.img, "transform", `scale(${imgScale.toFixed(4)})`); }
  if (s.shadeEl) setStyle(s.shadeEl, "opacity", shade.toFixed(3));
  const n = s.parts.length;
  s.parts.forEach((p, j) => {
    // Escalonado: cada parte entra un poco después que la anterior.
    const d = n > 1 ? (0.35 * j) / (n - 1) : 0;
    const v = smooth(d, d + 0.65, parts);
    setStyle(p, "opacity", v.toFixed(3));
    setStyle(p, "transform", v >= 1 ? "none" : `translate3d(0, ${((1 - v) * 18).toFixed(1)}px, 0)`);
  });
  if (s.win) {
    setStyle(s.win, "opacity", winOpen > 0.001 ? "1" : "0");
    setStyle(s.win, "transform", `scale(${Math.max(0.0001, winOpen).toFixed(4)})`);
  }
}

function hide(s) {
  for (const el of [s.el, s.over]) {
    if (!el) continue;
    setStyle(el, "opacity", "0");
    setStyle(el, "zIndex", "0");
    setStyle(el, "pointerEvents", "none");
  }
}

// Recorte de la escena que se ve por la ventana, en sus propias coordenadas (la pantalla entera).
// open: 0..1 mientras la ventana se abre; melt: 0..1 mientras la forma se funde con la pantalla.
// pad: lo que se recorta de más por dentro (en px de la escena) para que el filete interior del
// marco se vea entero sobre la foto.
function clipFor(shape, open, melt, pad = 0) {
  const { sw, sh } = S;
  if (open >= 0.999 && melt >= 0.999) return "none";
  const o = Math.max(0.0001, open);
  const p = pad * (1 - melt);
  if (shape === "oval") {
    const k = o * (1 + 0.45 * melt);
    return `ellipse(${Math.max(0, k * sw / 2 - p).toFixed(1)}px ${Math.max(0, k * sh / 2 - p).toFixed(1)}px at 50% 50%)`;
  }
  const ix = ((1 - o) * sw) / 2 + p, iy = ((1 - o) * sh) / 2 + p;
  const R = shape === "arch" ? (o * sw / 2) * (1 - melt) : 0;
  return `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px ${iy.toFixed(1)}px ${ix.toFixed(1)}px round ${R.toFixed(1)}px ${R.toFixed(1)}px 0 0)`;
}

function frame({ y, t }) {
  if (!S || !S.moving) return;
  // Entrada: el arco de la portada se abre desde un punto (1,6 s, tras un respiro).
  if (S.intro < 1) S.intro = clamp((t - S.t0 - 250) / 1700);
  const { scenes, steps } = S;
  const N = scenes.length;
  const pos = clamp(y - S.top, 0, S.total);

  // Paso actual y en qué punto está.
  let k = steps.length - 1;
  for (let i = 0; i < steps.length; i++) if (pos < steps[i].start + steps[i].len) { k = i; break; }
  const st = steps[k];
  const u = Math.min(pos - st.start, st.len);
  const ended = pos >= steps[N - 1].start + steps[N - 1].len;
  const cur = scenes[k];
  const next = scenes[(k + 1) % N];
  const after = scenes[(k + 2) % N];

  const hold = st.H, openEnd = st.H + st.O;
  const open = cur.open0 ? easeInOut(S.intro) : easeInOut(span(hold, openEnd, u));
  const g = ended ? 1 : easeInOut(span(openEnd, st.len, u));
  const textOut = cur.open0 ? smooth(0, 0.55, g) : smooth(hold, hold + st.O * 0.75, u);

  // Cámara: entrar por la ventana de la escena actual.
  const s = Math.pow(1 / cur.r, g);
  const C = affine(s, cur.P.x * (1 - s), cur.P.y * (1 - s));
  const Tn = compose(C, cur.M);

  const visible = new Set([cur, next]);
  // La actual (si la cámara ya ha entrado del todo, ya no se ve).
  if (g < 0.999) {
    paint(cur, C, { z: 1, parts: 1 - textOut, winOpen: open, imgScale: 1 });
    if (cur.open0) heroPart(cur, g);
  } else hide(cur);

  // La siguiente, dentro de la ventana.
  const melt = smooth(0.35, 1, g);
  // Las escenas de texto se ven enteras dentro de la ventana (la siguiente página, en pequeño);
  // en las de foto, el pie aparece al llegar.
  const nextParts = next.kind === "title" ? 1 : smooth(0.6, 1, g);
  paint(next, Tn, {
    z: 2, parts: nextParts, shade: next.kind === "photo" ? Math.max(nextParts, 0.15) : 0,
    clip: clipFor(cur.shape, open, melt, 1.5 / Tn.a), winOpen: next.open0 ? 1 : 0, imgScale: 1 + 0.12 * (1 - g) + (cur.open0 ? 0.18 * (1 - easeInOut(S.intro)) : 0),
  });
  if (next.open0) heroPart(next, 0);

  // Si la siguiente ya tiene su ventana abierta (la portada), también la de después.
  if (next.open0) {
    visible.add(after);
    paint(after, compose(Tn, next.M), { z: 3, parts: after.kind === "title" ? 1 : 0, shade: 0.15, clip: clipFor(next.shape, 1, 0, 1.5 / (Tn.a * next.r)), imgScale: 1.12 });
  }
  scenes.forEach((x) => { if (!visible.has(x)) hide(x); });
  // Imágenes: se piden las de las dos escenas siguientes antes de llegar.
  loadImg(scenes[(k + 2) % N]); loadImg(scenes[(k + 3) % N]);

  // will-change solo mientras se mueve; al parar se quita y el navegador vuelve a pintar nítido.
  const busy = (u > hold && !ended) || (cur.open0 && g > 0);
  if (busy) {
    clearTimeout(S.idle);
    visible.forEach((x) => setStyle(x.el, "willChange", "transform"));
    S.idle = setTimeout(() => scenes.forEach((x) => setStyle(x.el, "willChange", "auto")), 200);
  }

  // Escena «actual» para el índice y el botón flotante.
  const shown = ended ? 0 : g > 0.5 ? (k + 1) % N : k;
  if (shown !== S.shown) {
    S.shown = shown;
    S.index.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === shown)));
  }
  pill(shown !== 0 && shown !== N - 1 && !ended);
}

// Portada: al entrar, los nombres se apartan (el de arriba sube, el de abajo baja).
function heroPart(s, g) {
  const e = smooth(0, 0.7, g);
  const away = e * S.sh * 0.32;
  s.parts.forEach((p) => {
    const side = p.dataset.part === "a" ? -1 : p.dataset.part === "b" ? 1 : 0;
    if (!side) return;
    setStyle(p, "opacity", (1 - smooth(0.15, 0.75, g)).toFixed(3));
    setStyle(p, "transform", `translate3d(0, ${(side * away).toFixed(1)}px, 0)`);
  });
}

function pill(show) {
  const p = document.querySelector(".rsvp-pill");
  if (!p || p._shown === show) return;
  p._shown = show;
  p.classList.toggle("is-shown", show);
  p.tabIndex = show ? 0 : -1;
  p.setAttribute("aria-hidden", String(!show));
}

// Índice: una raya por escena; tocarla lleva a esa escena ya quieta.
function buildIndex() {
  const { index, scenes } = S;
  if (index.childElementCount !== scenes.length) {
    index.innerHTML = scenes.map((s, i) => `<button type="button" data-go="${i}" aria-current="false"><span class="visually-hidden">${s.label}</span></button>`).join("");
  }
  S.shown = -1;
}

function goTo(i, smoothly = true) {
  const st = S.steps[i];
  if (!st) return;
  // Un poco después del principio del paso: la escena quieta y entera.
  scrollTo({ top: Math.round(S.top + st.start + Math.min(st.H * 0.4, 40)), behavior: smoothly && !isStill() ? "smooth" : "auto" });
}

const labelOf = (el) => {
  const id = el.getAttribute("aria-labelledby");
  const t = (id && document.getElementById(id)?.textContent) || el.getAttribute("aria-label") || "";
  return t.replace(/\s+/g, " ").trim().replace(/[<>&"]/g, "");
};

export function startMotion(main, config) {
  const dive = main.querySelector(".dive");
  const stage = dive.querySelector(".dive__stage");
  // Una escena puede llevar justo detrás una capa (.scene-over) que va con ella pero por encima
  // de la escena siguiente: los nombres de la portada no quedan tapados por la foto del arco.
  const scenes = [...stage.querySelectorAll(":scope > .scene")].map((el) => {
    const over = el.nextElementSibling?.classList.contains("scene-over") ? el.nextElementSibling : null;
    return {
      el, over, kind: el.dataset.kind, quick: "quick" in el.dataset, last: "last" in el.dataset, open0: el.dataset.open === "1",
      win: el.querySelector(".scene__window"),
      parts: [...el.querySelectorAll("[data-part]"), ...(over ? over.querySelectorAll("[data-part]") : [])],
      img: el.querySelector(".scene__img"), shadeEl: el.querySelector(".scene__shade"), label: labelOf(el),
    };
  });
  // Sin cierre, la última escena hace de cierre (su ventana enseña la portada).
  if (scenes.length && !scenes.some((s) => s.last)) scenes[scenes.length - 1].last = true;
  const index = dive.querySelector(".dive__index");
  S = { dive, stage, scenes, index, shown: -1, moving: false, intro: introPlayed || isStill() ? 1 : 0, t0: performance.now() };
  dive.classList.toggle("is-replay", introPlayed);
  introPlayed = true;

  if (!main._bound) {
    main._bound = true;
    // Clic en el índice.
    main.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]");
      if (b && S) return goTo(Number(b.dataset.go));
      const again = e.target.closest(".foot__again");
      if (again) { e.preventDefault(); scrollTo({ top: 0, behavior: isStill() ? "auto" : "smooth" }); }
    });
    // Con el tabulador a una escena que no se ve: la cámara va a ella.
    main.addEventListener("focusin", (e) => {
      if (!S?.moving) return;
      const el = e.target.closest(".scene");
      if (!el) return;
      const i = S.scenes.findIndex((s) => s.el === el);
      if (i >= 0 && i !== S.shown) goTo(i, false);
    });
  }

  run({ measure, frame, reset: () => { S && (S.shown = -1); }, animating: () => Boolean(S && S.moving && S.intro < 1) }, main);
}
