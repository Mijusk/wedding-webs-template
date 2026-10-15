// Flores prensadas dibujadas en SVG. Cada especie es una función (semilla) → <svg>:
// la semilla da pequeñas imperfecciones (pétalos que faltan, hojas torcidas, tonos) y es
// fija, así cada flor sale igual en cada visita y en cada repintado de la vista previa.
// El aspecto de papel (bordes algo irregulares, color moteado y una sombra mínima) lo da
// un único filtro compartido, #jd-press, que enhance.js añade una vez al documento.

const f = (n) => String(Math.round(n * 10) / 10);

function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + r() * (b - a);
const pick = (r, list) => list[Math.floor(r() * list.length)];
const rad = (deg) => (deg * Math.PI) / 180;

// Transformación de coordenadas locales (forma "hacia arriba", -y) a la posición final.
const place = (x, y, deg, s = 1) => {
  const c = Math.cos(rad(deg)), si = Math.sin(rad(deg));
  return (px, py) => [x + (px * c - py * si) * s, y + (px * si + py * c) * s];
};
const P = (T, x, y) => { const [a, b] = T(x, y); return `${f(a)} ${f(b)}`; };

// Pétalo alargado de punta roma con una muesca mínima (margarita).
function petal(T, L, W, r) {
  const a = between(r, .82, 1.15), b = between(r, .82, 1.15), n = between(r, .94, .99);
  return `M${P(T, 0, 0)}C${P(T, W * .55 * a, -L * .12)} ${P(T, W * a, -L * .55)} ${P(T, W * .62 * a, -L * .92)}` +
    `Q${P(T, W * .22, -L * 1.03)} ${P(T, 0, -L * n)}Q${P(T, -W * .22, -L * 1.03)} ${P(T, -W * .62 * b, -L * .92)}` +
    `C${P(T, -W * b, -L * .55)} ${P(T, -W * .55 * b, -L * .12)} ${P(T, 0, 0)}Z`;
}

// Hoja lanceolada, con la punta algo vencida hacia un lado.
function leaf(T, L, W, r) {
  const a = between(r, .85, 1.12), b = between(r, .85, 1.12), c = between(r, -.1, .1) * L;
  return `M${P(T, 0, 0)}C${P(T, W * a, -L * .18)} ${P(T, W * 1.05 * a, -L * .62)} ${P(T, c, -L)}` +
    `C${P(T, -W * 1.05 * b, -L * .62)} ${P(T, -W * b, -L * .18)} ${P(T, 0, 0)}Z`;
}

// Pétalo ancho y redondeado (rosa).
function roundPetal(T, L, W, r) {
  const a = between(r, .88, 1.12), b = between(r, .88, 1.12), w = between(r, -.12, .12) * W;
  return `M${P(T, 0, 0)}C${P(T, W * .9 * a, -L * .12)} ${P(T, W * 1.12 * a, -L * .7)} ${P(T, W * .5 * a, -L * .96)}` +
    `Q${P(T, w, -L * 1.1)} ${P(T, -W * .5 * b, -L * .96)}C${P(T, -W * 1.12 * b, -L * .7)} ${P(T, -W * .9 * b, -L * .12)} ${P(T, 0, 0)}Z`;
}

// Hoja aserrada (rosal): contorno por puntos con dientes alternos.
function serrated(T, L, W, r) {
  const N = 14, right = [], left = [];
  for (let i = 1; i < N; i++) {
    const s = i / N;
    const base = W * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04)), .8) * (1.08 - .32 * s);
    const tooth = i % 2 ? 1 : .86;
    right.push(P(T, base * tooth * between(r, .95, 1.05), -L * (s + (i % 2 ? .02 : 0))));
    left.push(P(T, -base * tooth * between(r, .95, 1.05), -L * (s + (i % 2 ? .02 : 0))));
  }
  return `M${P(T, 0, 0)}L${right.join("L")}L${P(T, between(r, -.06, .06) * L, -L)}L${left.reverse().join("L")}Z`;
}

