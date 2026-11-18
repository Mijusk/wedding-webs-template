import { dateParts, esc } from "./format.js";

// Perla: minimalismo de marfil y nácar. Un collar de perlas cuelga de lado a lado de la portada y
// se ensarta perla a perla desde el centro, con una perla en lágrima. Nombres en Cormorant fina,
// mucho aire, filetes de un pelo. Cormorant Garamond y Montserrat.

// Collar: perlas repartidas a la misma distancia a lo largo de una catenaria
function strand({ w = 1000, sag = 200, r = 9, drop = true } = {}) {
  const a = (w / 2) ** 2 / (2 * sag);
  const pts = [];
  let len = 0;
  const fy = (x) => sag - ((x - w / 2) ** 2) / (2 * a) + 8;
  const step = 2;
  let last = [0, fy(0)];
  pts.push(last);
  for (let x = step; x <= w; x += step) {
    const p = [x, fy(x)];
    len += Math.hypot(p[0] - last[0], p[1] - last[1]);
    if (len >= r * 2.25) { pts.push(p); len = 0; }
    last = p;
  }
  const mid = Math.floor(pts.length / 2);
  const pearls = pts.map(([x, yy], i) => {
    const k = Math.abs(i - mid);
    const rr = r * (1.05 - Math.min(k / mid, 1) * .3);
    return `<circle class="pearl-c" fill="url(#nacre)" cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${rr.toFixed(1)}" style="--d:${(k * .045).toFixed(2)}s"/>`;
  }).join("");
  const [cx, cy] = pts[mid];
  const tear = drop ? `<g class="tear" style="--d:${(mid * .045 + .2).toFixed(2)}s"><path class="tear__hook" d="M${cx} ${cy + r} v10"/><path class="pearl-c" fill="url(#nacre)" d="M${cx} ${cy + r + 10}c-${r * 1.3} ${r * 1.6}-${r * 1.6} ${r * 3.6} 0 ${r * 3.6}c${r * 1.6} 0 ${r * 1.3}-${r * 2} 0-${r * 3.6}z"/></g>` : "";
  return { pearls, tear, h: Math.ceil(fy(w / 2) + r * 6) };
}

let n = 0;
const necklace = (cls = "", opts) => {
  const { pearls, tear, h } = strand(opts);
  const id = `nacre-${n + 1}`;
  return `<svg class="necklace ${cls}" viewBox="-12 -12 1024 ${h + 12}" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false">
  <defs><radialGradient id="nacre-${++n}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#F4EFE8"/><stop offset=".8" stop-color="#DCD3C8"/><stop offset="1" stop-color="#C9BFB3"/></radialGradient></defs>
  ${(pearls + tear).replaceAll("url(#nacre)", `url(#${id})`)}
</svg>`;
};

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <p class="head__pearls reveal" aria-hidden="true"><i></i><i></i><i></i></p>
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = String(a).length + String(b).length + 3;
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    ${necklace("hero__necklace hero__necklace--wide", { w: 1000, sag: 120, r: 8 })}
    ${necklace("hero__necklace hero__necklace--narrow", { w: 1000, sag: 260, r: 22 })}
    <div class="hero__text" style="--len:${len}">
      ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
      <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span> <span class="amp">&amp;</span> <span>${esc(b)}</span></h1>
      <p class="hero__date">${esc(d.day)}<i></i>${esc(d.month)}<i></i>${esc(d.year)}</p>
      ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
    </div>
    <figure class="hero__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="pearl${i === total - 1 ? " pearl--last" : ""}"></span>`;
}

export function closingTop() {
  return `<div class="closing__necklace reveal">${necklace("", { w: 1000, sag: 90, r: 11, drop: true })}</div>`;
}
