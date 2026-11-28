import { run, isStill, clamp, span } from "./loop.js";

// El hilo. Cada parte de la web (<section class="leg">) tiene su tramo: una curva suave que pasa
// por sus enganches ([data-hook]) y empieza justo donde acabó el tramo anterior, así de arriba
// abajo es un solo hilo. Al bajar, el hilo se cose hasta la «línea de la aguja» (un poco por
// debajo de la mitad de la pantalla) y una aguja va delante. La portada se cose sola al abrir la
// web: el hilo subraya un nombre, hace un nudo, subraya el otro y cuelga la foto.
//
// Solo se mueven stroke-dashoffset (un tramo cada vez), el transform de la aguja y clases que
// disparan transiciones de CSS. Con «reducir movimiento», todo sale ya cosido y quieto.

const PEN = 0.62;        // la aguja va a esta altura de la pantalla
const ACROSS = 0.5;      // lo horizontal cuesta la mitad de scroll que lo vertical
const INTRO_MS = 3000;   // lo que tarda en coserse la portada
const LAG_MS = 110;      // el hilo sigue al scroll con un poco de retraso: más fluido

let legs = [];
let page = null;
let needle = null;
let rises = [];
let names = [];
let hero = null;
let heroLeg = null;
let introStart = 0;
let introPlayed = false;
let still = false;
let busy = false;
let size = { vw: 0, vh: 0 };
let pageTop = 0;
let maxPen = 0;

// ---------- geometría ----------

// Posición de un elemento dentro de otro, sin contar transform (las fotos se balancean).
function offsetIn(el, root) {
  let x = 0, y = 0, n = el;
  while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const P = (x, y, extra) => ({ x, y, ...extra });
const mirror = (a, b) => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y });

// Catmull-Rom centrípeta → tramos de Bézier cúbica. Pasa exactamente por cada punto y no hace
// bucles raros cuando los puntos están muy juntos.
function spline(pts) {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const p0 = pts[i - 1] || mirror(p1, p2);
    const p3 = pts[i + 2] || mirror(p2, p1);
    const d1 = Math.max(Math.hypot(p1.x - p0.x, p1.y - p0.y) ** 0.5, 1e-3);
    const d2 = Math.max(Math.hypot(p2.x - p1.x, p2.y - p1.y) ** 0.5, 1e-3);
    const d3 = Math.max(Math.hypot(p3.x - p2.x, p3.y - p2.y) ** 0.5, 1e-3);
    const a = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2, an = 3 * d1 * (d1 + d2);
    const b = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2, bn = 3 * d3 * (d3 + d2);
    segs.push([
      p1,
      { x: (d1 * d1 * p2.x - d2 * d2 * p0.x + a * p1.x) / an, y: (d1 * d1 * p2.y - d2 * d2 * p0.y + a * p1.y) / an },
      { x: (d3 * d3 * p1.x - d2 * d2 * p3.x + b * p2.x) / bn, y: (d3 * d3 * p1.y - d2 * d2 * p3.y + b * p2.y) / bn },
      p2,
    ]);
  }
  return segs;
}

const bez = (s, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x, y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y };
};

// Muestras del tramo: posición, longitud y «esfuerzo» acumulados (lo que hay que bajar para coserlo).
function sample(segs) {
  const xs = [], ys = [], ls = [], es = [], at = [];
  let l = 0, e = 0, prev = segs[0][0];
  xs.push(prev.x); ys.push(prev.y); ls.push(0); es.push(0);
  for (const s of segs) {
    at.push(l);
    // Bastantes muestras: la aguja tiene que caer justo en la punta del hilo que pinta el navegador.
    const hull = Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y) + Math.hypot(s[2].x - s[1].x, s[2].y - s[1].y) + Math.hypot(s[3].x - s[2].x, s[3].y - s[2].y);
    const n = Math.ceil(clamp(hull / 2.5, 6, 400));
    for (let k = 1; k <= n; k++) {
      const p = bez(s, k / n);
      const dx = p.x - prev.x, dy = p.y - prev.y;
      l += Math.hypot(dx, dy);
      e += Math.max(dy, 0) + ACROSS * (Math.abs(dx) + Math.max(-dy, 0));
      xs.push(p.x); ys.push(p.y); ls.push(l); es.push(e);
      prev = p;
    }
  }
  at.push(l);
  return { xs, ys, ls, es, at, total: l };
}

