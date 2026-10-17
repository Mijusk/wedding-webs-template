import { dateParts, time, daysUntil, esc, fill, interpolate, rsvpClosed } from "./format.js";
import { calendarUrl } from "./calendar.js";

// Plantilla Ciudades: bodas de destino o parejas de dos sitios. Estética de pasaporte:
// papel crema, azul tinta, rojo de sello y guilloché fino. La portada es un pasaporte abierto
// (página de la foto + página de datos) sobre el que cae un sello con la fecha y el lugar.
// Con config.cities (dos ciudades con tz, lat y lon) aparecen dos relojes con la hora real
// de cada casa y un mapa esquemático con el vuelo entre las dos.

/* ---------- utilidades ---------- */

const f1 = (n) => (Math.round(n * 10) / 10).toString();
const arrow = `<span class="link__arrow" aria-hidden="true">→</span>`;

// Fecha larga en el idioma de la página ("sábado, 12 de junio de 2027" / "Saturday 12 June 2027").
export function longDate(iso, locale) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

// Fecha de sello: 12 · JUN · 2027 (mes abreviado en el idioma, sin punto).
export function stampDate(iso, locale) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const month = d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }).replace(/\./g, "").toUpperCase();
  return { day: String(d.getUTCDate()), month, year: String(d.getUTCFullYear()) };
}

// Mayúsculas sin tildes, para la zona legible por máquina del pasaporte y los sellos.
const plain = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const mrz = (s) => plain(s).replace(/[^A-Z0-9]+/g, "<").replace(/^<+|<+$/g, "");
const pad = (s, n = 44) => (s + "<".repeat(n)).slice(0, n);

// Ciudades válidas (dos, con coordenadas numéricas). Si no, la plantilla es una boda normal.
export function validCities(config) {
  const list = Array.isArray(config.cities) ? config.cities : [];
  const ok = list.filter((c) => c && c.name && Number.isFinite(+c.lat) && Number.isFinite(+c.lon));
  return ok.length >= 2 ? ok.slice(0, 2) : [];
}

// Secciones numeradas como páginas: el número sale de las que de verdad se pintan.
const NUMBERED = {
  details: () => true,
  travel: (c) => c.copy?.travel?.items?.some((i) => i && (i.label || i.text)),
  story: (c) => c.story?.chapters?.some((ch) => ch.text),
  schedule: (c) => c.schedule?.length,
  gallery: (c) => c.gallery?.length,
  gifts: (c) => c.gifts?.iban,
};
function pageOf(config, name) {
  const shown = (config.sections || []).filter((s) => NUMBERED[s] && NUMBERED[s](config));
  const i = shown.indexOf(name);
  return i < 0 ? "" : String(i + 1).padStart(2, "0");
}

// Cabecera de sección: antetítulo, filete y número de página, como en un pasaporte.
function head(config, name, eyebrow, title, id) {
  const n = pageOf(config, name);
  return `
      <header class="head reveal">
        <p class="head__bar">
          ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}
          <span class="head__rule" aria-hidden="true"></span>
          ${n ? `<span class="head__page" aria-hidden="true">${n}</span>` : ""}
        </p>
        ${title ? `<h2 class="head__title" id="${id}">${esc(title)}</h2>` : ""}
      </header>`;
}

const plane = (cls = "plane") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 12c0-.8-.7-1.3-1.5-1.3h-5.2L10 3.2H8.2l2.3 7.5H5.8L4.2 8.6H2.8l1 3.4-1 3.4h1.4l1.6-2.1h4.7l-2.3 7.5H10l4.8-7.5H20c.8 0 1.5-.5 1.5-1.3z"/></svg>`;

/* ---------- sello ---------- */