// Punto y tangente de una curva cúbica.
function cubic(p, t) {
  const u = 1 - t;
  const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
  const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
  const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
  const dy = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
  return { x, y, deg: (Math.atan2(dy, dx) * 180) / Math.PI + 90 }; // deg: giro de "arriba" a la tangente
}
const curve = (p) => `M${f(p[0])} ${f(p[1])}C${p.slice(2).map(f).join(" ")}`;

const svg = (w, h, body, cls) =>
  `<svg class="flower ${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><g filter="url(#jd-press)">${body}</g></svg>`;

/* ---------- especies ---------- */

// Margarita de prado (Bellis perennis): pétalos blancos con la punta rosada.
function daisyHead(cx, cy, s, r) {
  const n = 22 + Math.floor(r() * 6);
  let back = "", front = "", blush = "", veins = "";
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < n; i++) {
      if (r() < .07) continue; // algún pétalo perdido al prensar
      const deg = (i + layer * .5) * (360 / n) + between(r, -5, 5);
      const L = between(r, 28, 36) * s * (layer ? .9 : 1), W = between(r, 3.1, 4) * s;
      const T = place(cx, cy, deg);
      const d = petal(T, L, W, r);
      if (layer) front += d; else back += d;
      if (r() < .55) blush += `M${P(T, 0, -L * .84)}L${P(T, 0, -L * .93)}`;
      veins += `M${P(T, 0, -L * .22)}L${P(T, between(r, -.4, .4), -L * .86)}`;
    }
  }
  let dots = "";
  for (let k = 0; k < 64; k++) {
    const rr = 1.15 * Math.sqrt(k) * s, a = k * 137.508;
    if (rr > 8.6 * s) break;
    const [x, y] = place(cx, cy, a)(0, -rr);
    dots += `M${f(x)} ${f(y)}h.01`;
  }
  return `
    <path d="${back}" fill="#f7f2e6" fill-opacity=".9" stroke="#cdbfa3" stroke-width=".45"/>
    <path d="${front}" fill="#fbf7ee" fill-opacity=".86" stroke="#d3c6ab" stroke-width=".4"/>
    <path d="${blush}" stroke="#d9a5a0" stroke-width="${f(4.2 * s)}" stroke-linecap="round" opacity=".26"/>
    <path d="${veins}" stroke="#c9b99b" stroke-width=".3" opacity=".7" fill="none"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(9.6 * s)}" fill="#cbad6c"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(9.6 * s)}" fill="none" stroke="#a98a44" stroke-width=".6" opacity=".7"/>
    <path d="${dots}" stroke="#a5843e" stroke-width="${f(1.5 * s)}" stroke-linecap="round" opacity=".55"/>`;
}

export function daisy(seed = 1) {
  const r = rng(seed);
  const bend = between(r, -8, 8);
  const stem = [60, 66, 62 + bend, 120, 54 - bend, 172, 58 + bend * .4, 226];
  const k = cubic(stem, .62), k2 = cubic(stem, .8);
  const l1 = place(k.x, k.y, k.deg - 38 * (r() < .5 ? 1 : -1)), l2 = place(k2.x, k2.y, k2.deg + 34);
  return svg(120, 230, `
    <path d="${curve(stem)}" fill="none" stroke="#7f8a5c" stroke-width="1.7" stroke-linecap="round"/>
    <path d="${leaf(l1, 34, 6.2, r)}" fill="#86936a" fill-opacity=".88"/>
    <path d="${leaf(l2, 24, 4.6, r)}" fill="#7c8b5e" fill-opacity=".86"/>
    <path d="M${P(l1, 0, -2)}L${P(l1, 0, -30)}M${P(l2, 0, -2)}L${P(l2, 0, -21)}" stroke="#a8b18c" stroke-width=".45" opacity=".8"/>
    ${daisyHead(60, 58, 1, r)}`, "flower--daisy");
}

// Solo la cabeza, para sembrar sueltas.
export function daisyBloom(seed = 1) {
  const r = rng(seed);
  return svg(100, 100, daisyHead(50, 50, 1.15, r), "flower--bloom");
}