const fmt = (v) => Math.round(v * 10) / 10;
const pathOf = (segs) => `M${fmt(segs[0][0].x)} ${fmt(segs[0][0].y)}` + segs.map((s) => `C${fmt(s[1].x)} ${fmt(s[1].y)} ${fmt(s[2].x)} ${fmt(s[2].y)} ${fmt(s[3].x)} ${fmt(s[3].y)}`).join("");

// Índice de muestra para una longitud (búsqueda binaria) y valor interpolado.
function find(arr, v) {
  let lo = 0, hi = arr.length - 1;
  if (v <= arr[0]) return 0;
  if (v >= arr[hi]) return hi - 1e-6;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; }
  return lo + (v - arr[lo]) / (arr[hi] - arr[lo] || 1);
}
const at = (arr, f) => { const i = Math.floor(f), t = f - i; return i + 1 < arr.length ? arr[i] + (arr[i + 1] - arr[i]) * t : arr[i]; };

// ---------- piezas del recorrido ----------

const railX = (vw) => (vw < 1000 ? Math.round(clamp(vw * 0.042, 13, 46)) : Math.max(56, Math.round((vw - 1240) / 2)));

// Bajar por el margen: un poco suelto, nunca recto del todo.
function descend(pts, x, y, inward) {
  const last = pts[pts.length - 1];
  const gap = y - last.y;
  if (gap > 160) {
    const n = Math.min(4, Math.floor(gap / 260) + 1);
    for (let k = 1; k <= n; k++) pts.push(P(x + inward * (k % 2 ? 5 : 1.5), last.y + (gap * k) / (n + 1)));
  }
  pts.push(P(x, y));
}

// Comba entre dos puntos colgados (el hilo pesa un poco).
function sag(pts, a, b) {
  const dx = Math.abs(b.x - a.x);
  if (dx < 34) return;
  pts.push(P((a.x + b.x) / 2, Math.max(a.y, b.y) + clamp(dx * 0.075, 5, 30)));
}

// Una vuelta alrededor de un punto (ojal, nudo). dir: hacia dónde va el hilo (+1 derecha, -1 izquierda).
function loop(pts, cx, cy, r, dir, mark) {
  pts.push(P(cx, cy - r, mark));
  pts.push(P(cx + dir * r, cy));
  pts.push(P(cx, cy + r));
  pts.push(P(cx - dir * r, cy));
  pts.push(P(cx + dir * r * 0.15, cy - r * 1.02));
}

// Lazo de dos orejas en b. dir: hacia dónde sigue el hilo después.
function bow(pts, b, w, h, dir, mark) {
  pts.push(P(b.x, b.y, mark));
  for (const s of [-dir, dir]) {
    pts.push(P(b.x + s * w * 0.55, b.y - h * 0.95));
    pts.push(P(b.x + s * w, b.y - h * 0.4));
    pts.push(P(b.x + s * w * 0.9, b.y + h * 0.25));
    pts.push(P(b.x + s * w * 0.3, b.y + h * 0.08));
    pts.push(P(b.x - s * 1.5, b.y + 0.5));
  }
}

// Enganches de una parte, en coordenadas de la parte.
function hooksOf(leg) {
  return [...leg.el.querySelectorAll("[data-hook]")].filter((h) => h.offsetParent).map((h) => {
    const r = offsetIn(h, leg.el);
    const type = h.dataset.hook;
    const y = type === "peg" ? r.y + r.h * 0.42 : r.y + r.h / 2;
    return { el: h, type, x: r.x + r.w / 2, y, r, item: h.closest("[data-hang]") || h };
  });
}

