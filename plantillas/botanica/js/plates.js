// Láminas de herbario dibujadas en SVG, como grabados de un libro antiguo de botánica.
// Cada lámina tiene dos capas:
//  · .plate__ink: el grabado a línea fina (contornos, nervios y rayado de sombra). Cada trazo
//    lleva pathLength="1" y un retardo --d (0…1) para dibujarse en orden con stroke-dasharray.
//  · .plate__wash: las aguadas planas con que se iluminaban a mano las láminas, un poco
//    desplazadas del dibujo (como el color puesto a pincel sobre la estampa).
// Todo se genera con geometría determinista: la misma lámina sale siempre igual.

const f = (n) => String(Math.round(n * 10) / 10);
const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Generador pseudoaleatorio con semilla (mulberry32): pequeñas irregularidades, siempre iguales.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}
function cubicTan(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return Math.atan2(y, x);
}

// Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier).
function smooth(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
const poly = (segs) => segs.map(([a, b]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`).join("");

// Colores de las aguadas (pigmentos apagados, como acuarela vieja sobre papel).
export const WASH = {
  leaf: "#7f9466",
  olive: "#97a383",
  sage: "#9aa68c",
  stem: "#8c7a55",
  wood: "#86684a",
  bloom: "#fbf7ec",
  pollen: "#d9b04a",
  orange: "#dd8a3c",
  lavender: "#8e7cbf",
  calyx: "#7b6d9c",
  ripe: "#4e4537",
  green: "#9aa154",
  red: "#b9473a",
  crimson: "#9a3b2e",
  aril: "#c2403a",
};

class Plate {
  constructor(seed = 1) {
    this.ink = [];
    this.wash = [];
    this.dots = [];
    this.rand = rng(seed);
  }
  line(d, delay, cls = "") {
    this.ink.push(`<path${cls ? ` class="${cls}"` : ""} pathLength="1" style="--d:${clamp01(delay).toFixed(3)}" d="${d}"/>`);
  }
  fill(d, color, opacity) {
    this.wash.push(`<path d="${d}" fill="${color}"${opacity != null ? ` fill-opacity="${opacity}"` : ""}/>`);
  }
  dot(x, y, r = 0.55) {
    this.dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`);
  }

  // Tallo que se estrecha hacia la punta: dos líneas de contorno y corte oblicuo en la base.
  // Devuelve at(t) para colgar hojas, flores y frutos a lo largo de la curva.
  stem(p0, p1, p2, p3, { w0 = 4, w1 = 1.4, delay = 0, color = WASH.stem, cut = true, ticks = true } = {}) {
    const N = 22, L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = cubic(p0, p1, p2, p3, t), a = cubicTan(p0, p1, p2, p3, t);
      const w = (w0 + (w1 - w0) * t) / 2, nx = -Math.sin(a), ny = Math.cos(a);
      L.push([p[0] + nx * w, p[1] + ny * w]);
      R.push([p[0] - nx * w, p[1] - ny * w]);
    }
    const tip = cubic(p0, p1, p2, p3, 1);
    this.fill(`${smooth(L)}L${f(tip[0])} ${f(tip[1])}${smooth([...R].reverse()).replace(/^M/, "L")}Z`, color, 0.8);
    this.line(smooth(L), delay);
    this.line(smooth(R), delay + 0.02);
    if (cut) this.line(`M${f(L[0][0])} ${f(L[0][1] + 1.6)}L${f(R[0][0])} ${f(R[0][1] - 1.6)}`, delay);
    // Sombra del tallo: rayitas cortas pegadas al lado en sombra.
    if (ticks && w0 > 2.6) {
      const segs = [];
      for (let i = 1; i < N - 4; i++) {
        const w = w0 + (w1 - w0) * (i / N);
        if (w < 2.4) break;
        segs.push([lerp(R[i], L[i], 0.08), lerp(R[i], L[i], 0.34)]);
      }
      if (segs.length) this.line(poly(segs), delay + 0.12, "h");
    }
    return {
      at: (t) => { const p = cubic(p0, p1, p2, p3, t); return { x: p[0], y: p[1], a: (cubicTan(p0, p1, p2, p3, t) * 180) / Math.PI }; },
    };
  }

  // Hoja (o pétalo) con contorno, nervio central, nervios secundarios y rayado en el lado en sombra.
  // x, y: base; a: ángulo en grados; L: largo; W: medio ancho.
  leaf(x, y, a, L, W, o = {}) {
    const { curl = 0, delay = 0, color = WASH.leaf, opacity = 0.82, shade = 1, pet = 3, veins = 4, hatch = true,
      shape = "leaf", rib = true, spacing = 2.3 } = o;
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    const T = ([px, py]) => [x + px * c - py * s, y + px * s + py * c];
    const P = (p) => { const q = T(p); return `${f(q[0])} ${f(q[1])}`; };
    const tip = [L, curl * L];
    // Formas: hoja lanceolada (leaf), pétalo redondeado (petal) o aguja estrecha (linear).
    const k = shape === "petal" ? [0.08, 1.15, 1.02, 1.1] : shape === "linear" ? [0.15, 1.1, 0.8, 1.0] : [0.22, 1.3, 0.68, 1.05];
    const t1 = [L * k[0], -W * k[1]], t2 = [L * k[2], -W * k[3] + curl * L * 0.55];
    const b2 = [L * k[2], W * k[3] + curl * L * 0.55], b1 = [L * k[0], W * k[1]];
    const outline = `M${P([0, 0])}C${P(t1)} ${P(t2)} ${P(tip)}C${P(b2)} ${P(b1)} ${P([0, 0])}Z`;
    this.fill(outline, color, opacity);
    this.line(outline, delay);
    const ribY = (px) => { const t = px / (L * 0.97); return 2 * (1 - t) * t * 0.25 * curl * L + t * t * 0.95 * curl * L; };
    if (rib) this.line(`M${P([-pet, 0])}L${P([0, 0])}Q${P([L * 0.5, curl * L * 0.25])} ${P([L * 0.94, curl * L * 0.9])}`, delay + 0.03, "v");
    if (W < 2.2) return;
    // Bordes muestreados: el lado en sombra se raya; el otro lleva los nervios.
    const side = (sign, n) => {
      const out = [];
      for (let i = 1; i < n; i++) {
        const t = i / n;
        out.push(sign > 0 ? cubic(tip, b2, b1, [0, 0], 1 - t) : cubic([0, 0], t1, t2, tip, t));
      }
      return out;
    };
    if (hatch) {
      const edge = side(shade, Math.max(12, Math.round(L / 1.2)));
      const segs = [];
      let last = -99;
      for (const e of edge) {
        if (e[0] < L * 0.1 || e[0] > L * 0.9 || e[0] - last < spacing) continue;
        last = e[0];
        const ym = ribY(e[0]), h = Math.abs(e[1] - ym);
        if (h < 1.2) continue;
        const m = [e[0] - h * 0.32, ym];
        segs.push([T(lerp(m, e, 0.16)), T(lerp(m, e, 0.84))]);
      }
      if (segs.length) this.line(poly(segs), delay + 0.1, "h");
    }
    if (veins) {
      const edge = side(-shade, 40), out = [];
      for (let i = 0; i < veins; i++) {
        const px = L * (0.16 + (0.66 * i) / Math.max(1, veins - 1) * 0.92);
        const e = edge.reduce((best, p) => (Math.abs(p[0] - (px + L * 0.16)) < Math.abs(best[0] - (px + L * 0.16)) ? p : best), edge[0]);
        const m = [px, ribY(px)], end = lerp(m, e, 0.78);
        const ctrl = [px + (end[0] - px) * 0.25, m[1] + (end[1] - m[1]) * 0.7];
        out.push(`M${P(m)}Q${P(ctrl)} ${P(end)}`);
      }
      this.line(out.join(""), delay + 0.08, "v");
    }
  }

  // Fruto o baya: elipse con sombra en media luna (rayado) y, si se pide, contra-rayado y punteado.
  ball(cx, cy, rx, ry, rot, { color, delay = 0, cross = true, spacing = 2.1, stipple = 0, opacity = 0.85, highlight = true } = {}) {
    const c = Math.cos(rad(rot)), s = Math.sin(rad(rot));
    const T = ([u, v]) => [cx + u * rx * c - v * ry * s, cy + u * rx * s + v * ry * c];
    const a = T([-1, 0]), b = T([1, 0]);
    const outline = `M${f(a[0])} ${f(a[1])}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${f(b[0])} ${f(b[1])}A${f(rx)} ${f(ry)} ${f(rot)} 1 1 ${f(a[0])} ${f(a[1])}Z`;
    this.fill(outline, color, opacity);
    if (highlight) {
      const h = T([-0.38, -0.42]);
      this.wash.push(`<ellipse cx="${f(h[0])}" cy="${f(h[1])}" rx="${f(rx * 0.26)}" ry="${f(ry * 0.18)}" transform="rotate(${f(rot - 35)} ${f(h[0])} ${f(h[1])})" fill="#fff" fill-opacity=".35"/>`);
    }
    this.line(outline, delay);
    // Luz de arriba a la izquierda: la sombra es lo que queda fuera de un círculo desplazado hacia la luz.
    const hatchSet = (angle, litR, step) => {
      const n = [Math.cos(rad(angle)), Math.sin(rad(angle))], perp = [-n[1], n[0]];
      const lc = [-0.72 * 0.4, -0.7 * 0.4];
      const segs = [];
      for (let d = -0.2; d < 0.97; d += step) {
        const h = Math.sqrt(Math.max(0, 1 - d * d)) * 0.93;
        let run = null;
        for (let i = 0; i <= 28; i++) {
          const sv = -h + (2 * h * i) / 28;
          const q = [n[0] * d + perp[0] * sv, n[1] * d + perp[1] * sv];
          const out = Math.hypot(q[0] - lc[0], q[1] - lc[1]) > litR;
          if (out && !run) run = [q, q];
          else if (out) run[1] = q;
          if ((!out || i === 28) && run) { if (Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]) > 0.08) segs.push([T(run[0]), T(run[1])]); run = null; }
        }
      }
      return segs;
    };
    const step = spacing / Math.max(rx, ry);
    const main = hatchSet(45, 1.0, step);
    if (main.length) this.line(poly(main), delay + 0.12, "h");
    if (cross) {
      const deep = hatchSet(-20, 1.22, step * 1.25);
      if (deep.length) this.line(poly(deep), delay + 0.22, "h");
    }
    for (let i = 0; i < stipple; i++) {
      const ang = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * 0.9;
      const u = Math.cos(ang) * r, v = Math.sin(ang) * r;
      if (u + v < -0.2) continue; // el punteado (poros de la piel) solo en la parte en sombra
      const p = T([u, v]);
      this.dot(p[0], p[1], 0.42);
    }
  }

  render({ cls = "", label = "", viewBox = "0 0 320 440" } = {}) {
    return `<svg class="plate ${cls}" viewBox="${viewBox}" ${label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`} focusable="false">
      <g class="plate__wash" transform="translate(1.3 .9)">${this.wash.join("")}</g>
      <g class="plate__ink">${this.ink.join("")}</g>
      <g class="plate__dots">${this.dots.join("")}</g>
    </svg>`;
  }
}

/* ---------------- Flores, frutos y espigas ---------------- */

// Flor de azahar vista de frente: cinco pétalos carnosos, estambres y disco amarillo.
function blossom(p, x, y, r, rot, delay) {
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 72 + (p.rand() - 0.5) * 10;
    p.leaf(x, y, a, r, r * 0.36, { shape: "petal", color: WASH.bloom, opacity: 0.95, delay: delay + i * 0.015, pet: 0, veins: 2, spacing: 2, shade: i % 2 ? 1 : -1 });
  }
  const segs = [];
  for (let i = 0; i < 12; i++) {
    const a = rad(rot + i * 30 + 8), r0 = r * 0.14, r1 = r * (0.42 + (i % 3) * 0.06);
    const e = [x + Math.cos(a) * r1, y + Math.sin(a) * r1];
    segs.push([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], e]);
    p.dot(e[0], e[1], 0.85);
  }
  p.wash.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.38)}" fill="${WASH.pollen}" fill-opacity=".85"/>`);
  p.line(poly(segs), delay + 0.12, "v");
  p.line(`M${f(x - r * 0.12)} ${f(y)}a${f(r * 0.12)} ${f(r * 0.12)} 0 1 0 ${f(r * 0.24)} 0a${f(r * 0.12)} ${f(r * 0.12)} 0 1 0 ${f(-r * 0.24)} 0`, delay + 0.1);
}