// Lavanda: espiga de botones en verticilos y dos hojas finas.
export function lavender(seed = 1) {
  const r = rng(seed);
  const sway = between(r, -6, 6);
  const stem = [35, 248, 30 + sway, 190, 38 - sway, 90, 35 + sway * .5, 16];
  const colors = ["#b7a9c9", "#a797bd", "#9a8ab2", "#c4b8d4", "#ad9fc4"];
  let buds = "", calyx = "";
  for (let k = 0; k < 12; k++) {
    const p = cubic(stem, k === 0 ? .47 : k === 1 ? .53 : .56 + (k - 2) * .043);
    const s = 1 - k * .05;
    const count = k > 9 ? 2 : 4 + Math.floor(r() * 3);
    for (let j = 0; j < count; j++) {
      const a = p.deg + (j / Math.max(1, count - 1) - .5) * 120 + between(r, -10, 10);
      const T = place(p.x, p.y, a);
      buds += `<path d="${petal(T, 10 * s, 3.1 * s, r)}" fill="${pick(r, colors)}" fill-opacity=".9"/>`;
      if (r() < .6) calyx += `M${P(T, 0, -.5)}L${P(T, 0, -3.2 * s)}`;
    }
  }
  const lA = cubic(stem, .2), lB = cubic(stem, .3);
  const L1 = place(lA.x, lA.y, lA.deg - 22), L2 = place(lB.x, lB.y, lB.deg + 20);
  return svg(70, 250, `
    <path d="${curve(stem)}" fill="none" stroke="#8b9470" stroke-width="1.3" stroke-linecap="round"/>
    <path d="${leaf(L1, 44, 2.3, r)}" fill="#8e9873" fill-opacity=".9"/>
    <path d="${leaf(L2, 36, 2, r)}" fill="#97a07c" fill-opacity=".9"/>
    ${buds}
    <path d="${calyx}" stroke="#7d6f95" stroke-width="1.1" stroke-linecap="round" opacity=".45"/>`, "flower--lavender");
}

// Helecho: fronde con pinnas alternas hechas de pínnulas que menguan hacia la punta.
export function fern(seed = 1) {
  const r = rng(seed);
  const lean = between(r, -10, 10);
  const rachis = [75, 276, 66 + lean, 190, 62 - lean, 90, 86, 8];
  const tones = ["#7c8b5e", "#7c8b5e", "#86956a", "#73825a", "#909c70"];
  let pinnae = "", ribs = "";
  const N = 24;
  for (let i = 0; i < N; i++) {
    const t = .08 + (i / (N - 1)) * .9;
    const p = cubic(rachis, t);
    const side = i % 2 ? 1 : -1;
    const Lp = 58 * Math.pow(1 - t, .78) * (t < .22 ? .72 + 1.3 * t : 1) + 4;
    const dir = p.deg + side * between(r, 52, 64);
    const T = place(p.x, p.y, dir);
    const curl = between(r, -.08, .08);
    ribs += `M${P(T, 0, 0)}Q${P(T, Lp * curl, -Lp * .5)} ${P(T, Lp * curl * 2, -Lp)}`;
    const m = Math.max(2, Math.round(Lp / 4.6));
    let d = "";
    for (let j = 0; j < m; j++) {
      const u = (j + .5) / m;
      const ps = (3.3 - u * 1.7) * Math.pow(Lp / 50, .25);
      const bx = Lp * curl * 2 * u * u, by = -Lp * u;
      const [x, y] = T(bx, by);
      for (const sd of [-1, 1]) {
        if (u > .92 && sd === 1) continue;
        d += petal(place(x, y, dir + sd * between(r, 48, 62)), ps * 2.1, ps * .82, r);
      }
    }
    const [tx, ty] = T(Lp * curl * 2, -Lp);
    d += petal(place(tx, ty, dir), 3.2, 1.2, r);
    const brown = r() < .1;
    pinnae += `<path d="${d}" fill="${brown ? "#a39a6c" : pick(r, tones)}" fill-opacity="${brown ? .8 : .86}"/>`;
  }
  return svg(150, 280, `
    <path d="${curve(rachis)}" fill="none" stroke="#6f7c52" stroke-width="1.4" stroke-linecap="round"/>
    ${pinnae}
    <path d="${ribs}" fill="none" stroke="#6b7850" stroke-width=".45" opacity=".75"/>`, "flower--fern");
}

