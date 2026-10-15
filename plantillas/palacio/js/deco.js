// Ornamentos Art Déco de la plantilla Palacio, dibujados a línea en SVG.
// Todo trazo que lleva pathLength="1" se "dibuja" (stroke-dashoffset 1 → 0) al llegar
// con el scroll (css/style.css, .reveal/.is-pending) o, en la portada, tras las puertas.
// Un path con varios tramos se dibuja tramo a tramo: así los abanicos se abren varilla a varilla.

const P = 'pathLength="1"';
const SVG = 'aria-hidden="true" focusable="false"';
const r1 = (n) => Math.round(n * 10) / 10;
const polar = (cx, cy, r, deg) => [r1(cx + r * Math.cos((deg * Math.PI) / 180)), r1(cy - r * Math.sin((deg * Math.PI) / 180))];

// Semicírculo hacia arriba, de izquierda a derecha.
const arc = (cx, cy, r) => `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`;

// Varillas de abanico: radios entre r1 y r2, cada `step` grados, sin incluir los extremos.
function ribs(cx, cy, ra, rb, step, from = 0, to = 180, long = rb) {
  let d = "";
  let i = 0;
  for (let a = from + step; a < to - 0.01; a += step, i++) {
    const [x1, y1] = polar(cx, cy, ra, a);
    const [x2, y2] = polar(cx, cy, i % 2 ? rb : long, a);
    d += `M${x1} ${y1}L${x2} ${y2}`;
  }
  return d;
}

// Rombo relleno.
const diamond = (x, y, s) => `M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`;

// Filete con abanico: abre cada sección.
export const fanRule = (cls = "") => `
  <svg class="fan-rule draw ${cls}" viewBox="0 0 240 46" ${SVG}>
    <g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square">
      <path ${P} d="M88 42H16M152 42H224"/>
      <path ${P} d="M84 36H48M156 36H192"/>
      <path ${P} d="${arc(120, 42, 32)}"/>
      <path ${P} d="${arc(120, 42, 22)}"/>
      <path ${P} d="${ribs(120, 42, 9, 32, 15)}"/>
    </g>
    <path class="fill" fill="currentColor" d="M111 42A9 9 0 0 1 129 42Z${diamond(9, 42, 4)}${diamond(231, 42, 4)}${diamond(120, 4, 3)}"/>
  </svg>`;

// Filete simple con rombo central (pies y separadores).
export const rule = (cls = "") => `
  <svg class="rule draw ${cls}" viewBox="0 0 200 12" ${SVG}>
    <path ${P} d="M0 6H86M114 6H200" fill="none" stroke="currentColor" stroke-width="1"/>
    <path ${P} d="M100 1 105 6 100 11 95 6Z M91 6H109" fill="none" stroke="currentColor" stroke-width="1"/>
    <path class="fill" fill="currentColor" d="${diamond(100, 6, 2.2)}"/>
  </svg>`;

// Esquinas escalonadas para los paneles: la misma pieza, girada por CSS.
export const corners = () =>
  ["tl", "tr", "bl", "br"].map((c) => `
  <svg class="corner corner--${c} draw" viewBox="0 0 26 26" ${SVG}>
    <path ${P} d="M1 25V9H9V1H25" fill="none" stroke="currentColor" stroke-width="1"/>
    <path ${P} d="M7 25V15H15V7H25" fill="none" stroke="currentColor" stroke-width=".8"/>
  </svg>`).join("");

// Marco de la portada (320 × 480): arco doble, base escalonada, abanico y remate.
// La foto ocupa x 50–270, y 120–450, con el remate en semicírculo (css: .portrait__img).
export const portraitFrame = () => `
  <svg class="portrait__frame draw" viewBox="0 0 320 480" ${SVG}>
    <g fill="none" stroke="currentColor" stroke-linejoin="miter">
      <path ${P} stroke-width="1.6" d="M30 230V446H18V472H302V446H290V230A130 130 0 0 0 30 230Z"/>
      <path ${P} stroke-width=".9" d="M42 458V230A118 118 0 0 1 278 230V458Z"/>
      <path ${P} stroke-width="1.2" d="M100 100H220${arc(160, 100, 56)}"/>
      <path ${P} stroke-width=".8" d="${arc(160, 100, 42)}"/>
      <path ${P} stroke-width=".8" d="${ribs(160, 100, 16, 56, 12, 0, 180, 50)}"/>
      <path ${P} stroke-width="1" d="M160 40V16"/>
      <path ${P} stroke-width=".8" d="M8 478V300M2 478V360M312 478V300M318 478V360"/>
    </g>
    <path class="fill" fill="currentColor" d="M144 100A16 16 0 0 1 176 100Z${diamond(160, 9, 6)}${diamond(30, 230, 4.5)}${diamond(290, 230, 4.5)}"/>
  </svg>`;

// Rayos de sol Déco: un círculo completo de rayos alternos (largo/corto).
export const rays = (cls) => `
  <svg class="rays draw ${cls}" viewBox="-1000 -1000 2000 2000" ${SVG}>
    <path ${P} fill="none" stroke="currentColor" stroke-width="1.4" d="${ribs(0, 0, 210, 640, 5, -180, 180.01, 990)}"/>
  </svg>`;

