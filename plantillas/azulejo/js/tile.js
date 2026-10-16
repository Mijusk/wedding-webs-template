import { esc } from "./format.js";

// El azulejo de la plantilla, dibujado en SVG. Se dibuja un cuarto (arriba a la izquierda)
// y los otros tres son su reflejo: así es simétrico como un azulejo portugués o sevillano,
// y al juntar varios, las esquinas y los medios de los cantos forman rosetas completas.
// Las "irregularidades del esmalte" salen de un filtro (#az-glaze) que ondula un poco el
// trazo y deja motas más claras, y de un brillo (#az-sheen) que cada pieza lleva girado.

const COBALT = "#1F3F8F", AZUL = "#4C6FB5", CAL = "#F9F7F1", LIMON = "#E9C64A";
const r = (n) => Math.round(n * 100) / 100;

// Pétalo con la base en (x, y), apuntando a `deg` grados (0 = derecha, 90 = abajo).
function petal(x, y, deg, len, w) {
  const L = len, h = w / 2;
  const d = `M0 0C${r(L * .18)} ${r(-h * 1.25)} ${r(L * .72)} ${r(-h * 1.05)} ${L} 0C${r(L * .72)} ${r(h * 1.05)} ${r(L * .18)} ${r(h * 1.25)} 0 0Z`;
  return `transform="translate(${r(x)} ${r(y)}) rotate(${deg})" d="${d}"`;
}

const quarter = `
  <g id="az-q">
    <path d="M0 27A27 27 0 0 0 27 0" fill="none" stroke="${AZUL}" stroke-width="1.5"/>
    <circle cx="${r(32 * Math.cos(Math.PI / 8))}" cy="${r(32 * Math.sin(Math.PI / 8))}" r="1.5" fill="${COBALT}"/>
    <circle cx="${r(32 * Math.sin(Math.PI / 8))}" cy="${r(32 * Math.cos(Math.PI / 8))}" r="1.5" fill="${COBALT}"/>
    <path ${petal(0, 0, 45, 21, 10)} fill="${COBALT}"/>
    <path ${petal(0, 0, 0, 15, 8)} fill="${AZUL}"/>
    <path ${petal(0, 0, 90, 15, 8)} fill="${AZUL}"/>
    <circle cx="0" cy="0" r="5.2" fill="${CAL}"/>
    <circle cx="0" cy="0" r="3" fill="${COBALT}"/>

    <path d="M0 40A10 10 0 0 1 0 60" fill="none" stroke="${COBALT}" stroke-width="1.3"/>
    <path d="M40 0A10 10 0 0 0 60 0" fill="none" stroke="${COBALT}" stroke-width="1.3"/>
    <path d="M0 45.5A4.5 4.5 0 0 1 0 54.5Z" fill="${AZUL}"/>
    <path d="M45.5 0A4.5 4.5 0 0 0 54.5 0Z" fill="${AZUL}"/>
    <path ${petal(12, 50, 0, 8, 5)} fill="${AZUL}"/>
    <path ${petal(50, 12, 90, 8, 5)} fill="${AZUL}"/>

    <circle cx="50" cy="50" r="25" fill="none" stroke="${COBALT}" stroke-width=".9"/>
    <path ${petal(50, 50, 180, 22, 11)} fill="${COBALT}"/>
    <path ${petal(50, 50, 270, 22, 11)} fill="${COBALT}"/>
    <path d="M50 50L31 50M50 50L50 31" stroke="${CAL}" stroke-width=".9" stroke-linecap="round"/>
    <path ${petal(50, 50, 225, 16, 9)} fill="${AZUL}"/>
    <circle cx="${r(50 - 25 * Math.SQRT1_2)}" cy="${r(50 - 25 * Math.SQRT1_2)}" r="2" fill="${COBALT}"/>
  </g>`;

