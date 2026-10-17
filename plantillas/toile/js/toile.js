// Plantilla Toile: el estampado y el lazo, dibujados a mano en SVG.
// El estampado es una tesela de 360 × 360 con tres escenas de grabado (un templete entre
// árboles, un jarrón con flores y pájaros, una rama con un pájaro posado) y ramitas sueltas
// para que al repetirse no se vea la costura. Monocromo azul, trazo fino, sombreado a rayas.

const BLUE = "#4F6D8F";

// Rayado de sombra: n líneas paralelas cortas dentro de una zona.
const hatch = (x, y, w, n, dy = 3.2, slope = -2.2) =>
  Array.from({ length: n }, (_, i) => `M${x + i * 0.6} ${y + i * dy}l${w - i * 1.2} ${slope}`).join("");

// Penacho de hierba.
const tuft = (x, y, s = 1) =>
  `M${x} ${y}q${-2 * s} ${-5 * s} ${-6 * s} ${-8 * s}M${x} ${y}q${0.5 * s} ${-6 * s} ${-1 * s} ${-11 * s}M${x} ${y}q${2 * s} ${-5 * s} ${6 * s} ${-7 * s}`;

// Hoja almendrada con nervio.
const leaf = (x, y, a, l = 9) =>
  `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0q${l / 2} ${-l / 3} ${l} 0q${-l / 2} ${l / 3} ${-l} 0z"/><path d="M1 0h${l - 2}" stroke-width=".4"/></g>`;

// Rosa de grabado: espiral y pétalos abiertos.
const rose = (x, y, r = 6) =>
  `<g transform="translate(${x} ${y})"><path d="M0 0c1.5-1 2.5 1 1 2.2-2 1.4-4.2-1-3.2-3.4 1.2-3 5.8-3.2 7-.2 1.3 3.4-1.4 6.6-5 6.6"/>` +
  `<path d="M${-r} 1c-1-4 2-${r + 1} ${r - 1}-${r}M${r} -1c1.5 4-1 ${r + 1}-${r + 1} ${r + 1}"/>` +
  `<path d="M${-r + 1} 3l1.6-.9M${-r + 1.6} 5l1.6-.9M${r - 3} ${r - 2}l1.3-1.3" stroke-width=".45"/></g>`;

// Florecilla de cinco pétalos.
const bloom = (x, y, r = 3.2) =>
  `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M0 0q${-r / 1.6} ${-r} 0 ${-r * 1.6}q${r / 1.6} ${r * 0.6} 0 ${r * 1.6}"/>`).join("")}<circle r=".8" fill="${BLUE}" stroke="none"/></g>`;

// Pájaro en vuelo (golondrina de grabado).
const swallow = (x, y, s = 1, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><path d="M0 0c4-1 8 0 11 2.5 2-4.5 7-8 13-9-4 3.5-6 7.5-6.5 11 3 .3 6 1.3 8 3-3 0-6.5.2-9.5 1l-6 6 1.5-5.5c-4 .2-8-1.8-11.5-6.5z"/><path d="M14 4.5c2-2.5 4.5-4.6 7.5-6" stroke-width=".4"/></g>`;

