// Lo que hay sobre la mesa, dibujado en SVG: cubiertos dorados, copas vistas desde arriba y
// ramitas de eucalipto. Todo es decorativo (aria-hidden) y se escala con la unidad --u de la mesa.

const f = (n) => Number(n.toFixed(2));

// Degradado dorado de los cubiertos: cada SVG lleva el suyo, con un id propio, para que
// funcione aunque haya varios en la página (o el navegador recorte uno que no se ve).
let gid = 0;
const gold = () => {
  const id = `oro${++gid}`;
  return {
    id,
    defs: `<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#8f6f3b"/><stop offset=".32" stop-color="#e6cf98"/>
      <stop offset=".55" stop-color="#c7a462"/><stop offset="1" stop-color="#86672f"/></linearGradient></defs>`,
  };
};

const PATHS = {
  fork: "M2.2,4Q2.2,1.6 3.9,1.6Q5.6,1.6 5.6,4L5.6,32Q5.6,34.5 6.6,34.5Q7.6,34.5 7.6,32L7.6,4Q7.6,1.6 9.3,1.6Q11,1.6 11,4L11,32Q11,34.5 12,34.5Q13,34.5 13,32L13,4Q13,1.6 14.7,1.6Q16.4,1.6 16.4,4L16.4,32Q16.4,34.5 17.4,34.5Q18.4,34.5 18.4,32L18.4,4Q18.4,1.6 20.1,1.6Q21.8,1.6 21.8,4L21.8,38C21.8,50 15,56 14.6,66L14.6,84C14.6,110 18.2,150 18.2,180C18.2,192 15.5,198 12,198C8.5,198 5.8,192 5.8,180C5.8,150 9.4,110 9.4,84L9.4,66C9,56 2.2,50 2.2,38Z",
  knife: "M15.6,98L15.6,10C15.6,5 14.6,2 12.8,2C9.6,2 6.6,9 6.6,24C6.6,52 7.4,80 8.6,92C8.9,95 9.4,97 9.6,98L9.6,104C9.6,130 6.4,160 6.4,182C6.4,193 9,198 12,198C15,198 17.6,193 17.6,182C17.6,160 15,130 15,104Z",
  spoon: "M12,2C17.6,2 21,10 21,22C21,34 16,42 13.6,46C13.2,52 13,60 13.2,72C13.6,110 17.6,150 17.6,180C17.6,192 15,198 12,198C9,198 6.4,192 6.4,180C6.4,150 10.4,110 10.8,72C11,60 10.8,52 10.4,46C8,42 3,34 3,22C3,10 6.4,2 12,2Z",
};

// Cubierto de pie, de 24 × 200: tenedor, cuchillo o cuchara.
export function cutlery(kind) {
  const g = gold();
  const bowl = kind === "spoon"
    ? `<ellipse cx="12" cy="21" rx="6.4" ry="15.5" fill="rgb(90 64 24 / .22)"/><ellipse cx="10.4" cy="16" rx="2" ry="8" fill="rgb(255 246 220 / .55)"/>`
    : "";
  const edge = kind === "knife" ? `<path d="M7.6,26C7.6,52 8.2,78 9.2,92" stroke="rgb(255 246 220 / .7)" stroke-width=".8" fill="none"/>` : "";
  return `<svg class="prop__svg" viewBox="0 0 24 200" aria-hidden="true" focusable="false">${g.defs}
    <path d="${PATHS[kind]}" fill="url(#${g.id})" stroke="rgb(110 82 36 / .55)" stroke-width=".5"/>${bowl}${edge}
    <path d="M12,${kind === "spoon" ? 80 : 90}C12.6,120 14.6,150 14.8,180" stroke="rgb(255 248 228 / .55)" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`;
}

// Copa vista desde arriba: el borde, el pie que se transparenta y un par de brillos.
export function glass() {
  const id = `luz${++gid}`;
  return `<svg class="prop__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><radialGradient id="${id}"><stop offset="0" stop-color="#fff6de" stop-opacity=".75"/><stop offset=".45" stop-color="#fff3d8" stop-opacity=".25"/><stop offset=".8" stop-color="#5a4628" stop-opacity=".08"/><stop offset="1" stop-color="#5a4628" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="64" cy="70" rx="50" ry="46" fill="url(#${id})"/>
    <circle cx="50" cy="50" r="46" fill="rgb(255 255 255 / .16)" stroke="rgb(255 255 255 / .95)" stroke-width="2.6"/>
    <circle cx="50" cy="50" r="42.6" fill="none" stroke="rgb(96 82 66 / .2)" stroke-width="1"/>
    <circle cx="52" cy="53" r="29" fill="none" stroke="rgb(96 82 66 / .14)" stroke-width="1.4"/>
    <circle cx="51" cy="52" r="5" fill="rgb(255 255 255 / .5)" stroke="rgb(96 82 66 / .22)" stroke-width="1"/>
    <path d="M18,40A34,34 0 0 1 40,17" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M70,80A34,34 0 0 0 82,64" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>
  </svg>`;
}

// Ramita de eucalipto: tallo curvo y hojas redondas que menguan hacia la punta.
export function sprig(seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const P = (t) => {
    // Curva del tallo (bezier cúbica) de abajo arriba en una caja de 60 × 160.
    const a = [30, 158], b = [24, 110], c = [40, 60], d = [30, 4];
    const m = 1 - t;
    return [
      m ** 3 * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t ** 3 * d[0],
      m ** 3 * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t ** 3 * d[1],
    ];
  };
  const leaves = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = 0.1 + (0.86 * i) / (n - 1);
    const [x, y] = P(t);
    const side = i % 2 ? 1 : -1;
    const r = 13 - 8 * t + rnd() * 1.6;
    const cx = x + side * (r * 0.86), cy = y - r * 0.2;
    const tone = ["#8fa290", "#9db09c", "#7f937f", "#a9b9a6"][Math.floor(rnd() * 4)];
    leaves.push(`<g transform="rotate(${f(side * (18 + rnd() * 16))} ${f(x)} ${f(y)})">
      <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * 0.92)}" fill="${tone}"/>
      <ellipse cx="${f(cx - side * r * 0.18)}" cy="${f(cy - r * 0.22)}" rx="${f(r * 0.55)}" ry="${f(r * 0.4)}" fill="rgb(255 255 255 / .16)"/>
      <path d="M${f(x)},${f(y)}L${f(cx + side * r * 0.4)},${f(cy - r * 0.1)}" stroke="rgb(70 88 70 / .35)" stroke-width=".7"/></g>`);
  }
  const stem = Array.from({ length: 21 }, (_, i) => P(i / 20)).map(([x, y], i) => `${i ? "L" : "M"}${f(x)},${f(y)}`).join("");
  return `<svg class="prop__svg" viewBox="0 0 60 160" aria-hidden="true" focusable="false">
    <path d="${stem}" stroke="#6f7f63" stroke-width="1.6" fill="none" stroke-linecap="round"/>${leaves.join("")}</svg>`;
}