// Capullo cerrado con su cáliz.
function bud(p, x, y, a, len, delay, color = WASH.bloom) {
  p.leaf(x, y, a, len, len * 0.3, { shape: "petal", color, opacity: 0.95, delay, pet: 0, veins: 0, spacing: 1.8 });
  for (const s of [-1, 1]) p.leaf(x, y, a + s * 28, len * 0.32, len * 0.12, { color: WASH.leaf, delay: delay + 0.02, pet: 0, veins: 0, hatch: false, rib: false });
}

// Espiga de lavanda: verticilos de cálices que se hacen pequeños hacia la punta.
function spike(p, st, t0, n, size, delay) {
  for (let i = 0; i < n; i++) {
    const t = t0 + ((1 - t0) * i) / (n - 1);
    const q = st.at(t), k = 1 - (i / n) * 0.55, len = size * k;
    const d = delay + i * 0.03;
    const sides = i === n - 1 ? [0] : [-1, 1, ...(i % 2 ? [0] : [])];
    for (const sgn of sides) {
      const a = q.a + sgn * 32 - (sgn === 0 ? 0 : 0);
      p.leaf(q.x, q.y, a, len, len * 0.34, { shape: "petal", color: WASH.calyx, opacity: 0.75, delay: d, pet: 0, veins: 0, spacing: 1.5, shade: sgn || 1, rib: false });
      const tipx = q.x + Math.cos(rad(a)) * len, tipy = q.y + Math.sin(rad(a)) * len;
      const cr = len * 0.24;
      p.wash.push(`<circle cx="${f(tipx)}" cy="${f(tipy)}" r="${f(cr * 1.25)}" fill="${WASH.lavender}" fill-opacity=".9"/>`);
      p.line(`M${f(tipx - cr)} ${f(tipy)}a${f(cr)} ${f(cr)} 0 1 1 ${f(cr * 2)} 0a${f(cr)} ${f(cr)} 0 1 1 ${f(-cr * 2)} 0`, d + 0.05, "v");
    }
  }
}