// Sello circular de tinta roja: ciudad arriba, "Boda" abajo, la fecha en el centro.
// El filtro da la tinta irregular: bordes con pequeñas ondulaciones y zonas con menos tinta.
export function stamp({ id, city, label, date, small = false }) {
  // El arco superior mide unos 200 de ancho útil: la letra se ajusta a lo largo del nombre.
  const top = plain(city).replace(/\s+/g, " ").trim().slice(0, 30) || "★";
  const bottom = plain(label).slice(0, 18);
  const fs = f1(Math.min(14, 172 / (top.length * 0.9)));
  return `
  <svg class="stamp${small ? " stamp--small" : ""}" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <filter id="${id}-ink" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="grain"/>
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2" xChannelSelector="R" yChannelSelector="G" result="rough"/>
        <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="11" result="blot"/>
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 2.4" result="mask"/>
        <feComposite in="rough" in2="mask" operator="in"/>
      </filter>
      <path id="${id}-top" d="M30 100a70 70 0 0 1 140 0"/>
      <path id="${id}-bot" d="M24 100a76 76 0 0 0 152 0"/>
    </defs>
    <g filter="url(#${id}-ink)">
      <circle cx="100" cy="100" r="93" class="stamp__ring"/>
      <circle cx="100" cy="100" r="86" class="stamp__hair"/>
      <circle cx="100" cy="100" r="56" class="stamp__hair"/>
      <text class="stamp__arc" font-size="${fs}"><textPath href="#${id}-top" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>
      <text class="stamp__arc" font-size="12"><textPath href="#${id}-bot" startOffset="50%" text-anchor="middle" dominant-baseline="hanging">${esc(bottom)}</textPath></text>
      <path class="stamp__star" d="M22 100l3.5-2 3.5 2-3.5 2zM171 100l3.5-2 3.5 2-3.5 2z"/>
      <text class="stamp__day" x="100" y="107" text-anchor="middle">${esc(date.day)}</text>
      <path class="stamp__hair" d="M66 116H134"/>
      <text class="stamp__month" x="100" y="133" text-anchor="middle">${esc(date.month)} · ${esc(date.year)}</text>
    </g>
  </svg>`;
}

// Sello rectangular azul de "entrada" (estático, más tenue): ruta entre las dos ciudades.
function entryStamp(cities, date) {
  if (cities.length < 2) return "";
  const [a, b] = cities.map((c) => plain(c.name).slice(0, 12));
  return `
  <svg class="entry" viewBox="0 0 180 84" aria-hidden="true">
    <g filter="url(#hero-stamp-ink)">
      <rect x="3" y="3" width="174" height="78" rx="9" class="entry__ring"/>
      <rect x="9" y="9" width="162" height="66" rx="5" class="entry__hair"/>
      <text x="90" y="31" text-anchor="middle" class="entry__city">${esc(a)}</text>
      <path d="M40 43H80M100 43H140" class="entry__hair"/>
      <g transform="translate(84 37) scale(.5)"><path class="entry__plane" d="M21.5 12c0-.8-.7-1.3-1.5-1.3h-5.2L10 3.2H8.2l2.3 7.5H5.8L4.2 8.6H2.8l1 3.4-1 3.4h1.4l1.6-2.1h4.7l-2.3 7.5H10l4.8-7.5H20c.8 0 1.5-.5 1.5-1.3z"/></g>
      <text x="90" y="64" text-anchor="middle" class="entry__city">${esc(b)}</text>
    </g>
  </svg>`;
}

/* ---------- portada ---------- */