// Partes normales: el hilo baja por un margen, cruza de lado a lado por cada fila de enganches
// (colgando las fotos, atando las etiquetas) y sale por abajo por el margen al que llegó.
function buildRows(leg, hooks, W, H, xin) {
  const L = railX(W), R = W - L;
  const pts = [P(xin, 0)];
  let side = xin < W / 2 ? -1 : 1;
  const rows = [];
  for (const h of [...hooks].sort((a, b) => a.y - b.y)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(h.y - row[0].y) < 44) row.push(h); else rows.push([h]);
  }
  const s = W < 700 ? 1 : 1.25;
  for (const row of rows) {
    const from = side < 0 ? L : R, to = side < 0 ? R : L, dir = -side;
    row.sort((a, b) => (a.x - b.x) * dir);
    const lineY = Math.min(...row.map((h) => h.y));
    const enter = P(from, lineY - 14 * s);
    descend(pts, from, enter.y, dir);
    let prev = enter;
    for (const h of row) {
      sag(pts, prev, h);
      if (h.type === "hole") loop(pts, h.x, h.y + 7 * s, 7 * s, dir, { hook: h });
      else if (h.type === "bow") bow(pts, h, 32 * s, 21 * s, dir, { hook: h });
      else pts.push(P(h.x, h.y, { hook: h }));
      prev = h;
    }
    const exit = P(to, lineY - 14 * s);
    sag(pts, prev, exit);
    pts.push(exit);
    side = -side;
  }
  const x = side < 0 ? L : R;
  descend(pts, x, H, side < 0 ? 1 : -1);
  return { pts, end: H };
}

// Programa: el hilo va al centro y baja haciendo un nudo en cada hora.
function buildCord(leg, hooks, W, H, xin) {
  const L = railX(W), R = W - L;
  const knots = hooks.filter((h) => h.type === "knot").sort((a, b) => a.y - b.y);
  if (!knots.length) return buildRows(leg, [], W, H, xin);
  const s = W < 700 ? 1 : 1.2;
  const pts = [P(xin, 0)];
  const side = xin < W / 2 ? -1 : 1;
  const cx = knots[0].x;
  descend(pts, xin, knots[0].y - 120 * s, -side);
  pts.push(P(cx + side * 26, knots[0].y - 46 * s));
  knots.forEach((k, i) => {
    if (i) pts.push(P(cx + (i % 2 ? 2.5 : -2.5), (knots[i - 1].y + k.y) / 2));
    loop(pts, cx, k.y, 6 * s, i % 2 ? -1 : 1, { hook: k });
  });
  const last = knots[knots.length - 1];
  const out = side < 0 ? R : L;
  pts.push(P(cx, last.y + 44 * s));
  pts.push(P(out + side * 30, last.y + 120 * s));
  descend(pts, out, H, side);
  return { pts, end: H };
}