// Medio sol para el cierre: rayos solo hacia arriba.
export const sunrise = (cls) => `
  <svg class="rays draw ${cls}" viewBox="-600 -600 1200 600" preserveAspectRatio="xMidYMax meet" ${SVG}>
    <g fill="none" stroke="currentColor">
      <path ${P} stroke-width="1.2" d="${ribs(0, 0, 150, 420, 6, 0, 180, 590)}"/>
      <path ${P} stroke-width="1.2" d="${arc(0, 0, 120)}"/>
      <path ${P} stroke-width=".9" d="${arc(0, 0, 100)}"/>
    </g>
  </svg>`;

// Marco de la hora en el programa (200 × 112): rectángulo de esquinas escalonadas.
export const stamp = () => `
  <svg class="stamp__frame draw" viewBox="0 0 200 112" ${SVG}>
    <g fill="none" stroke="currentColor">
      <path ${P} stroke-width="1.3" d="M17 1H183V9H191V17H199V95H191V103H183V111H17V103H9V95H1V17H9V9H17Z"/>
      <path ${P} stroke-width=".8" d="M22 9H178L191 22V90L178 103H22L9 90V22Z"/>
    </g>
    <path class="fill" fill="currentColor" d="${diamond(100, 1, 3.4)}${diamond(100, 111, 3.4)}"/>
  </svg>`;

// Marco en arco para fotos (300 × 400). La foto va con 16 de margen y remate en semicírculo.
export const archFrame = () => `
  <svg class="arch__frame draw" viewBox="0 0 300 400" ${SVG}>
    <g fill="none" stroke="currentColor">
      <path ${P} stroke-width="1.3" d="M2 399V150A148 148 0 0 1 298 150V399H2"/>
      <path ${P} stroke-width=".8" d="M9 399V150A141 141 0 0 1 291 150V399"/>
    </g>
  </svg>`;

// Código de vestimenta: abanico de plumas y pajarita.
export const fanIcon = () => `
  <svg class="dress__icon draw" viewBox="0 0 120 80" ${SVG}>
    <g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round">
      <path ${P} d="${arc(60, 72, 54)}M6 72H114"/>
      <path ${P} d="${arc(60, 72, 40)}"/>
      <path ${P} d="${ribs(60, 72, 6, 54, 15)}"/>
      <path ${P} d="M24 46Q20 26 34 14M96 46Q100 26 86 14M60 18Q56 6 60 0Q64 6 60 18"/>
    </g>
    <path class="fill" fill="currentColor" d="M52 72A8 8 0 0 1 68 72Z"/>
  </svg>`;

export const bowtie = () => `
  <svg class="dress__icon draw" viewBox="0 0 120 80" ${SVG}>
    <g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">
      <path ${P} d="M52 34 16 16V64L52 46ZM68 34 104 16V64L68 46Z"/>
      <path ${P} d="M52 31H68V49H52Z"/>
      <path ${P} d="M28 26V54M40 32V48M92 26V54M80 32V48"/>
    </g>
    <path class="fill" fill="currentColor" d="${diamond(60, 76, 3)}${diamond(60, 4, 3)}"/>
  </svg>`;

// Ornamento de las puertas de la entrada (400 × 800). Se pinta entero en cada hoja,
// centrado en la junta, y cada hoja recorta su mitad.
export const doorArt = () => `
  <svg viewBox="0 0 400 800" ${SVG}>
    <g fill="none" stroke="currentColor">
      <path stroke-width="1.6" d="M40 784V190H70V130H110V80H160V40H240V80H290V130H330V190H360V784Z"/>
      <path stroke-width=".8" d="M52 772V202H82V142H122V92H172V52H228V92H278V142H318V202H348V772Z"/>
      <path stroke-width="1.2" d="M76 330H324${arc(200, 330, 124)}"/>
      <path stroke-width=".8" d="${arc(200, 330, 100)}"/>
      <path stroke-width=".8" d="${ribs(200, 330, 34, 124, 9, 0, 180, 100)}"/>
      <path stroke-width=".8" d="${ribs(200, 420, 74, 136, 10, 190, 350, 116)}"/>
      <circle cx="200" cy="420" r="64" stroke-width="1.4" fill="#0b0b0b"/>
      <circle cx="200" cy="420" r="56" stroke-width=".8"/>
      <path stroke-width="1" d="M112 588 200 636 288 588M112 616 200 664 288 616M112 644 200 692 288 644"/>
      <path stroke-width="1" d="M200 706V760M180 718V760M220 718V760M160 730V760M240 730V760M140 742V760M260 742V760M84 760H316"/>
      <path stroke-width=".8" d="M200 52V20"/>
    </g>
    <path fill="currentColor" d="M166 330A34 34 0 0 1 234 330Z${diamond(200, 16, 6)}${diamond(70, 190, 4)}${diamond(330, 190, 4)}"/>
  </svg>`;