// Aceituna colgando de su pedúnculo.
function olive(p, x, y, a, size, ripe, delay) {
  const len = size * 0.9;
  const ex = x + Math.cos(rad(a)) * len, ey = y + Math.sin(rad(a)) * len;
  p.line(`M${f(x)} ${f(y)}Q${f(x + Math.cos(rad(a - 20)) * len * 0.6)} ${f(y + Math.sin(rad(a - 20)) * len * 0.6)} ${f(ex)} ${f(ey)}`, delay, "v");
  const cx = ex + Math.cos(rad(a)) * size * 1.25, cy = ey + Math.sin(rad(a)) * size * 1.25;
  p.ball(cx, cy, size * 0.78, size * 1.12, a - 90, { color: ripe ? WASH.ripe : WASH.green, delay: delay + 0.04, spacing: 1.5, cross: ripe });
}

/* ---------------- Las láminas ---------------- */

function olivo({ small = false } = {}) {
  const p = new Plate(11);
  const main = p.stem([70, 432], [110, 330], [150, 210], [262, 58], { w0: 6.5, w1: 1.8, color: WASH.wood });
  const twig = p.stem([126, 300], [92, 250], [70, 200], [52, 120], { w0: 3.2, w1: 1.2, delay: 0.12, color: WASH.wood, cut: false });
  const twig2 = p.stem([160, 205], [200, 200], [240, 210], [286, 186], { w0: 2.8, w1: 1.1, delay: 0.2, color: WASH.wood, cut: false });
  const pairs = (st, from, to, n, L, d0) => {
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1), q = st.at(t), len = L * (1 - i * 0.03);
      for (const sgn of [-1, 1]) {
        const a = q.a + sgn * (38 + p.rand() * 14);
        p.leaf(q.x, q.y, a, len, len * 0.115, { curl: sgn * 0.05 * (p.rand() + 0.4), color: WASH.olive, delay: d0 + t * 0.45, shade: sgn, veins: 0, spacing: 1.9, shape: "leaf" });
      }
    }
    const end = st.at(1);
    p.leaf(end.x, end.y, end.a, L * 0.7, L * 0.08, { color: WASH.olive, delay: d0 + 0.5, veins: 0 });
  };
  pairs(main, 0.42, 0.93, 6, 54, 0.12);
  pairs(twig, 0.35, 0.9, 3, 44, 0.22);
  pairs(twig2, 0.3, 0.86, 3, 42, 0.3);
  const twig3 = p.stem([214, 128], [196, 100], [172, 76], [142, 38], { w0: 2.4, w1: 1, delay: 0.3, color: WASH.wood, cut: false });
  pairs(twig3, 0.3, 0.85, 3, 38, 0.36);
  // Aceitunas, maduras y verdes, colgando a lo largo de las ramas.
  for (const [st, t, a, sz, ripe, d] of [
    [main, 0.5, 100, 11, true, 0.5], [main, 0.5, 70, 10, true, 0.54], [main, 0.74, 95, 10.5, false, 0.6],
    [twig, 0.55, 120, 10, true, 0.56], [twig2, 0.45, 85, 10, true, 0.62], [twig2, 0.45, 115, 9, false, 0.64],
  ]) { const q = st.at(t); olive(p, q.x, q.y, a, sz, ripe, d); }
  return p.render({ cls: small ? "plate--small" : "" });
}

