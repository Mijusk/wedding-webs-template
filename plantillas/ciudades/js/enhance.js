import * as sections from "./sections.js";
import { mountRsvp } from "./rsvp.js";
import { reveal } from "./reveal.js";

// Ciudades: lo que no es CSS.
// 1. Idioma ES · EN. Los textos de la plantilla tienen variante inglesa en config.copy_en (mismas
//    claves). Al cambiar, se vuelve a pintar <main> con el config fusionado (copy_en sobre copy)
//    usando las mismas funciones de sections.js que main.js, se remonta el RSVP (para que la
//    pastilla vigile la portada y el cierre nuevos) y se recuerda la elección. ?lang=en manda.
// 2. El sello de la portada cae solo la primera vez: ni en las repinturas de la vista previa
//    ni al cambiar de idioma se repite.
// 3. Relojes con la hora real de cada ciudad: un único setInterval para toda la página, que se
//    para solo cuando ya no hay relojes en el DOM.
// 4. Fondos de guilloché generados una vez (SVG en variables CSS).
// Se puede llamar tantas veces como haga falta: no duplica listeners ni bucles.

const KEY = "ciudades-lang";
const LANGS = ["es", "en"];
let base = null;          // último config recibido de main.js (sin fusionar)
let lang = null;          // idioma elegido en esta visita
let stamped = false;      // el sello ya ha caído una vez
let timer = null;

export function enhance(main, config) {
  base = config;
  patterns();
  if (lang === null) lang = initialLang();
  if (!config.copy_en) {
    document.getElementById("lang-switch")?.remove();
    finish(main, config);
    return;
  }
  langSwitch();
  if (lang === "es") finish(main, config);
  else paint(main);
}

/* ---------- idioma ---------- */

function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
  } catch { /* sin URL legible */ }
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* almacenamiento bloqueado */ }
  return "es";
}

// copy_en por encima de copy, sección a sección (las listas, como travel.items, se sustituyen).
export function localized(config, l) {
  if (l !== "en" || !config.copy_en) return config;
  const copy = { ...(config.copy || {}) };
  for (const [k, v] of Object.entries(config.copy_en)) {
    copy[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(copy[k] || {}), ...v } : v;
  }
  const cities = Array.isArray(config.cities)
    ? config.cities.map((c) => ({ ...c, name: c?.name_en || c?.name, country: c?.country_en || c?.country }))
    : config.cities;
  return { ...config, copy, cities, locale: config.locale_en || "en-GB" };
}

function langSwitch() {
  let nav = document.getElementById("lang-switch");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "lang-switch";
    nav.className = "lang";
    nav.innerHTML = `<button type="button" data-lang="es" lang="es" aria-label="Español">ES</button><span aria-hidden="true">·</span><button type="button" data-lang="en" lang="en" aria-label="English">EN</button>`;
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (!btn || btn.dataset.lang === lang) return;
      lang = btn.dataset.lang;
      try { localStorage.setItem(KEY, lang); } catch { /* almacenamiento bloqueado */ }
      try {
        const url = new URL(location.href);
        if (url.searchParams.has("lang")) { url.searchParams.set("lang", lang); history.replaceState(history.state, "", url); }
      } catch { /* sin history */ }
      const main = document.getElementById("app");
      if (main && base) paint(main);
    });
    document.body.prepend(nav);
  }
  nav.setAttribute("aria-label", `${base.copy?.lang?.label || "Idioma"} / ${base.copy_en?.lang?.label || "Language"}`);
  for (const b of nav.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
}

// Vuelve a pintar <main> como main.js, con el config del idioma elegido.
function paint(main) {
  const cfg = localized(base, lang);
  main.innerHTML = cfg.sections.filter((s) => typeof sections[s] === "function").map((s) => sections[s](cfg)).join("");
  const rsvp = document.getElementById("rsvp");
  if (rsvp) {
    if (cfg.sections.includes("rsvp")) {
      const label = cfg.copy?.closing?.button;
      mountRsvp(rsvp, label ? { ...cfg, rsvp: { ...(cfg.rsvp || {}), buttonLabel: label } } : cfg);
    } else rsvp.innerHTML = "";
  }
  reveal(main);
  langSwitch();
  finish(main, cfg);
}

function finish(main, cfg) {
  document.documentElement.lang = lang === "en" && base.copy_en ? "en" : (base.locale || "es").split("-")[0];
  heroStamp(main);
  timeDiff(main);
  clocks();
}

/* ---------- sello ---------- */

function heroStamp(main) {
  const hero = main.querySelector(".hero");
  if (!hero) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || stamped) { hero.classList.add("is-static"); return; }
  stamped = true;
  hero.classList.add("is-stamping");
  // Pasado el golpe, la portada queda como cualquier otra (por si se repinta a mitad).
  setTimeout(() => hero.isConnected && hero.classList.replace("is-stamping", "is-static"), 2400);
}