// Escena 1: templete clásico en un altozano, árbol frondoso a la izquierda y ciprés a la derecha.
const temple = `
<g>
  <path d="M18 168c26-12 60-16 98-12s54 8 74 6"/>
  <path d="${hatch(36, 172, 34, 4, 3, -1.4)}${hatch(120, 166, 40, 3, 3, -1)}" stroke-width=".45"/>
  <path d="${tuft(30, 166)}${tuft(176, 162, .9)}${tuft(150, 160, .7)}" stroke-width=".55"/>
  <path d="M74 156h68M78 151h60M82 146h52"/>
  <path d="M86 146V112M98 146V112M118 146V112M130 146V112M88 146V112M100 146V112M120 146V112M132 146V112" stroke-width=".5"/>
  <path d="M83 112h52M80 108h58M82 104h54"/>
  <path d="M84 104c4-24 46-24 50 0M93 104c3-14 28-14 31 0"/>
  <path d="M90 101c2-6 4-10 7-13M96 101c1-6 3-10 5-12M102 101l1-14M111 101c0-5-1-10-2-14M117 101c-1-5-3-9-5-12M124 101c-1-4-3-8-6-11" stroke-width=".4"/>
  <path d="M109 86v-8M106.5 78h5"/><circle cx="109" cy="75.5" r="2"/>
  <path d="M103 146v-20c0-6 12-6 12 0v20" stroke-width=".55"/>
  <path d="${hatch(104, 128, 10, 6, 3, -1.2)}" stroke-width=".35"/>
  <path d="M46 164c2-14 0-28 4-44M50 140c-6-4-9-10-10-16M50 132c5-3 8-8 9-14" />
  <path d="M26 112c-7-4-4-14 4-14-3-9 7-15 14-10 2-8 14-10 18-2 8-4 16 3 13 10 8 1 10 11 3 15 5 6-1 14-8 12-2 8-12 9-16 3-6 6-16 3-16-4-9 2-15-6-12-10z"/>
  <path d="M32 106c4-2 8-2 11 1M48 96c4-1 7 0 9 3M60 112c3-2 7-2 9 0M36 120c3-1 6 0 8 2M54 122c2-2 5-2 7-1" stroke-width=".45"/>
  <path d="${hatch(30, 118, 10, 4, 2.6, -2)}${hatch(56, 120, 12, 4, 2.6, -2)}" stroke-width=".35"/>
  <path d="M160 160v-8M160 152c-9-14-7-36 0-58 7 22 9 44 0 58"/>
  <path d="M157 140l5-3M156 132l7-4M156 124l7-4M157 116l5-3M158 108l3-2" stroke-width=".4"/>
  ${swallow(64, 56, .7)}${swallow(150, 40, .55, true)}
</g>`;

// Escena 2: jarrón de piedra con rosas y hojas, sobre un pedestal.
const urn = `
<g>
  <path d="M10 112h44M14 108h36M22 108l3-10h14l3 10"/>
  <path d="${hatch(16, 102, 6, 2, 3, 0)}" stroke-width=".35"/>
  <path d="M24 98c-14-6-20-18-20-34h56c0 16-6 28-20 34z"/>
  <path d="M2 64h60M4 60h56"/>
  <path d="M6 70c-8-2-12 4-8 10 2 3 6 2 6 0M58 70c8-2 12 4 8 10-2 3-6 2-6 0"/>
  <path d="M10 72c2 10 6 17 12 22M16 72c1 9 4 15 8 19M48 72c-1 8-3 13-6 18" stroke-width=".4"/>
  <path d="M14 78l4-1M14 84l5-1M17 90l5-1" stroke-width=".35"/>
  <path d="M32 60c-2-14-10-24-20-30M32 60c0-18 2-30 6-42M32 60c4-12 12-20 22-24M32 60c-6-6-14-8-24-6"/>
  ${rose(12, 28, 7)}${rose(39, 14, 7.5)}${rose(55, 34, 6)}${bloom(6, 52, 3.4)}
  ${leaf(20, 44, -150, 10)}${leaf(36, 34, -60, 9)}${leaf(44, 44, -20, 10)}${leaf(24, 22, -120, 8)}${leaf(46, 24, -40, 8)}
  <path d="M18 60c-6-8-8-16-6-22M46 60c6-6 12-10 18-10" stroke-width=".55"/>
  ${bloom(66, 49, 2.6)}${bloom(12, 37, 2.2)}
</g>`;