export function hero(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.hero || {};
  const [a, b] = event.couple;
  const cities = validCities(config);
  const focus = event.photoFocus ? ` style="object-position:${esc(event.photoFocus)}"` : "";
  const len = Math.max(String(a).length, String(b).length, 4);
  const sd = stampDate(event.date, locale);
  const tagline = t.tagline || event.tagline;
  const yymmdd = event.date.slice(2, 10).replace(/-/g, "");
  const line1 = pad(`W<${mrz(venue.city || venue.name).slice(0, 3)}${mrz(a)}<<${mrz(b)}`);
  const line2 = pad(`${yymmdd}<${cities.map((c) => mrz(c.name).slice(0, 3)).join("<")}<<${mrz(venue.name)}`);
  const field = (label, value, cls = "") => (value ? `<div class="pp__field${cls}"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "");
  return `
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero__in">
      <div class="hero__text">
        ${t.eyebrow ? `<p class="eyebrow hero__eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h1 class="hero__names" id="hero-title" style="--len:${len}">
          <span class="hero__name">${esc(a)}</span>
          <span class="hero__amp">&amp;</span>
          <span class="hero__name">${esc(b)}</span>
        </h1>
        ${cities.length ? `<p class="hero__route"><span>${esc(cities[0].name)}</span><span class="hero__dash" aria-hidden="true"></span>${plane("plane hero__plane")}<span class="hero__dash" aria-hidden="true"></span><span>${esc(cities[1].name)}</span></p>` : ""}
        ${tagline ? `<p class="hero__tagline">${esc(tagline)}</p>` : ""}
        <p class="hero__date">${esc(longDate(event.date, locale))}${venue.city ? ` <span aria-hidden="true">·</span> ${esc(venue.city)}` : ""}</p>
      </div>
      <div class="hero__doc">
        <div class="pp">
          <figure class="pp__page pp__page--photo">
            <div class="pp__photo"><img src="${esc(event.photo)}" alt="${esc(event.photoAlt || `${a} & ${b}`)}"${focus} fetchpriority="high"></div>
            <div class="pp__entry">${entryStamp(cities, sd)}</div>
          </figure>
          <div class="pp__page pp__page--data">
            <p class="pp__head"><span>${esc(t.document || "")}</span><span class="pp__no">Nº ${esc(yymmdd)}</span></p>
            <dl class="pp__fields">
              ${field(t.holders, `${esc(a)} &amp; ${esc(b)}`, " pp__field--wide pp__field--names")}
              ${field(t.date, `${esc(sd.day)} ${esc(sd.month)} ${esc(sd.year)}`)}
              ${field(t.time, esc(time(event.date)))}
              ${field(t.destination, esc(venue.city || ""), cities.length ? "" : " pp__field--wide")}
              ${cities.length ? field(t.from, cities.map((c) => esc(c.name)).join(" · ")) : ""}
              ${field(t.place, esc(venue.name || ""), " pp__field--wide")}
            </dl>
            <p class="pp__mrz" aria-hidden="true"><span>${esc(line1)}</span><span>${esc(line2)}</span></p>
          </div>
          <div class="hero__stamp">${stamp({ id: "hero-stamp", city: venue.city || venue.name, label: t.stamp || "", date: sd })}</div>
        </div>
      </div>
    </div>
  </section>${citiesBand(config, cities)}`;
}

/* ---------- dos ciudades: relojes y mapa ---------- */

function clock(city, i, t) {
  return `
      <figure class="clock reveal" style="--i:${i}" data-tz="${esc(city.tz || "")}">
        <svg class="clock__face" viewBox="0 0 120 120" role="img" aria-label="${fill(t.clock || "{city}", { city: city.name })}">
          <circle cx="60" cy="60" r="57" class="clock__rim"/>
          <circle cx="60" cy="60" r="52.5" class="clock__hair"/>
          ${Array.from({ length: 60 }, (_, k) => {
            const hour = k % 5 === 0;
            const a = (k * Math.PI) / 30, r1 = hour ? 44 : 48.5, r2 = 51;
            return `<line x1="${f1(60 + r1 * Math.sin(a))}" y1="${f1(60 - r1 * Math.cos(a))}" x2="${f1(60 + r2 * Math.sin(a))}" y2="${f1(60 - r2 * Math.cos(a))}" class="${hour ? "clock__tick clock__tick--h" : "clock__tick"}"/>`;
          }).join("")}
          <path d="M60 11.5l2.2 3.8-2.2 3.8-2.2-3.8z" class="clock__mark"/>
          <line x1="60" y1="64" x2="60" y2="33" class="clock__hand clock__hand--h" data-hand="h"/>
          <line x1="60" y1="66" x2="60" y2="17" class="clock__hand clock__hand--m" data-hand="m"/>
          <g class="clock__hand clock__hand--s" data-hand="s"><line x1="60" y1="72" x2="60" y2="13"/><circle cx="60" cy="60" r="2.4"/></g>
          <circle cx="60" cy="60" r="1" class="clock__pin"/>
        </svg>
        <figcaption>
          <span class="clock__city">${esc(city.name)}</span>
          ${city.country ? `<span class="eyebrow clock__country">${esc(city.country)}</span>` : ""}
          <span class="clock__digital" data-digital aria-live="off">—:—</span>
        </figcaption>
      </figure>`;
}

const rad = (d) => (d * Math.PI) / 180;
function vec(lat, lon) {
  const p = rad(lat), l = rad(lon);
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

export function distanceKm(a, b) {
  const dp = rad(b.lat - a.lat), dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Mapa esquemático: proyección ortográfica centrada entre las dos ciudades, con la escala
// justa para que queden bien separadas (de dos barrios a dos continentes). Solo meridianos,
// paralelos, el contorno del globo si cabe, los dos puntos y el arco del vuelo.
export function routeMap(cities, label) {
  const [A, B] = cities.map((c) => ({ ...c, lat: +c.lat, lon: +c.lon }));
  const W = 360, C = W / 2, WIN = 168;
  const va = vec(A.lat, A.lon), vb = vec(B.lat, B.lon);
  let m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
  const mn = Math.hypot(...m);
  m = mn < 1e-6 ? va : m.map((x) => x / mn);
  const lat0 = Math.asin(m[2]), lon0 = Math.atan2(m[1], m[0]);
  const proj = (lat, lon) => {
    const p = rad(lat), dl = rad(lon) - lon0;
    const cosc = Math.sin(lat0) * Math.sin(p) + Math.cos(lat0) * Math.cos(p) * Math.cos(dl);
    return { x: Math.cos(p) * Math.sin(dl), y: Math.cos(lat0) * Math.sin(p) - Math.sin(lat0) * Math.cos(p) * Math.cos(dl), vis: cosc >= -1e-9 };
  };
  const ua = proj(A.lat, A.lon), ub = proj(B.lat, B.lon);
  const ud = Math.hypot(ua.x - ub.x, ua.y - ub.y) || 0.01;
  const R = Math.max(150, Math.min(40000, 180 / ud));
  const S = (u) => ({ x: C + R * u.x, y: C - R * u.y, vis: u.vis });

  // Retícula: paso "redondo" según lo que se ve dentro de la ventana.
  const span = Math.min(180, (WIN / R) * (180 / Math.PI));
  const step = [0.5, 1, 2, 5, 10, 15, 30].find((s) => s >= span / 3.2) || 30;
  const lat0d = (lat0 * 180) / Math.PI, lon0d = (lon0 * 180) / Math.PI;
  const reach = Math.min(180, span * 1.6);
  const lines = [];
  const trace = (pts) => {
    let d = "", pen = false;
    for (const [lat, lon] of pts) {
      const s = S(proj(lat, lon));
      const inside = s.vis && Math.hypot(s.x - C, s.y - C) < WIN + 14;
      if (inside) { d += `${pen ? "L" : "M"}${f1(s.x)} ${f1(s.y)}`; pen = true; } else pen = false;
    }
    if (d) lines.push(d);
  };
  const N = 72;
  const latLo = Math.max(-90, lat0d - reach), latHi = Math.min(90, lat0d + reach);
  const lonReach = Math.min(180, reach / Math.max(0.15, Math.cos(rad(Math.min(85, Math.abs(lat0d) + reach / 2)))));
  for (let lon = Math.ceil((lon0d - lonReach) / step) * step; lon <= lon0d + lonReach; lon += step) {
    trace(Array.from({ length: N + 1 }, (_, k) => [latLo + ((latHi - latLo) * k) / N, lon]));
  }
  for (let lat = Math.ceil(latLo / step) * step; lat <= latHi; lat += step) {
    if (Math.abs(lat) >= 90) continue;
    trace(Array.from({ length: N + 1 }, (_, k) => [lat, lon0d - lonReach + (2 * lonReach * k) / N]));
  }

  const pa = S(ua), pb = S(ub);
  // Arco del vuelo: curva que se levanta hacia "arriba" (norte) sobre la cuerda entre los puntos.
  const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const lift = len * 0.3;
  const cx = (pa.x + pb.x) / 2 + nx * lift, cy = (pa.y + pb.y) / 2 + ny * lift;
  const mx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x, my = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const arc = `M${f1(pa.x)} ${f1(pa.y)}Q${f1(cx)} ${f1(cy)} ${f1(pb.x)} ${f1(pb.y)}`;
  // Etiquetas: debajo del punto más bajo y encima del más alto, para no pisar el arco.
  const lab = (p, other, name) => {
    const below = p.y >= other.y;
    return `<text x="${f1(p.x)}" y="${f1(below ? p.y + 26 : p.y - 16)}" text-anchor="middle" class="map__label">${esc(name)}</text>`;
  };
  return `
    <svg class="map" viewBox="0 0 ${W} ${W}" role="img" aria-label="${esc(label)}">
      <defs>
        <clipPath id="map-win"><circle cx="${C}" cy="${C}" r="${WIN}"/></clipPath>
        <mask id="map-draw" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${W}"><path d="${arc}" class="map__draw" pathLength="1"/></mask>
      </defs>
      <circle cx="${C}" cy="${C}" r="${WIN}" class="map__win"/>
      <g clip-path="url(#map-win)">
        <path d="${lines.join("")}" class="map__grid"/>
        ${R < WIN + 40 ? `<circle cx="${C}" cy="${C}" r="${f1(R)}" class="map__limb"/>` : ""}
      </g>
      <circle cx="${C}" cy="${C}" r="${WIN + 6}" class="map__hair"/>
      <path d="${arc}" class="map__arc" mask="url(#map-draw)"/>
      <g class="map__plane" transform="translate(${f1(mx)} ${f1(my)}) rotate(${f1(ang)})"><g transform="translate(-9 -9) scale(.75)"><path d="M21.5 12c0-.8-.7-1.3-1.5-1.3h-5.2L10 3.2H8.2l2.3 7.5H5.8L4.2 8.6H2.8l1 3.4-1 3.4h1.4l1.6-2.1h4.7l-2.3 7.5H10l4.8-7.5H20c.8 0 1.5-.5 1.5-1.3z"/></g></g>
      ${[pa, pb].map((p) => `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="8" class="map__halo"/><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="3.4" class="map__dot"/>`).join("")}
      ${lab(pa, pb, A.name)}${lab(pb, pa, B.name)}
    </svg>`;
}

function citiesBand(config, cities) {
  if (cities.length < 2) return "";
  const { event, locale, copy = {} } = config;
  const t = copy.cities || {};
  const [a, b] = event.couple;
  const [A, B] = cities;
  const vars = { a, b, cityA: A.name, cityB: B.name };
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(distanceKm({ lat: +A.lat, lon: +A.lon }, { lat: +B.lat, lon: +B.lon }) / 10) * 10);
  return `
  <section class="section band" aria-labelledby="cities-title">
    <div class="wrap">
      <header class="band__head reveal">
        ${t.eyebrow ? `<p class="eyebrow">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="band__title" id="cities-title">${fill(t.title || "{cityA} · {cityB}", vars)}</h2>
        ${t.text ? `<p class="band__text">${fill(t.text, vars)}</p>` : ""}
      </header>
      <div class="band__grid">
        ${clock(A, 0, t)}
        <div class="route reveal" style="--i:1">
          ${routeMap(cities, interpolate(t.map || "{cityA} – {cityB}", vars))}
          <p class="route__meta"><span>${fill(t.distance || "{km} km", { km })}</span><span class="route__diff" data-diff data-tz-a="${esc(A.tz || "")}" data-tz-b="${esc(B.tz || "")}" data-one="${esc(t.diffOne || "")}" data-many="${esc(t.diff || "")}" data-same="${esc(t.diffSame || "")}"></span></p>
        </div>
        ${clock(B, 2, t)}
      </div>
    </div>
  </section>`;
}

/* ---------- secciones ---------- */

export function details(config) {
  const { event, venue = {}, locale, copy = {} } = config;
  const t = copy.details || {};
  const d = dateParts(event.date, locale);
  const days = daysUntil(event.date);
  const countdown = days < 0 ? "" : fill(days === 0 ? t.countdownToday : days === 1 ? t.countdownOne : t.countdown, { days });
  return `
  <section class="section details" aria-labelledby="details-title">
    <div class="wrap">
      ${head(config, "details", t.eyebrow, t.title || venue.name || "", "details-title")}
      <div class="visa reveal">
        ${countdown ? `<p class="visa__count">${countdown}</p>` : ""}
        <dl class="visa__grid">
          <div class="visa__cell">
            <dt class="eyebrow">${esc(t.when || "Fecha")}</dt>
            <dd class="visa__big">${esc(d.dayMonth)}</dd>
            <dd class="visa__small">${esc(d.weekday)} · ${esc(d.year)}</dd>
            ${t.calendar ? `<dd><a class="link" href="${esc(calendarUrl(config))}" target="_blank" rel="noopener">${esc(t.calendar)} ${arrow}</a></dd>` : ""}
          </div>
          <div class="visa__cell">
            <dt class="eyebrow">${esc(t.time || "Hora")}</dt>
            <dd class="visa__big">${esc(time(event.date))}${t.timeSuffix ? `<small> ${esc(t.timeSuffix)}</small>` : ""}</dd>
            ${venue.city ? `<dd class="visa__small">${esc(venue.city)}</dd>` : ""}
          </div>
          <div class="visa__cell">
            <dt class="eyebrow">${esc(t.where || "Lugar")}</dt>
            <dd class="visa__big">${esc(venue.name || venue.city || "")}</dd>
            ${venue.address ? `<dd class="visa__small">${esc(venue.address)}</dd>` : ""}
            ${venue.mapsUrl && t.map ? `<dd><a class="link" href="${esc(venue.mapsUrl)}" target="_blank" rel="noopener">${esc(t.map)} ${arrow}</a></dd>` : ""}
          </div>
        </dl>
      </div>
    </div>
  </section>`;
}

export function travel(config) {
  const t = config.copy?.travel || {};
  const items = (t.items || []).filter((i) => i && (i.label || i.text));
  if (!items.length) return "";
  return `
  <section class="section travel" aria-labelledby="travel-title">
    <div class="wrap">
      ${head(config, "travel", t.eyebrow, t.title || "", "travel-title")}
      <ol class="tickets" data-count="${Math.min(items.length, 3)}">${items.map((it, i) => `
        <li class="ticket reveal" style="--i:${i % 3}">
          <p class="ticket__no" aria-hidden="true"><span>${String(i + 1).padStart(2, "0")}</span>${plane("plane ticket__plane")}</p>
          ${it.label ? `<h3 class="ticket__label">${esc(it.label)}</h3>` : ""}
          ${it.text ? `<p class="ticket__text">${esc(it.text)}</p>` : ""}
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function story(config) {
  const { story, copy = {} } = config;
  const chapters = story?.chapters?.filter((c) => c.text) || [];
  if (!chapters.length) return "";
  const t = copy.story || {};
  return `
  <section class="section story" aria-labelledby="story-title">
    <div class="wrap">
      ${head(config, "story", t.eyebrow, t.title || "", "story-title")}
      <ol class="entries">${chapters.map((c, i) => `
        <li class="entry-row reveal${c.photo ? " has-photo" : ""}">
          ${c.meta ? `<p class="entry-row__meta"><span>${esc(c.meta)}</span></p>` : `<p class="entry-row__meta entry-row__meta--n" aria-hidden="true"><span>${String(i + 1).padStart(2, "0")}</span></p>`}
          <div class="entry-row__body">
            ${c.photo ? `<figure class="entry-row__photo"><img src="${esc(c.photo)}" alt="${esc(c.photoAlt || "")}" loading="lazy"></figure>` : ""}
            <p class="entry-row__text">${esc(c.text)}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

export function schedule(config) {
  const { schedule = [], copy = {} } = config;
  if (!schedule.length) return "";
  const t = copy.schedule || {};
  return `
  <section class="section schedule" aria-labelledby="schedule-title">
    <div class="wrap">
      ${head(config, "schedule", t.eyebrow, t.title || "", "schedule-title")}
      <ol class="itin">${schedule.map((s, i) => `
        <li class="itin__item reveal" style="--i:${i}">
          <time class="itin__time">${esc(s.time)}</time>
          <span class="itin__stop" aria-hidden="true"></span>
          <span class="itin__what"><span class="itin__label">${esc(s.label)}</span>${s.place ? `<span class="itin__place">${esc(s.place)}</span>` : ""}</span>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

// Galería: cada foto es un sello de correos con su matasellos (ciudades de la pareja y lugar).
export function gallery(config) {
  const { gallery = [], event, venue = {}, locale, copy = {} } = config;
  if (!gallery.length) return "";
  const t = copy.gallery || {};
  const [a, b] = event.couple;
  const marks = [venue.city, ...validCities(config).map((c) => c.name)].filter(Boolean);
  const sd = stampDate(event.date, locale);
  const alt = interpolate(t.alt || "{a} & {b}", { a, b });
  const n = gallery.length;
  return `
  <section class="section gallery" aria-labelledby="gallery-title">
    <div class="wrap">
      ${head(config, "gallery", t.eyebrow, t.title || "", "gallery-title")}
      <ul class="stamps" data-count="${n > 3 ? "many" : n}">${gallery.map((src, i) => `
        <li class="pstamp reveal" style="--i:${i % 3};--r:${[-2.2, 1.6, -0.8, 2.4, -1.6, 0.9][i % 6]}deg">
          <figure class="pstamp__paper">
            <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">
            <figcaption class="pstamp__value" aria-hidden="true">${esc(sd.year)}</figcaption>
          </figure>
          ${marks.length ? `<svg class="postmark" viewBox="0 0 150 80" aria-hidden="true">
            <circle cx="40" cy="40" r="32"/><circle cx="40" cy="40" r="27" class="postmark__hair"/>
            <text x="40" y="37" text-anchor="middle" class="postmark__city">${esc(plain(marks[i % marks.length]).slice(0, 10))}</text>
            <text x="40" y="52" text-anchor="middle" class="postmark__date">${esc(sd.day)}·${esc(sd.month)}·${esc(sd.year.slice(2))}</text>
            <path d="M78 22c9-5 18 5 27 0s18 5 27 0 9 5 14 2M78 34c9-5 18 5 27 0s18 5 27 0 9 5 14 2M78 46c9-5 18 5 27 0s18 5 27 0 9 5 14 2M78 58c9-5 18 5 27 0s18 5 27 0 9 5 14 2"/>
          </svg>` : ""}
        </li>`).join("")}
      </ul>
    </div>
  </section>`;
}

export function gifts(config) {
  const { gifts, copy = {} } = config;
  if (!gifts?.iban) return "";
  const t = copy.gifts || {};
  const raw = gifts.iban.replace(/\s+/g, "").toUpperCase();
  return `
  <section class="section gifts" aria-labelledby="gifts-title">
    <div class="wrap">
      ${head(config, "gifts", t.eyebrow, t.title || "", "gifts-title")}
      <div class="gifts__in reveal">
        ${t.text ? `<p class="lede">${esc(t.text)}</p>` : ""}
        <details class="iban">
          <summary class="link">${esc(t.reveal || "Ver los datos de la cuenta")}</summary>
          <div class="iban__card">
            ${gifts.holder ? `<p class="eyebrow">${esc(t.holderLabel)}</p><p class="iban__holder">${esc(gifts.holder)}</p>` : ""}
            <p class="eyebrow">${esc(t.ibanLabel)}</p>
            <p class="iban__num" id="iban-value">${esc(raw.match(/.{1,4}/g).join(" "))}</p>
            <button class="link" type="button" data-copy="${esc(raw)}" data-done="${esc(t.copied)}" aria-controls="iban-value"><span data-label aria-live="polite">${esc(t.copy)}</span></button>
          </div>
        </details>
      </div>
    </div>
  </section>`;
}

export function closing(config) {
  const { event, venue = {}, rsvp = {}, sections, locale, copy = {} } = config;
  const [a, b] = event.couple;
  const t = copy.closing || {};
  const hasRsvp = sections.includes("rsvp") && !rsvpClosed({ event, rsvp });
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";
  const year = String(event.date).slice(0, 4);
  const places = [...validCities(config).map((c) => c.name), venue.city].filter(Boolean);
  return `
  <section class="closing" aria-labelledby="closing-title">
    <div class="wrap closing__in">
      ${hasRsvp ? `
        ${t.eyebrow ? `<p class="eyebrow reveal">${esc(t.eyebrow)}</p>` : ""}
        <h2 class="closing__title reveal" id="closing-title">${esc(t.title)}</h2>
        ${deadline && t.text ? `<p class="closing__text reveal">${fill(t.text, { deadline })}</p>` : ""}
        <div class="reveal"><button class="button button--light" type="button" data-rsvp-open aria-haspopup="dialog">${esc(t.button || rsvp.buttonLabel)}</button></div>`
      : `<h2 class="closing__title closing__title--names reveal" id="closing-title">${esc(a)} <span class="closing__amp">&amp;</span> ${esc(b)}</h2>`}
    </div>
    <footer class="wrap closing__foot">
      <span>${esc(a)} &amp; ${esc(b)}</span>
      <span aria-hidden="true" class="closing__dot"></span>
      <span>${esc(year)}</span>
      ${places.length ? `<span aria-hidden="true" class="closing__dot"></span><span>${places.map(esc).join(" · ")}</span>` : ""}
    </footer>
  </section>`;
}