// Se inyecta una vez en <body> (fuera de main, que en la vista previa se repinta).
export function tileDefs() {
  return `
  <svg id="az-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
    <defs>
      <filter id="az-glaze" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="11" result="wave"/>
        <feDisplacementMap in="SourceGraphic" in2="wave" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="paint"/>
        <feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="1" seed="4" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7 0 0 0 -0.93" result="specks"/>
        <feComposite in="specks" in2="paint" operator="in" result="pooled"/>
        <feMerge><feMergeNode in="paint"/><feMergeNode in="pooled"/></feMerge>
      </filter>
      <filter id="az-glaze-soft" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="11" result="wave"/>
        <feDisplacementMap in="SourceGraphic" in2="wave" scale="0.9" xChannelSelector="R" yChannelSelector="G" result="paint"/>
        <feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="1" seed="4" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.3 0 0 0 -0.72" result="specks"/>
        <feComposite in="specks" in2="paint" operator="in" result="pooled"/>
        <feMerge><feMergeNode in="paint"/><feMergeNode in="pooled"/></feMerge>
      </filter>
      <radialGradient id="az-sheen" cx=".28" cy=".22" r=".9">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
        <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="${COBALT}" stop-opacity=".07"/>
      </radialGradient>
      <symbol id="az-tile" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="${CAL}"/>
        <g filter="url(#az-glaze)">
          ${quarter}
          <use href="#az-q" transform="matrix(-1 0 0 1 100 0)"/>
          <use href="#az-q" transform="matrix(1 0 0 -1 0 100)"/>
          <use href="#az-q" transform="matrix(-1 0 0 -1 100 100)"/>
          <circle cx="50" cy="50" r="5" fill="${CAL}"/>
          <circle cx="50" cy="50" r="3.4" fill="${LIMON}"/>
        </g>
        <rect width="100" height="100" fill="url(#az-sheen)"/>
        <rect x=".6" y=".6" width="98.8" height="98.8" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>
      </symbol>
    </defs>
  </svg>`;
}

// Pseudoaleatorio estable (mismo resultado en cada repintado): cada pieza "sale del horno"
// con su giro, su brillo y su tono, siempre los mismos.
export function rand(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

// Una pieza suelta: <svg> con el azulejo girado 0/90/180/270 (el dibujo es simétrico, pero
// el esmalte y el brillo no, así no hay dos iguales).
export function tile(seed, style = "", cls = "") {
  const rnd = rand(seed + 1);
  const rot = Math.floor(rnd() * 4) * 90;
  const b = (0.965 + rnd() * 0.06).toFixed(3);
  return `<svg class="az${cls ? ` ${cls}` : ""}" viewBox="0 0 100 100" style="--b:${b};${style}" aria-hidden="true" focusable="false"><use href="#az-tile" width="100" height="100"${rot ? ` transform="rotate(${rot} 50 50)"` : ""}/></svg>`;
}

// Inicial sin tilde: en un azulejo pintado no se pintan acentos.
const initial = (name) => (String(name || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] || "").toUpperCase();
const WIDE = { M: 0.95, W: 1.05 }, NARROW = { I: 0.38, J: 0.5 };
const capWidth = (c) => WIDE[c] ?? NARROW[c] ?? 0.72;

// El azulejo central con las iniciales de la pareja, pintado a mano para ellos.
export function monogram(event, cls = "") {
  const [a, b] = event.couple;
  const ia = initial(a), ib = initial(b);
  const size = Math.min(30, 52 / (capWidth(ia) + capWidth(ib) + 0.42));
  const leaves = [0, 90, 180, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return `<path ${petal(50 + 30 * Math.cos(rad), 50 + 30 * Math.sin(rad), deg, 9, 5)} fill="${COBALT}"/>`;
  }).join("");
  const dots = [45, 135, 225, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return `<circle cx="${r(50 + 30 * Math.cos(rad))}" cy="${r(50 + 30 * Math.sin(rad))}" r="1.6" fill="${AZUL}"/>`;
  }).join("");
  const corners = [[0, 0, 0], [100, 0, 90], [100, 100, 180], [0, 100, 270]].map(([x, y, deg]) =>
    `<g transform="translate(${x} ${y}) rotate(${deg})"><path d="M0 0H15A15 15 0 0 1 0 15Z" fill="${COBALT}"/><path d="M0 0H9A9 9 0 0 1 0 9Z" fill="${CAL}"/><path d="M0 0H5.5A5.5 5.5 0 0 1 0 5.5Z" fill="${AZUL}"/></g>`).join("");
  return `
  <svg class="mono ${cls}" viewBox="0 0 100 100" role="img" aria-label="${esc(`${a} & ${b}`)}">
    <rect width="100" height="100" fill="${CAL}"/>
    <g filter="url(#az-glaze-soft)">
      ${corners}
      <rect x="6.5" y="6.5" width="87" height="87" fill="none" stroke="${COBALT}" stroke-width="1.6"/>
      <rect x="10" y="10" width="80" height="80" fill="none" stroke="${AZUL}" stroke-width=".55"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="${AZUL}" stroke-width=".7"/>
      ${leaves}${dots}
    </g>
    <text class="mono__txt" x="50" y="${r(50 + size * 0.35)}" text-anchor="middle" font-size="${r(size)}">${esc(ia)}<tspan class="mono__amp" font-size="${r(size * 0.6)}" dx="${r(size * 0.05)}" dy="${r(-size * 0.03)}">&amp;</tspan><tspan dx="${r(size * 0.05)}" dy="${r(size * 0.03)}">${esc(ib)}</tspan></text>
    <rect width="100" height="100" fill="url(#az-sheen)"/>
  </svg>`;
}