function azahar() {
  const p = new Plate(23);
  const main = p.stem([112, 434], [128, 330], [96, 220], [140, 92], { w0: 5.5, w1: 2, color: WASH.stem });
  const side = p.stem([116, 300], [168, 276], [214, 236], [250, 160], { w0: 3.6, w1: 1.6, delay: 0.14, color: WASH.stem, cut: false });
  const big = (st, t, sgn, L, d) => {
    const q = st.at(t), a = q.a + sgn * (52 + p.rand() * 10);
    // Peciolo alado del naranjo: una pequeña hoja antes de la hoja.
    p.leaf(q.x, q.y, a, 10, 3.4, { color: WASH.leaf, delay: d, veins: 0, hatch: false, pet: 0 });
    const bx = q.x + Math.cos(rad(a)) * 10, by = q.y + Math.sin(rad(a)) * 10;
    p.leaf(bx, by, a + sgn * 6, L, L * 0.25, { curl: sgn * 0.07, color: WASH.leaf, delay: d + 0.02, shade: -sgn, veins: 5, pet: 0 });
  };
  big(main, 0.06, 1, 58, 0.12);
  big(main, 0.16, -1, 70, 0.15);
  big(main, 0.27, 1, 54, 0.2);
  big(main, 0.36, -1, 64, 0.22);
  big(main, 0.55, 1, 58, 0.3);
  big(main, 0.72, -1, 56, 0.36);
  big(main, 0.86, 1, 44, 0.42);
  big(side, 0.8, 1, 42, 0.4);
  // Naranja amarga colgando de la rama lateral.
  const fq = side.at(0.55);
  p.line(`M${f(fq.x)} ${f(fq.y)}Q${f(fq.x + 6)} ${f(fq.y + 18)} ${f(fq.x + 4)} ${f(fq.y + 34)}`, 0.42, "v");
  p.ball(fq.x + 5, fq.y + 63, 30, 29, 0, { color: WASH.orange, delay: 0.46, stipple: 170, spacing: 2.2 });
  p.leaf(fq.x + 4, fq.y + 34, 205, 8, 3.2, { color: WASH.leaf, delay: 0.46, veins: 0, hatch: false, pet: 0 });
  p.leaf(fq.x + 4, fq.y + 34, -25, 8, 3.2, { color: WASH.leaf, delay: 0.46, veins: 0, hatch: false, pet: 0 });
  // Ramillete de flores y capullos en las puntas.
  const top = main.at(1), st = side.at(1);
  bud(p, top.x, top.y, -70, 20, 0.5);
  bud(p, top.x, top.y, -130, 16, 0.52);
  p.line(`M${f(top.x)} ${f(top.y)}Q${f(top.x - 20)} ${f(top.y - 10)} ${f(top.x - 34)} ${f(top.y - 20)}`, 0.5, "v");
  p.line(`M${f(top.x)} ${f(top.y)}Q${f(top.x + 16)} ${f(top.y - 4)} ${f(top.x + 34)} ${f(top.y + 6)}`, 0.5, "v");
  blossom(p, top.x - 40, top.y - 24, 26, 10, 0.55);
  blossom(p, top.x + 42, top.y + 8, 22, 40, 0.6);
  p.line(`M${f(st.x)} ${f(st.y)}Q${f(st.x + 4)} ${f(st.y - 14)} ${f(st.x + 12)} ${f(st.y - 24)}`, 0.56, "v");
  blossom(p, st.x + 14, st.y - 30, 24, -20, 0.62);
  bud(p, st.x, st.y, 160, 15, 0.66);
  bud(p, st.x, st.y, 30, 14, 0.68);
  return p.render();
}