// Cierre: el hilo da una vuelta al botón y acaba en un lazo encima. Es el final del hilo.
function buildEnd(leg, hooks, W, H, xin) {
  const L = railX(W), R = W - L;
  const wrap = hooks.find((h) => h.type === "wrap");
  if (!wrap) return buildRows(leg, [], W, H, xin);
  const s = W < 700 ? 1 : 1.2;
  const { r } = wrap;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const rx = Math.min(r.w / 2 + 26 * s, W / 2 - L - 6), ry = r.h / 2 + 15 * s;
  const side = xin < W / 2 ? -1 : 1;
  const pts = [P(xin, 0)];
  descend(pts, xin, cy - 60, -side);
  pts.push(P(xin - side * 8, cy - 18));
  // Entra por el lado por el que viene, rodea el botón por debajo y sube hasta arriba.
  const a0 = side < 0 ? Math.PI : 0, step = side < 0 ? -1 : 1, N = 10;
  for (let k = 0; k < N; k++) {
    const a = a0 + step * k * (Math.PI * 1.5) / N;
    pts.push(P(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  // Arriba va hacia el lado contrario al que entró: ahí hace el lazo y deja la punta suelta.
  const dir = side;
  bow(pts, P(cx, cy - ry), 36 * s, 24 * s, dir, { hook: wrap, end: true });
  pts.push(P(cx + dir * 0.42 * rx, cy - ry - 4 * s));
  pts.push(P(cx + dir * 0.62 * rx, cy - ry + 9 * s));
  const end = pts[pts.length - 1].y;
  return { pts, end };
}

// Portada: subraya el primer nombre, nudo, subraya el segundo, rizo y baja a colgar la foto.
function buildHero(leg, hooks, W, H) {
  const L = railX(W), R = W - L;
  const box = (sel) => offsetIn(leg.el.querySelector(sel), leg.el);
  const A = box(".hero__name--a > span"), B = box(".hero__name--b > span");
  const K = hooks.find((h) => h.type === "knot-hero"), peg = hooks.find((h) => h.type === "peg");
  const print = peg ? offsetIn(peg.item, leg.el) : null;
  const fs = A.h;
  const uA = A.y + A.h * 0.9, uB = B.y + B.h * 0.9;
  const stacked = B.y > A.y + A.h * 0.5;
  const rk = clamp(fs * 0.13, 7, 17);
  const pts = [P(-30, uA - fs * 0.3)];
  pts.push(P(A.x - fs * 0.12, uA, { mark: "a0" }));
  pts.push(P(A.x + A.w * 0.55, uA + fs * 0.045));
  pts.push(P(A.x + A.w + fs * 0.06, uA - fs * 0.02, { mark: "a1" }));
  if (K && stacked) {
    // Nombres uno encima del otro: el hilo da la vuelta por la derecha, hace el nudo en el hueco
    // entre los dos nombres y vuelve por la izquierda para subrayar el segundo. Nunca los cruza.
    const gy = K.y;
    const turnR = Math.min(A.x + A.w + fs * 0.32, W - 10);
    const turnL = Math.max(B.x - fs * 0.3, 10);
    pts.push(P(turnR, (uA + gy - rk) / 2 + fs * 0.01));
    pts.push(P(Math.max(K.x + rk * 3, turnR - fs * 0.35), gy - rk));
    loop(pts, K.x, gy, rk, -1);
    pts.push(P(Math.min(K.x - rk * 3, turnL + fs * 0.35), gy - rk * 0.6));
    pts.push(P(turnL, (gy + uB) / 2 + fs * 0.05));
  } else if (K) {
    const ky = uA - rk;
    pts.push(P((A.x + A.w + K.x) / 2 + fs * 0.04, uA - rk * 0.2));
    loop(pts, K.x, ky, rk, 1);
  }
  pts.push(P(B.x - fs * 0.1, uB, { mark: "b0" }));
  pts.push(P(B.x + B.w * 0.5, uB + fs * 0.05));
  pts.push(P(B.x + B.w + fs * 0.04, uB - fs * 0.03, { mark: "b1" }));
  // Rizo al final del segundo nombre.
  const cr = clamp(fs * 0.16, 8, 20);
  const curlX = Math.min(B.x + B.w + fs * 0.2, W - cr - 4);
  pts.push(P(curlX, uB - cr * 0.6));
  pts.push(P(curlX - cr * 0.1, uB - cr * 1.7));
  pts.push(P(curlX - cr * 0.95, uB - cr * 1.05));
  pts.push(P(curlX - cr * 0.4, uB + cr * 0.35));
  let introEnd = null;
  if (print && peg) {
    const dy = peg.y - uB;
    pts.push(P(curlX - cr * 1.1, uB + dy * 0.55));
    pts.push(P(peg.x + Math.max(30, (curlX - peg.x) * 0.3), peg.y - Math.min(12, dy * 0.2)));
    pts.push(P(peg.x, peg.y, { hook: peg }));
    // Por detrás de la foto (no se ve) y sale por el lado derecho.
    pts.push(P(print.x + print.w * 0.7, print.y + print.h * 0.36, { mark: "hide" }));
    pts.push(P(print.x + print.w + 16, print.y + print.h * 0.52, { mark: "show" }));
    pts.push(P(Math.min(print.x + print.w + 58, (print.x + print.w + R) / 2 + 12), print.y + print.h * 0.6, { mark: "rest" }));
    descend(pts, R, H, -1);
  } else descend(pts, R, H, -1);
  return { pts, end: H, introEnd };
}

// ---------- medir ----------

function measure({ vw, vh }) {
  size = { vw, vh };
  still = isStill();
  page = document.querySelector(".page");
  if (!page) return;
  pageTop = page.getBoundingClientRect().top + scrollY;
  maxPen = document.documentElement.scrollHeight - vh + vh * PEN;
  const W = page.clientWidth;
  let xin = W - railX(W);
  legs.forEach((leg) => {
    const H = leg.el.offsetHeight;
    leg.top = leg.el.offsetTop;
    leg.h = H;
    const hooks = hooksOf(leg);
    const built = leg.kind === "hero" ? buildHero(leg, hooks, W, H)
      : leg.kind === "cord" ? buildCord(leg, hooks, W, H, xin)
      : leg.kind === "end" ? buildEnd(leg, hooks, W, H, xin)
      : buildRows(leg, hooks, W, H, xin);
    const segs = spline(built.pts);
    const smp = sample(segs);
    leg.s = smp;
    const d = pathOf(segs);
    leg.line.setAttribute("d", d);
    leg.shade.setAttribute("d", d);
    // Longitud de cada enganche y marca (los puntos son los extremos de los tramos).
    leg.marks = {};
    leg.hooks = [];
    built.pts.forEach((p, i) => {
      const l = smp.at[i];
      if (p.mark) leg.marks[p.mark] = l;
      if (p.hook) leg.hooks.push({ l, item: p.hook.item, el: p.hook.el });
      if (p.end) leg.marks.end = l;
    });
    // Tramo de scroll que lo cose: de que su principio llega a la aguja a que llega su final.
    leg.penA = pageTop + leg.top;
    leg.penB = pageTop + leg.top + built.end;
    if (leg.penB > maxPen - 8) { leg.penB = maxPen - 8; leg.penA = Math.min(leg.penA, leg.penB - Math.max(200, vh * 0.3)); }
    xin = smp.xs[smp.xs.length - 1];
    if (leg.kind === "hero") {
      leg.introEnd = leg.marks.rest ?? smp.total * 0.8;
      leg.penA = pageTop + vh * PEN + 1;
      leg.penB = Math.max(leg.penA + 120, pageTop + leg.top + H);
    }
    if (still) leg.drawn = smp.total;
    else if (leg.drawn > smp.total) leg.drawn = smp.total;
    leg.drawn ??= 0;
    leg.painted = -1;
  });
  // Nombres de la portada: se escriben a la vez que el hilo pasa por debajo.
  heroLeg = legs.find((l) => l.kind === "hero") || null;
  names = heroLeg ? [["a0", "a1", ".hero__name--a"], ["b0", "b1", ".hero__name--b"]].map(([a, b, sel]) => ({
    el: heroLeg.el.querySelector(sel), a: heroLeg.marks[a] ?? 0, b: heroLeg.marks[b] ?? 1, p: -1,
  })) : [];
  rises = [...page.querySelectorAll("[data-rise]")].map((el) => ({ el, y: pageTop + offsetIn(el, page).y, up: el.classList.contains("is-up") }));
  if (still) {
    rises.forEach((r) => r.el.classList.add("is-up"));
    page.querySelectorAll("[data-hang], [data-hook], [data-knot-note]").forEach((el) => el.classList.add("is-on"));
    hero?.classList.add("is-ready", "is-done");
    names.forEach((n) => n.el.style.setProperty("--p", 1));
    needle?.classList.remove("is-on");
  }
}

// ---------- pintar ----------

function paint(leg) {
  const f = leg.s.total ? leg.drawn / leg.s.total : 0;
  if (Math.abs(f - leg.painted) < 0.0004 && !(f >= 1 && leg.painted < 1)) return;
  leg.painted = f;
  const off = f >= 0.999 ? 0 : 1 - f;
  leg.line.style.strokeDashoffset = off;
  leg.shade.style.strokeDashoffset = off;
  leg.svg.classList.toggle("is-empty", f < 0.001);
  for (const h of leg.hooks) {
    if (h.l <= leg.drawn + 1 && !h.on) { h.on = true; h.item.classList.add("is-on"); if (h.el !== h.item) h.el.classList.add("is-on"); }
  }
}

function tipOf(leg) {
  const { xs, ys, ls } = leg.s;
  const f = find(ls, leg.drawn);
  const i = Math.floor(f);
  const a = Math.max(0, i - 2), b = Math.min(xs.length - 1, i + 3);
  return { x: at(xs, f), y: at(ys, f), angle: Math.atan2(ys[b] - ys[a], xs[b] - xs[a]) };
}

let needleShown = false;
function placeNeedle(t) {
  if (!needle) return;
  let front = -1;
  for (let i = 0; i < legs.length; i++) if (legs[i].drawn > 0.5) front = i;
  const leg = legs[front];
  let show = Boolean(leg) && !still;
  if (show) {
    const done = leg.drawn >= leg.s.total - 0.5;
    if (done && front === legs.length - 1) show = false;
    const m = leg.marks;
    if (m.hide != null && leg.drawn > m.hide + 2 && leg.drawn < m.show - 2) show = false;
    if (show) {
      const p = tipOf(leg);
      needle.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(leg.top + p.y).toFixed(1)}px, 0) rotate(${p.angle.toFixed(3)}rad)`;
    }
  }
  if (show !== needleShown) { needleShown = show; needle.classList.toggle("is-on", show); }
}

function frame({ y, vh, t, dt }) {
  if (!legs.length) return;
  if (still) { legs.forEach(paint); return; }
  const pen = y + vh * PEN;
  const k = 1 - Math.exp(-dt / LAG_MS);
  busy = false;
  for (const leg of legs) {
    const { total, es, ls } = leg.s;
    let target;
    if (leg.kind === "hero") {
      if (!introStart) introStart = t;
      const p = introPlayed ? 1 : clamp((t - introStart - 250) / INTRO_MS);
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const intro = leg.introEnd * eased;
      if (p >= 1 && !introPlayed) { introPlayed = true; hero?.classList.add("is-done"); }
      const tail = leg.introEnd + (total - leg.introEnd) * span(leg.penA, leg.penB, pen);
      target = p < 1 ? intro : Math.max(leg.introEnd, tail);
      if (p < 1) { leg.drawn = target; busy = true; }
    } else {
      const e = es[es.length - 1] * span(leg.penA, leg.penB, pen);
      target = at(ls, find(es, e));
    }
    const diff = target - leg.drawn;
    if (Math.abs(diff) > 0.4) { leg.drawn += diff * k; busy = true; } else leg.drawn = target;
    paint(leg);
  }
  for (const n of names) {
    const p = clamp((heroLeg.drawn - n.a) / (n.b - n.a || 1));
    if (Math.abs(p - n.p) > 0.002 || (p === 1 && n.p !== 1)) { n.p = p; n.el.style.setProperty("--p", p.toFixed(3)); }
  }
  for (const r of rises) if (!r.up && r.y < y + vh * 0.9) { r.up = true; r.el.classList.add("is-up"); }
  const last = legs[legs.length - 1];
  if (last.kind === "end" && last.drawn >= last.s.total - 1) page.querySelectorAll("[data-knot-note]").forEach((el) => el.classList.add("is-on"));
  placeNeedle(t);
}

export function startMotion(root) {
  page = root.querySelector(".page");
  needle = root.querySelector(".needle");
  hero = root.querySelector(".hero");
  legs = [...root.querySelectorAll(".leg")].map((el) => ({
    el,
    kind: el.dataset.leg,
    svg: el.querySelector(".thread"),
    line: el.querySelector(".thread__line"),
    shade: el.querySelector(".thread__shade"),
    drawn: 0,
  }));
  // La portada solo se cose sola la primera vez (en la vista previa la web se vuelve a pintar
  // con cada cambio y no debe repetirse).
  introStart = 0;
  if (introPlayed) hero?.classList.add("is-ready", "is-done");
  else requestAnimationFrame(() => hero?.classList.add("is-ready"));
  run({ measure, frame, animating: () => busy, reset: () => { legs.forEach((l) => { l.drawn = 0; }); } }, root);
}
