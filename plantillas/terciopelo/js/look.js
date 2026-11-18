import { dateParts, esc } from "./format.js";

// Terciopelo: una cena de invierno a la luz de las velas. Terciopelo verde botella con brillo,
// filetes de oro y tres velas encendidas cuya llama tiembla e ilumina los nombres. Para bodas de
// tarde-noche y de invierno. Prata para los títulos y Lato para el resto.

const candles = (cls = "") => `<div class="candles ${cls}" aria-hidden="true">${[64, 92, 52].map((h, i) => `<span class="candle" style="--h:${h}px;--i:${i}"><i class="flame"></i></span>`).join("")}</div>`;

export function head({ eyebrow, title, id, text }) {
  return `
      <header class="head">
        ${eyebrow ? `<p class="eyebrow head__eyebrow reveal">${esc(eyebrow)}</p>` : ""}
        ${title ? `<h2 class="head__title reveal" id="${id}">${esc(title)}</h2>` : ""}
        <span class="head__glow reveal" aria-hidden="true"><i></i><b class="flame"></b><i></i></span>
        ${text ? `<p class="head__text reveal">${esc(text)}</p>` : ""}
      </header>`;
}

export function hero({ event, venue = {}, locale, copy = {} }) {
  const [a, b] = event.couple;
  const d = dateParts(event.date, locale);
  const t = copy.hero || {};
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 5);
  const place = venue.city || venue.name || "";
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__in">
      <figure class="frame"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || "")}"${focus} fetchpriority="high"></figure>
      <div class="hero__text" style="--len:${len}">
        ${candles("hero__candles")}
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title"><span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span></h1>
        <p class="hero__date">${esc(d.day)} · ${esc(d.month)} · ${esc(d.year)}</p>
        ${place ? `<p class="hero__place">${esc(place)}</p>` : ""}
        ${event.tagline ? `<p class="hero__tagline">${esc(event.tagline)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

export function mark(i, s, total) {
  return `<span class="wick${i === total - 1 ? " wick--last" : ""}"><i class="flame"></i></span>`;
}

export function closingTop() {
  return candles("closing__candles reveal");
}