// Rosa pequeña prensada de frente: tres coronas de pétalos traslúcidos, sépalos y hojas aserradas.
export function rose(seed = 1) {
  const r = rng(seed);
  const cx = 75, cy = 64;
  const stem = [cx, 86, 80, 130, 66, 170, 71, 218];
  let sepals = "", petals = "", veins = "";
  const rot = between(r, 0, 72);
  for (let i = 0; i < 5; i++) {
    const T = place(cx, cy, rot + 36 + i * 72 + between(r, -8, 8));
    sepals += leaf(T, between(r, 40, 47), 4.2, r);
  }
  const rings = [
    { n: 5, L: 36, W: 23, off: 0, fill: "#ddaca6", o: .66 },
    { n: 5, L: 27, W: 17, off: 36, fill: "#d59d97", o: .68 },
    { n: 6, L: 17, W: 11, off: 12, fill: "#c98d87", o: .72 },
  ];
  for (const g of rings) {
    for (let i = 0; i < g.n; i++) {
      const deg = rot + g.off + i * (360 / g.n) + between(r, -9, 9);
      const L = g.L * between(r, .9, 1.08);
      const T = place(cx, cy, deg);
      petals += `<path d="${roundPetal(T, L, g.W, r)}" fill="${g.fill}" fill-opacity="${g.o}" stroke="#b07570" stroke-width=".55" stroke-opacity=".7"/>`;
      if (g.L > 20) for (const v of [-.45, -.15, .15, .45]) veins += `M${P(T, v * 2, -3)}Q${P(T, v * g.W * .7, -L * .5)} ${P(T, v * g.W * 1.1, -L * .86)}`;
    }
  }
  const lp = cubic(stem, .45), lp2 = cubic(stem, .72);
  const petiole = place(lp.x, lp.y, lp.deg + 48);
  const [ex, ey] = petiole(0, -26), [mx, my] = petiole(0, -13);
  const leaves = [
    place(ex, ey, lp.deg + 48 + between(r, -6, 6)),
    place(mx, my, lp.deg + 48 - 52),
    place(mx, my, lp.deg + 48 + 58),
    place(lp2.x, lp2.y, lp2.deg - 50),
  ];
  const sizes = [[25, 10], [18, 8], [19, 8], [21, 9]];
  let leafPaths = "", leafVeins = "";
  leaves.forEach((T, i) => {
    const [L, W] = sizes[i];
    leafPaths += `<path d="${serrated(T, L, W, r)}" fill="${i % 2 ? "#7c8b5e" : "#86936a"}" fill-opacity=".86"/>`;
    leafVeins += `M${P(T, 0, -1)}L${P(T, 0, -L * .9)}`;
    for (const s of [.3, .5, .7]) leafVeins += `M${P(T, 0, -L * s)}L${P(T, W * .6, -L * (s + .12))}M${P(T, 0, -L * s)}L${P(T, -W * .6, -L * (s + .12))}`;
  });
  let thorns = "";
  for (const t of [.3, .58, .86]) {
    const p = cubic(stem, t), s = t > .5 ? 1 : -1, T = place(p.x, p.y, p.deg + s * 70);
    thorns += `M${P(T, -1.4, 0)}L${P(T, s * .8, -4.2)}L${P(T, 1.4, 0)}Z`;
  }
  return svg(150, 220, `
    <path d="${curve(stem)}" fill="none" stroke="#76804f" stroke-width="2" stroke-linecap="round"/>
    <path d="M${P(petiole, 0, 0)}L${P(petiole, 0, -26)}" stroke="#76804f" stroke-width="1" stroke-linecap="round"/>
    <path d="${thorns}" fill="#8b7a5c" fill-opacity=".8"/>
    ${leafPaths}
    <path d="${leafVeins}" fill="none" stroke="#a9b28d" stroke-width=".4" opacity=".85"/>
    <path d="${sepals}" fill="#7c8b5e" fill-opacity=".82"/>
    ${petals}
    <path d="${veins}" fill="none" stroke="#b9817c" stroke-width=".3" opacity=".45"/>
    <circle cx="${cx}" cy="${cy}" r="5.4" fill="#b8746f" fill-opacity=".55"/>
    <path d="M${cx - 3} ${cy + 1}q1-4 4-3t2 4-4 3-4-3 2-6 7-4" fill="none" stroke="#9a5f5a" stroke-width=".7" opacity=".7"/>`, "flower--rose");
}