// Ramita de limonero a línea fina: hojas en cobalto, un limón y un azahar.
export function sprig(cls = "") {
  const leaf = (x, y, deg, len) => {
    const w = len * 0.36;
    return `<g transform="translate(${x} ${y}) rotate(${deg})"><path class="sprig__leaf" d="M0 0C${r(len * .25)} ${r(-w)} ${r(len * .7)} ${r(-w * .9)} ${len} 0C${r(len * .7)} ${r(w * .9)} ${r(len * .25)} ${r(w)} 0 0Z"/><path class="sprig__vein" d="M${r(len * .1)} 0L${r(len * .82)} 0"/></g>`;
  };
  return `
  <svg class="sprig ${cls}" viewBox="0 0 170 74" aria-hidden="true" focusable="false">
    <path class="sprig__stem" d="M6 42C36 33 70 27 104 28C124 29 142 31 160 36"/>
    ${leaf(24, 37.5, -128, 22)}${leaf(40, 34, 128, 24)}${leaf(60, 30.5, -66, 26)}${leaf(110, 28.4, -112, 24)}${leaf(124, 29.6, 58, 22)}${leaf(160, 36, 8, 15)}
    <path class="sprig__stem" d="M84 28.2C86 31 87 34 87.4 37.2"/>
    <path class="sprig__lemon" d="M88 37C96.5 37.5 99.5 45.5 98.8 52.5C98.2 59.5 93.4 63.6 89.6 64.6L88.6 67L87 64.6C83 63.8 78.3 59.6 77.6 52.5C77 45.5 79.8 37.6 88 37Z"/>
    <path class="sprig__shine" d="M82.5 46C82.8 43.2 84.4 41.4 86.4 40.8"/>
    <path class="sprig__stem" d="M136 30.6C137 27 138.6 24 141 21.6"/>
    <g class="sprig__flower" transform="translate(143 19)">
      ${[0, 72, 144, 216, 288].map((d) => `<ellipse cx="0" cy="-4.4" rx="2.6" ry="4" transform="rotate(${d})"/>`).join("")}
      <circle class="sprig__heart" r="1.7"/>
    </g>
  </svg>`;
}

// Marca pequeña para cabeceras: un azulejo visto en rombo.
export const mark = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1.5L22.5 12L12 22.5L1.5 12Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M12 5.5L18.5 12L12 18.5L5.5 12Z" fill="currentColor" opacity=".16"/><circle cx="12" cy="8.6" r="1.9" fill="currentColor"/><circle cx="12" cy="15.4" r="1.9" fill="currentColor"/><circle cx="8.6" cy="12" r="1.9" fill="currentColor"/><circle cx="15.4" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="#E9C64A"/></svg>`;
