// Acuarela hecha con SVG: manchas de color y máscaras de borde irregular.
// Cada pieza es una imagen SVG (data URI) con filtros de turbulencia: el navegador la
// rasteriza una sola vez y luego es una imagen más, así el scroll sigue fluido en móvil.
// Nada de filtros vivos en el DOM ni turbulencias animadas.

export const PALETTE = {
  sage: "#9DAA92",
  blue: "#A9BCCB",
  peach: "#E8C3A8",
};

// Aleatorio con semilla (mulberry32): la misma pareja ve siempre las mismas manchas.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Semilla estable a partir de un texto (nombres de la pareja, ruta de la foto…).
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

const r1 = (n) => Math.round(n * 10) / 10;

// Contorno orgánico cerrado: puntos alrededor de una elipse unidos con curvas suaves.
function blob(rand, cx, cy, rx, ry, n = 9, jitter = 0.26) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const k = 1 - jitter / 2 + rand() * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${pts[0].map(r1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map(r1)} ${c2.map(r1)} ${p2.map(r1)}`;
  }
  return `${d}Z`;
}

const uri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ")).replace(/'/g, "%27")}`;

// Mancha de acuarela. Todo se calcula en alfa y al final se tiñe:
// 1) forma orgánica deformada por turbulencia; 2) borde "mojado": la forma desenfocada
// menos ruido da un contorno irregular con flecos; 3) pigmento algo moteado por dentro;
// 4) cerco más oscuro en el borde, donde el agua deja el color al secarse.
const WET = (seed, blur, k, freq = 0.022, oct = 4) => `
<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${oct}' seed='${(seed + 3) % 997}' result='n'/>
<feColorMatrix in='n' type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0' result='na'/>
<feGaussianBlur in='shape' stdDeviation='${blur}' result='b'/>
<feComposite in='b' in2='na' operator='arithmetic' k2='${k[0]}' k3='${k[1]}' k4='${k[2]}' result='wet'/>
<feGaussianBlur in='wet' stdDeviation='0.8' result='edge'/>`;

export function wash(color, seed = 1, { w = 900, h = 700, layers = 2 } = {}) {
  const rand = rng(seed);
  const shapes = [];
  for (let i = 0; i < layers; i++) {
    const s = i === 0 ? 1 : 0.5 + rand() * 0.25;
    const cx = w / 2 + (i === 0 ? 0 : (rand() - 0.5) * w * 0.36);
    const cy = h / 2 + (i === 0 ? 0 : (rand() - 0.5) * h * 0.3);
    shapes.push(`<path d="${blob(rand, cx, cy, w * 0.37 * s, h * 0.35 * s, 7 + i, 0.34)}"/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>
<filter id='f' x='-5%' y='-5%' width='110%' height='110%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='0.005' numOctaves='2' seed='${seed % 997}' result='warp'/>
<feDisplacementMap in='SourceGraphic' in2='warp' scale='${Math.round(Math.min(w, h) * 0.2)}' xChannelSelector='R' yChannelSelector='G' result='shape'/>
${WET(seed, 9, [2.6, -1.25, -0.35])}
<feGaussianBlur in='edge' stdDeviation='5' result='inner'/>
<feComposite in='edge' in2='inner' operator='arithmetic' k2='1.6' k3='-1.6' result='rim'/>
<feTurbulence type='fractalNoise' baseFrequency='0.008 0.011' numOctaves='3' seed='${(seed + 7) % 997}' result='m'/>
<feColorMatrix in='m' type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.8 0 0 0 0.3' result='mottle'/>
<feComposite in='edge' in2='mottle' operator='in' result='body'/>
<feComposite in='rim' in2='body' operator='arithmetic' k2='0.55' k3='1' result='alpha'/>
<feFlood flood-color='${color}'/>
<feComposite in2='alpha' operator='in'/>
</filter>
<g fill='#fff' filter='url(#f)'>${shapes.join("")}</g></svg>`;
  return uri(svg);
}

// Máscara blanca con borde de acuarela para fotos: el interior es opaco del todo
// y el contorno se deshace en flecos y entrantes irregulares.
export function paperMask(seed = 1, { w = 1000, h = 1000, inset = 0.08 } = {}) {
  const m = Math.min(w, h), ix = w * inset + m * 0.03, iy = h * inset + m * 0.03;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>
<filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
<feTurbulence type='fractalNoise' baseFrequency='${r1(7000 / m) / 1000}' numOctaves='3' seed='${seed % 997}' result='warp'/>
<feDisplacementMap in='SourceGraphic' in2='warp' scale='${Math.round(m * 0.16)}' xChannelSelector='R' yChannelSelector='G' result='shape'/>
${WET(seed, Math.round(m * 0.03), [3, -1.45, -0.55], 0.013, 3)}
<feGaussianBlur in='shape' stdDeviation='${Math.round(m * 0.055)}' result='hb'/>
<feComposite in='hb' in2='na' operator='arithmetic' k2='1.5' k3='-0.9' k4='-0.12' result='halo'/>
<feComposite in='edge' in2='halo' operator='arithmetic' k2='1' k3='0.42'/>
</filter>
<rect x='${r1(ix)}' y='${r1(iy)}' width='${r1(w - ix * 2)}' height='${r1(h - iy * 2)}' fill='#fff' filter='url(#f)'/></svg>`;
  return uri(svg);
}

// Pincelada horizontal para revelar la foto: una banda con la punta deshilachada.
// La imagen mide el doble de ancho que la foto y la pincelada ocupa una mitad
// (la derecha, o la izquierda con flip): al mover la máscara, la banda entra pintando.
export function stroke(seed = 1, { flip = false, w = 2000, h = 400 } = {}) {
  const rand = rng(seed);
  const x0 = w / 2 - 30, x1 = w + 40;
  const top = [], bot = [];
  for (let i = 0; i <= 8; i++) {
    const x = x0 + (x1 - x0) * (i / 8);
    top.push([r1(x), r1(h * 0.08 + rand() * h * 0.1)]);
    bot.push([r1(x), r1(h * 0.92 - rand() * h * 0.1)]);
  }
  let d = `M${top[8]}`;
  for (let i = 7; i >= 0; i--) d += ` L${top[i]}`;
  d += ` C${x0 - 160},${h * 0.15} ${x0 - 160},${h * 0.85} ${bot[0]}`;
  for (let i = 1; i <= 8; i++) d += ` L${bot[i]}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>
<filter id='s' x='-10%' y='-20%' width='120%' height='140%'>
<feTurbulence type='fractalNoise' baseFrequency='0.004 0.02' numOctaves='2' seed='${seed % 997}' result='warp'/>
<feDisplacementMap in='SourceGraphic' in2='warp' scale='90' xChannelSelector='R' yChannelSelector='G' result='a'/>
<feTurbulence type='fractalNoise' baseFrequency='0.06 0.03' numOctaves='2' seed='${(seed + 9) % 997}' result='fine'/>
<feDisplacementMap in='a' in2='fine' scale='12' xChannelSelector='R' yChannelSelector='G' result='b'/>
<feGaussianBlur in='b' stdDeviation='9'/>
</filter>
<path d='${d}Z' fill='#fff' filter='url(#s)'${flip ? ` transform='matrix(-1 0 0 1 ${w} 0)'` : ""}/></svg>`;
  return uri(svg);
}