// Rama de olivo: hojas estrechas por parejas, unas por el haz y otras por el envés plateado.
export function olive(seed = 1) {
  const r = rng(seed);
  const b = between(r, -8, 8);
  const twig = [60, 258, 50 + b, 190, 72 - b, 92, 62, 14];
  let leaves = "", ribs = "", fruit = "";
  const pairs = 7;
  for (let i = 0; i < pairs; i++) {
    const t = .12 + i * (.78 / (pairs - 1));
    const p = cubic(twig, t);
    for (const s of [-1, 1]) {
      if (r() < .08) continue;
      const L = (48 - 16 * t) * between(r, .88, 1.1), W = between(r, 4.2, 5.4);
      const T = place(p.x, p.y, p.deg + s * between(r, 30, 44));
      const under = r() < .35;
      leaves += `<path d="${leaf(T, L, W, r)}" fill="${under ? "#aab199" : pick(r, ["#7c8b5e", "#84916a", "#788660"])}" fill-opacity=".9"/>`;
      ribs += `<path d="M${P(T, 0, -1)}L${P(T, 0, -L * .9)}" stroke="${under ? "#8e967a" : "#b9c0a3"}" stroke-width=".55"/>`;
    }
    if (i === 2 || (i === 4 && r() < .5)) {
      const T = place(p.x, p.y, p.deg + 160);
      const [ox, oy] = T(0, -9);
      fruit += `<path d="M${P(T, 0, 0)}L${f(ox)} ${f(oy)}" stroke="#8a7f66" stroke-width=".8"/><ellipse cx="${f(ox)}" cy="${f(oy)}" rx="3.6" ry="5" transform="rotate(${f(p.deg + 160)} ${f(ox)} ${f(oy)})" fill="#6f6b4c" fill-opacity=".78"/>`;
    }
  }
  const tip = cubic(twig, 1);
  const T = place(tip.x, tip.y, tip.deg);
  leaves += `<path d="${leaf(T, 30, 4.4, r)}" fill="#84916a" fill-opacity=".9"/>`;
  return svg(120, 262, `
    <path d="${curve(twig)}" fill="none" stroke="#8a7f66" stroke-width="1.5" stroke-linecap="round"/>
    ${fruit}${leaves}${ribs}`, "flower--olive");
}

// Flor de encaje (Daucus carota): umbela de radios finos que acaban en ramilletes de puntitos.
export function lace(seed = 1) {
  const r = rng(seed);
  const top = [65, 80];
  const stem = [65, 198, 60, 160, 68, 120, top[0], top[1]];
  let rays = "", dots = "";
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = -150 + (i / (n - 1)) * 120 + between(r, -4, 4);
    const L = between(r, 30, 40) * (1 - Math.abs(i / (n - 1) - .5) * .35);
    const ex = top[0] + Math.cos(rad(a)) * L, ey = top[1] + Math.sin(rad(a)) * L * .8;
    rays += `M${top[0]} ${top[1]}Q${f((top[0] + ex) / 2 + between(r, -2, 2))} ${f((top[1] + ey) / 2 + 2)} ${f(ex)} ${f(ey)}`;
    const m = 6 + Math.floor(r() * 4);
    for (let j = 0; j < m; j++) {
      const b = a + (j / (m - 1) - .5) * 150 + between(r, -8, 8);
      const l = between(r, 4, 7.5);
      const dx = ex + Math.cos(rad(b)) * l, dy = ey + Math.sin(rad(b)) * l;
      rays += `M${f(ex)} ${f(ey)}L${f(dx)} ${f(dy)}`;
      dots += `<circle cx="${f(dx)}" cy="${f(dy)}" r="${f(between(r, 1.3, 1.9))}"/>`;
    }
  }
  const lp = cubic(stem, .35);
  const T = place(lp.x, lp.y, lp.deg - 34);
  let bract = "";
  for (let k = 0; k < 5; k++) bract += leaf(place(...T(0, -k * 5), lp.deg - 34 + (k % 2 ? 40 : -40)), 9 - k, 1.4, r);
  return svg(130, 200, `
    <path d="${curve(stem)}" fill="none" stroke="#8d9671" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M${P(T, 0, 0)}L${P(T, 0, -24)}" stroke="#8d9671" stroke-width=".7"/>
    <path d="${bract}" fill="#8d9671" fill-opacity=".85"/>
    <path d="${rays}" fill="none" stroke="#9aa27e" stroke-width=".5"/>
    <g fill="#f8f2e4" stroke="#cbbd9f" stroke-width=".4">${dots}</g>`, "flower--lace");
}