function lavanda() {
  const p = new Plate(37);
  const stems = [
    [[150, 434], [152, 330], [126, 210], [96, 58], 13],
    [[160, 434], [166, 320], [184, 190], [200, 26], 14],
    [[156, 434], [178, 340], [228, 230], [262, 96], 12],
    [[152, 434], [136, 350], [100, 270], [52, 168], 9],
  ];
  stems.forEach(([a, b, c, d, n], i) => {
    const st = p.stem(a, b, c, d, { w0: 3.4, w1: 1.3, delay: i * 0.06, color: WASH.sage, cut: true, ticks: false });
    spike(p, st, 0.56, n, 13, 0.3 + i * 0.05);
    // Hojas lineares, grises, opuestas en la parte baja del tallo.
    for (const [t, L] of [[0.12, 58], [0.26, 46], [0.4, 32]]) {
      const q = st.at(t);
      for (const sgn of [-1, 1]) p.leaf(q.x, q.y, q.a + sgn * (16 + p.rand() * 10), L * (0.85 + p.rand() * 0.25), 2.6, { shape: "linear", color: WASH.sage, delay: 0.1 + t * 0.4 + i * 0.04, veins: 0, curl: sgn * 0.04, hatch: false });
    }
  });
  return p.render();
}

function granado() {
  const p = new Plate(53);
  const main = p.stem([262, 434], [244, 330], [160, 200], [70, 96], { w0: 6, w1: 1.8, color: WASH.wood });
  const twig = p.stem([206, 290], [236, 240], [258, 190], [262, 110], { w0: 3, w1: 1.2, delay: 0.14, color: WASH.wood, cut: false });
  // Hojas oblongas en pequeños manojos.
  const tuft = (st, t, d) => {
    const q = st.at(t);
    [-62, -30, 34, 66].forEach((off, i) => p.leaf(q.x, q.y, q.a + off + (p.rand() - 0.5) * 12, 30 + p.rand() * 10, 6.4, { color: WASH.leaf, delay: d + i * 0.015, curl: (off > 0 ? 1 : -1) * 0.05, shade: off > 0 ? 1 : -1, veins: 3, spacing: 2 }));
  };
  tuft(main, 0.22, 0.16); tuft(main, 0.6, 0.24); tuft(main, 0.82, 0.32); tuft(twig, 0.45, 0.3); tuft(twig, 0.8, 0.36);
  // Flores: cáliz en forma de jarrita rojo coral y pétalos arrugados.
  const flower = (q, k, d) => {
    p.leaf(q.x, q.y, q.a - 30, 10 * k, 2.2 * k, { color: WASH.wood, delay: d, veins: 0, hatch: false });
    const fx = q.x - 6 * k, fy = q.y - 8 * k;
    const P = (x, y) => `${f(fx + x * k)} ${f(fy + y * k)}`;
    const vase = `M${P(0, 14)}C${P(-9, 6)} ${P(-10, -6)} ${P(-12, -16)}L${P(-7, -11)}L${P(-4, -19)}L${P(0, -12)}L${P(4, -19)}L${P(7, -11)}L${P(12, -16)}C${P(10, -6)} ${P(9, 6)} ${P(0, 14)}Z`;
    for (const [a, L] of [[-130, 20], [-90, 23], [-52, 20]]) p.leaf(fx, fy - 12 * k, a, L * k, 8 * k, { shape: "petal", color: WASH.red, opacity: 0.85, delay: d + 0.04, veins: 3, pet: 0, spacing: 1.8 });
    p.fill(vase, WASH.crimson, 0.85);
    p.line(vase, d + 0.02);
    p.line(`M${P(-5, 8)}L${P(-7, -8)}M${P(-2, 10)}L${P(-3, -8)}M${P(2, 10)}L${P(3, -6)}`, d + 0.1, "h");
  };
  flower(main.at(1), 1.5, 0.5);
  flower(twig.at(1), 1.05, 0.56);
  // La granada, con su corona.
  const g = main.at(0.42);
  // Cuelga a la izquierda de la rama, para que el tallo no la cruce.
  p.line(`M${f(g.x)} ${f(g.y)}Q${f(g.x - 26)} ${f(g.y + 2)} ${f(g.x - 40)} ${f(g.y + 24)}`, 0.4, "v");
  const gx = g.x - 44, gy = g.y + 66, R = 42;
  p.ball(gx, gy, R, R * 0.96, -8, { color: WASH.red, delay: 0.44, spacing: 2.2, stipple: 60 });
  // Cuelga: la corona (el cáliz) queda abajo, en el extremo opuesto al pedúnculo.
  const by = gy + R * 0.96;
  const crown = `M${f(gx - 10)} ${f(by - 6)}L${f(gx - 13)} ${f(by + 12)}L${f(gx - 6)} ${f(by + 5)}L${f(gx - 1)} ${f(by + 16)}L${f(gx + 4)} ${f(by + 5)}L${f(gx + 11)} ${f(by + 12)}L${f(gx + 9)} ${f(by - 6)}Z`;
  p.fill(crown, WASH.crimson, 0.9);
  p.line(crown, 0.5);
  // Granos sueltos al pie de la lámina, como en los tratados.
  const seeds = [[70, 404, 20], [86, 414, -30], [58, 418, 60], [100, 400, 10], [78, 426, -70]];
  seeds.forEach(([x, y, a], i) => p.ball(x, y, 3.6, 5.2, a, { color: WASH.aril, delay: 0.7 + i * 0.03, spacing: 1.2, cross: false }));
  return p.render();
}