/* ---------- relojes ---------- */

const fmtCache = new Map();
function partsIn(tz, now) {
  let f = fmtCache.get(tz);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    } catch { f = null; }
    fmtCache.set(tz, f);
  }
  if (!f) return null;
  const p = {};
  for (const { type, value } of f.formatToParts(now)) p[type] = +value;
  if (p.hour === 24) p.hour = 0;
  return p;
}

// Minutos de diferencia con UTC en esa zona, ahora mismo.
function offset(tz, now) {
  const p = partsIn(tz, now);
  if (!p) return null;
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(now / 6e4) * 6e4) / 6e4);
}

function tick() {
  const list = document.querySelectorAll(".clock[data-tz]");
  if (!list.length) { clearInterval(timer); timer = null; return; }
  const now = new Date();
  const locale = document.documentElement.lang === "en" ? (base?.locale_en || "en-GB") : (base?.locale || "es-ES");
  for (const el of list) {
    const tz = el.dataset.tz;
    const p = tz ? partsIn(tz, now) : null;
    if (!p) { el.classList.add("is-unknown"); continue; }
    const s = p.second, m = p.minute + s / 60, h = (p.hour % 12) + m / 60;
    el.querySelector('[data-hand="h"]').style.transform = `rotate(${(h * 30).toFixed(2)}deg)`;
    el.querySelector('[data-hand="m"]').style.transform = `rotate(${(m * 6).toFixed(2)}deg)`;
    el.querySelector('[data-hand="s"]').style.transform = `rotate(${s * 6}deg)`;
    const dig = el.querySelector("[data-digital]");
    let txt;
    try { txt = now.toLocaleString(locale, { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
    catch { txt = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`; }
    if (dig.textContent !== txt) dig.textContent = txt;
  }
}

function clocks() {
  if (!document.querySelector(".clock[data-tz]")) { clearInterval(timer); timer = null; return; }
  tick();
  if (!timer) timer = setInterval(tick, 1000);
}

function timeDiff(main) {
  const el = main.querySelector("[data-diff]");
  if (!el) return;
  const now = Date.now();
  const a = offset(el.dataset.tzA, now), b = offset(el.dataset.tzB, now);
  if (a === null || b === null) { el.remove(); return; }
  const h = Math.abs(a - b) / 60;
  const hours = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", lang === "en" ? "." : ",");
  el.textContent = h === 0 ? el.dataset.same : h === 1 ? el.dataset.one : (el.dataset.many || "").replace("{hours}", hours);
  if (!el.textContent) el.remove();
}

/* ---------- guilloché ---------- */

let patternsDone = false;
const n1 = (v) => (Math.round(v * 10) / 10).toString();
const svgUrl = (svg) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;

function rosette(color, opacity) {
  // Bandas concéntricas de líneas finas moduladas: el moiré de los pasaportes.
  const P = 360, paths = [];
  const band = (count, r0, gap, amp, lobes, twist) => {
    for (let k = 0; k < count; k++) {
      let d = "";
      for (let i = 0; i <= P; i++) {
        const t = (i / P) * 2 * Math.PI;
        const r = r0 + k * gap + amp * Math.sin(lobes * t + k * twist);
        d += `${i ? "L" : "M"}${n1(200 + r * Math.cos(t))} ${n1(200 + r * Math.sin(t))}`;
      }
      paths.push(d + "Z");
    }
  };
  band(14, 150, 2.4, 9, 36, 0.32);
  band(10, 92, 2.2, 6, 24, -0.36);
  band(6, 46, 2, 4, 12, 0.5);
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="${paths.join("")}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".5"/></svg>`);
}

function wave(color, opacity) {
  const W = 160, H = 30, lines = [];
  for (let k = 0; k < 7; k++) {
    let d = "";
    for (let x = 0; x <= W; x += 4) {
      const y = H / 2 + 9 * Math.sin((2 * Math.PI * x) / 80 + (k * Math.PI) / 7) + 3 * Math.sin((2 * Math.PI * x) / 40 - (k * Math.PI) / 3.5);
      d += `${x ? "L" : "M"}${x} ${n1(y)}`;
    }
    lines.push(d);
  }
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${lines.join("")}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width=".6"/></svg>`);
}

function patterns() {
  if (patternsDone) return;
  patternsDone = true;
  const root = document.documentElement.style;
  root.setProperty("--g-rosette", rosette("#2e4a62", 0.22));
  root.setProperty("--g-rosette-light", rosette("#f5f2ec", 0.1));
  root.setProperty("--g-rosette-soft", rosette("#2e4a62", 0.11));
  root.setProperty("--g-wave", wave("#2e4a62", 0.2));
  root.setProperty("--g-wave-light", wave("#f5f2ec", 0.14));
}