// Escena 3: rama florida con un pájaro posado mirando a la derecha.
const branch = `
<g>
  <path d="M0 74c30-6 62-20 104-50M40 63c4-10 12-16 22-18M78 42c-2-8 0-16 6-22M104 24c6-2 10-6 12-12"/>
  ${leaf(12, 70, -100, 11)}${leaf(24, 68, 60, 11)}${leaf(54, 56, -120, 10)}${leaf(64, 52, 50, 11)}${leaf(92, 32, -110, 10)}${leaf(100, 28, 40, 9)}${leaf(62, 44, -20, 9)}${leaf(110, 18, -60, 8)}
  ${bloom(84, 20, 3.4)}${bloom(116, 11, 3)}${bloom(44, 61, 2.6)}${rose(6, 62, 5)}
  <g transform="translate(34 30)">
    <path d="M45 9l-6-3c-1-3-5-5-9-4-4 1-6 4-7 7-6 1-13 5-18 11l-11 6 3 2 9-3c6 5 15 6 22 3 7-3 12-9 13-16z"/>
    <path d="M10 18c6-6 14-8 22-6-5 6-12 9-20 9z"/>
    <path d="M14 18l4 2M18 15l4 3M23 13l3 3M28 12l2 3" stroke-width=".4"/>
    <path d="${hatch(14, 24, 14, 3, 2, -1)}" stroke-width=".35"/>
    <path d="M45 9l-6 1" stroke-width=".5"/>
    <circle cx="33" cy="6.5" r="1" fill="${BLUE}" stroke="none"/>
    <path d="M22 29l-1 8M27 28l1 8M19 37h4M26 36h4" stroke-width=".55"/>
  </g>
</g>`;

// Escena 4: puentecillo de piedra sobre un arroyo y un sauce llorón.
const bridge = `
<g>
  <path d="M8 74c20-2 34 2 54 0s40-4 64 0M18 82c18-2 30 1 46 0M70 82c14-1 26-1 38 1M30 90c10-1 22-1 34 0"/>
  <path d="M24 66c10-22 46-22 56 0M30 66c8-16 36-16 44 0"/>
  <path d="M18 56h68M22 52h60M24 56v-4M36 56v-4M48 56v-4M60 56v-4M72 56v-4M84 56v-4" stroke-width=".55"/>
  <path d="M18 56l6 10M86 56l-6 10"/>
  <path d="M32 64l3-6M38 61l2-5M44 60l1-4M60 60l-1-4M66 61l-2-5M72 64l-3-6" stroke-width=".4"/>
  <path d="${hatch(34, 70, 12, 3, 3, 0)}${hatch(58, 70, 12, 3, 3, 0)}" stroke-width=".35"/>
  <path d="M108 72c0-14-2-26 1-40M109 34c-6-6-14-8-22-6M109 34c6-6 14-8 22-4M109 40c-8-2-14 0-19 5M109 40c8-2 14 0 19 6M109 32c-2-6 0-12 4-16"/>
  <path d="M90 29c-2 8-2 18 0 28M95 28c-1 10-1 20 1 32M100 29c-1 8 0 16 1 24M104 24c-2 6-2 12-1 18M118 29c1 8 1 18-1 28M124 30c1 10 2 18 0 30M130 32c1 8 1 14 0 20M92 44c-1 6-1 12 0 18M126 46c1 6 1 10 0 16M114 18c2 6 3 12 2 18M87 30c-2 6-2 12-1 16" stroke-width=".5"/>
  <path d="M89 36l-2 2M89 44l-2 2M96 40l-2 2M96 50l-2 2M123 38l2 2M123 48l2 2M129 40l2 2M117 40l2 2M101 38l-2 2" stroke-width=".4"/>
  <path d="${tuft(6, 70, .9)}${tuft(132, 70, .8)}" stroke-width=".55"/>
</g>`;

// Ramitas sueltas que rellenan los huecos.
const sprigs = `
<g stroke-width=".6">
  <path d="M176 224c6-8 8-18 6-28"/>${leaf(178, 216, -60, 8)}${leaf(181, 206, -130, 8)}${bloom(182, 194, 2.8)}
  <path d="M250 70c10-6 16-16 18-28"/>${leaf(256, 64, -50, 8)}${leaf(262, 56, -140, 8)}${leaf(266, 48, -60, 7)}${rose(270, 36, 5)}
  <path d="M330 120c-8-4-12-12-12-20"/>${leaf(324, 114, -150, 7)}${leaf(320, 106, -40, 7)}${bloom(318, 98, 2.4)}
  <path d="M20 300c4-12 12-20 22-24"/>${leaf(26, 290, -80, 8)}${leaf(32, 282, -10, 8)}${bloom(44, 274, 2.8)}
  <path d="M30 210c6-4 10-10 10-18"/>${leaf(36, 204, -40, 7)}${bloom(40, 190, 2.4)}
  ${bloom(190, 336, 2.6)}${bloom(16, 20, 2.4)}${bloom(196, 120, 2)}${bloom(330, 18, 2.2)}${bloom(232, 214, 2.2)}
  ${swallow(150, 262, .55)}${swallow(296, 70, .55, true)}${swallow(60, 340, .5)}
</g>`;