// Las cuatro láminas, con su nombre científico (y autoridad) y nombre común.
export const PLANTS = {
  azahar: { latin: "Citrus × aurantium", author: "L.", common: "Azahar · naranjo amargo", draw: azahar },
  lavanda: { latin: "Lavandula angustifolia", author: "Mill.", common: "Lavanda", draw: lavanda },
  granado: { latin: "Punica granatum", author: "L.", common: "Granado", draw: granado },
  olivo: { latin: "Olea europaea", author: "L.", common: "Olivo", draw: olivo },
};

// Estación de la boda (hemisferio norte) → planta de la portada.
// Primavera azahar, verano lavanda, otoño granado, invierno olivo.
export function plantFor(iso, override) {
  if (override && PLANTS[override]) return override;
  const m = Number(String(iso).slice(5, 7));
  const d = Number(String(iso).slice(8, 10));
  const md = m * 100 + d;
  if (md >= 321 && md < 621) return "azahar";
  if (md >= 621 && md < 923) return "lavanda";
  if (md >= 923 && md < 1221) return "granado";
  return "olivo";
}

const cache = new Map();
export function plate(name) {
  if (!cache.has(name)) cache.set(name, PLANTS[name].draw());
  return cache.get(name);
}

// Ramita pequeña para las viñetas: olivo a línea, sin color.
export function sprig(cls = "sprig") {
  const p = new Plate(7);
  p.line("M8 20C40 18 80 18 112 20", 0);
  [[26, -1], [38, 1], [52, -1], [64, 1], [78, -1], [90, 1]].forEach(([x, s], i) => {
    p.leaf(x, 19.4, s * 32 - (i % 2 ? 6 : 0), 15, 2.4, { delay: 0.1 + i * 0.05, veins: 0, hatch: false, color: WASH.olive });
  });
  p.leaf(112, 20, -6, 12, 2.2, { delay: 0.4, veins: 0, hatch: false, color: WASH.olive });
  p.ball(46, 26, 2.2, 3, -20, { color: WASH.ripe, delay: 0.4, cross: false, spacing: 1.2, highlight: false });
  p.ball(72, 13.5, 2.2, 3, 200, { color: WASH.ripe, delay: 0.45, cross: false, spacing: 1.2, highlight: false });
  return p.render({ cls, viewBox: "0 0 128 40" });
}

export function smallOlive() {
  return olivo({ small: true });
}