// Sueltos: un pétalo de rosa, uno de margarita o una hojita.
export function loose(kind = "rose", seed = 1) {
  const r = rng(seed);
  const T = place(20, 36, between(r, -20, 20));
  if (kind === "rose") return svg(40, 40, `<path d="${roundPetal(T, 30, 17, r)}" fill="#dcaaa4" fill-opacity=".62" stroke="#b77d78" stroke-width=".5" stroke-opacity=".5"/><path d="M${P(T, 0, -2)}Q${P(T, -3, -14)} ${P(T, -5, -25)}M${P(T, 1, -2)}Q${P(T, 4, -14)} ${P(T, 6, -24)}" fill="none" stroke="#b9817c" stroke-width=".3" opacity=".5"/>`, "flower--loose");
  if (kind === "leaf") return svg(40, 40, `<path d="${leaf(T, 32, 5, r)}" fill="#84916a" fill-opacity=".88"/><path d="M${P(T, 0, -1)}L${P(T, 0, -29)}" stroke="#b9c0a3" stroke-width=".5"/>`, "flower--loose");
  if (kind === "bud") return svg(40, 40, `<path d="${petal(T, 13, 3.4, r)}${petal(place(...T(0, -2), between(r, -40, -20)), 11, 3, r)}" fill="#a797bd" fill-opacity=".9"/>`, "flower--loose");
  return svg(40, 40, `<path d="${petal(T, 32, 4, r)}" fill="#fbf7ee" fill-opacity=".9" stroke="#cdbfa3" stroke-width=".45"/><path d="M${P(T, 0, -25)}L${P(T, 0, -30)}" stroke="#d9a5a0" stroke-width="5" stroke-linecap="round" opacity=".35"/>`, "flower--loose");
}

// Lazo de cordel para el ramillete del cierre.
export function twine() {
  return `<svg class="twine" viewBox="0 0 80 50" aria-hidden="true" focusable="false"><g filter="url(#jd-press)" fill="none" stroke="#b49a78" stroke-width="1.1" stroke-linecap="round">
    <path d="M28 20c-10-12-24-10-22-2s14 6 22 2c6 4 18 10 24 2s-10-14-24-2"/>
    <path d="M30 22c-4 8-10 18-14 26M38 22c3 8 6 16 12 24"/>
    <path d="M24 17h16" stroke-width="2.4"/>
  </g></svg>`;
}

export const SPECIES = { daisy, daisyBloom, lavender, fern, rose, olive, lace };

// Filtro compartido: bordes algo irregulares, color moteado como papel secante y una
// sombra mínima de lo que está apoyado sobre la hoja.
export const DEFS = `<svg id="jd-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <filter id="jd-press" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="7" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="shape"/>
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.75 1.22" result="mask"/>
    <feComposite in="shape" in2="mask" operator="in" result="tex"/>
    <feDropShadow in="tex" dx=".3" dy=".9" stdDeviation=".7" flood-color="#3d3a35" flood-opacity=".2"/>
  </filter>
</defs></svg>`;