// Coloca una escena y sus copias a 360 px: la que cruza un borde reaparece por el opuesto.
const place = (scene, x, y) =>
  [[0, 0], [-360, 0], [0, -360], [-360, -360]].map(([dx, dy]) => `<g transform="translate(${x + dx} ${y + dy})">${scene}</g>`).join("");

const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><g fill="none" stroke="${BLUE}" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round">${place(temple, 0, -14)}${place(branch, 196, 120)}${place(bridge, 70, 232)}${place(urn, 270, 250)}${sprigs}</g></svg>`;

export const toileSvg = tile;
export const toileUrl = `url("data:image/svg+xml,${encodeURIComponent(tile.replace(/\s+/g, " "))}")`;

// La hoja de estilos usa var(--toile) en marcos, bandas y fondos.
document.documentElement.style.setProperty("--toile", toileUrl);

// Lazo de seda en rosa empolvado. Los dobleces son trazos más oscuros; sin degradados
// con id para que varios lazos en la página no choquen.
export const bow = (cls = "") => `
  <svg class="bow ${cls}" viewBox="0 0 140 96" aria-hidden="true" focusable="false">
    <g class="bow__tail bow__tail--l"><path d="M64 46c-6 14-16 30-28 44l10-1 4 7c10-14 18-30 20-46z" fill="#E7D6CF" stroke="#B98F84" stroke-width=".8" stroke-linejoin="round"/><path d="M63 52c-5 12-12 24-20 34" fill="none" stroke="#CDB0A6" stroke-width=".8"/></g>
    <g class="bow__tail bow__tail--r"><path d="M76 46c6 14 16 30 28 44l-10-1-4 7c-10-14-18-30-20-46z" fill="#E7D6CF" stroke="#B98F84" stroke-width=".8" stroke-linejoin="round"/><path d="M77 52c5 12 12 24 20 34" fill="none" stroke="#CDB0A6" stroke-width=".8"/></g>
    <g class="bow__loop bow__loop--l"><path d="M66 40C52 22 26 8 12 16 2 22 6 42 20 48c14 6 32 2 46-4z" fill="#E7D6CF" stroke="#B98F84" stroke-width=".8" stroke-linejoin="round"/><path d="M62 40C48 30 30 24 20 28M60 43C46 40 30 40 18 38" fill="none" stroke="#CDB0A6" stroke-width=".8" stroke-linecap="round"/><path d="M14 20c4-4 12-4 18-1" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/></g>
    <g class="bow__loop bow__loop--r"><path d="M74 40c14-18 40-32 54-24 10 6 6 26-8 32-14 6-32 2-46-4z" fill="#E7D6CF" stroke="#B98F84" stroke-width=".8" stroke-linejoin="round"/><path d="M78 40c14-10 32-16 42-12M80 43c14-3 30-3 42-5" fill="none" stroke="#CDB0A6" stroke-width=".8" stroke-linecap="round"/><path d="M108 18c6-1 12 0 16 4" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/></g>
    <g class="bow__knot"><path d="M63 34c4-2 10-2 14 0 2 4 2 12 0 16-4 2-10 2-14 0-2-4-2-12 0-16z" fill="#E2CBC2" stroke="#B98F84" stroke-width=".8"/><path d="M66 37c3-1 6-1 8 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/><path d="M65 46c3 1 7 1 10 0" fill="none" stroke="#CDB0A6" stroke-width=".8" stroke-linecap="round"/></g>
  </svg>`;
