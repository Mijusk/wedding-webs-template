// Panel de la pareja: entra por enlace mágico (sin contraseña) y ve SU boda.
// Comparte el cliente de Supabase y las utilidades del panel de Luis.
import * as supa from "/panel/js/supa.js";
import { db } from "/panel/js/supa.js";
import { html, raw, render, $, icons, fmtDateLong, untilDate, toast } from "/panel/js/ui.js";

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
let data = null;
let leaveGuard = null;
let currentHash = location.hash;

const ROUTES = [
  [/^\/?$/, "inicio", "Inicio"],
  [/^\/invitados$/, "invitados", "Invitados"],
  [/^\/respuestas$/, "respuestas", "Respuestas"],
  [/^\/datos$/, "datos", "Datos de la boda"],
  [/^\/imprimir$/, "imprimir", "Códigos QR"],
];

export const go = (path) => { location.hash = `#${path}`; };
const parseHash = () => {
  const [path, q = ""] = location.hash.replace(/^#/, "").split("?");
  return { path: path || "/", query: new URLSearchParams(q) };
};

async function start() {
  try {
    await supa.init();
  } catch (e) {
    return message("Aún no está todo listo", e.message);
  }
  // Viene del enlace del email o de WhatsApp: /pareja/#acceso=<clave>
  const acceso = new URLSearchParams(location.hash.replace(/^#/, "")).get("acceso");
  if (acceso) {
    history.replaceState(null, "", location.pathname + location.search + "#/");
    try {
      await supa.verifyLink(acceso);
    } catch (e) {
      return showLogin(supa.currentSession() ? "" : `${e.message} Escribe tu email y te mandamos otro.`);
    }
  }
  supa.onAuthChange((s) => { if (!s) showLogin(); });
  if (!supa.currentSession()) return showLogin();
  await enter();
}

function message(title, text) {
  app.removeAttribute("aria-busy");
  app.className = "";
  render(app, html`<main class="login"><div class="login__card">
    <img class="login__mark" src="/studio/icono.svg" alt="">
    <h1>${title}</h1><p class="muted">${text}</p></div></main>`);
}

function showLogin(error = "") {
  app.removeAttribute("aria-busy");
  app.className = "";
  render(app, html`<main class="login"><div class="login__card">
    <img class="login__mark" src="/studio/icono.svg" alt="">
    <div><h1>Vuestra boda</h1><p class="muted">Invitados, respuestas, horario y regalo de vuestra web, en un solo sitio.</p></div>
    <form id="access-form" novalidate>
      <div class="field"><label for="a-email">Vuestro email</label><input id="a-email" name="email" type="email" autocomplete="email" required></div>
      <p class="error" id="a-error" role="alert">${error}</p>
      <button class="btn btn--primary" type="submit">Enviadme el enlace para entrar</button>
      <p class="small muted">No hace falta contraseña: os mandamos un enlace al email que nos disteis.</p>
    </form>
    <div id="access-sent" hidden></div>
  </div></main>`);
  const form = $("#access-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { $("#a-error").textContent = "Revisa el email."; return form.email.focus(); }
    const btn = form.querySelector("button");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      await supa.api("/api/pareja", { accion: "acceso", email });
      form.hidden = true;
      const sent = $("#access-sent");
      render(sent, html`<div class="notice notice--ok"><strong>Mirad vuestro correo.</strong>
        Si ${email} es el email de vuestra boda, os llega un enlace en un minuto (mirad también en «Spam» o «Promociones»).
        Si no llega, pedídselo a WeddingWebs por WhatsApp.</div>`);
      sent.hidden = false;
    } catch (ex) {
      $("#a-error").textContent = ex.status === 429 ? "Demasiados intentos. Espera unos minutos." : "No se ha podido enviar. Inténtalo de nuevo en un momento.";
      btn.disabled = false; btn.textContent = "Enviadme el enlace para entrar";
    }
  });
  $("#a-email").focus();
}

export async function loadData() {
  data = await db.rpc("pareja_resumen", { p_wedding_id: params.get("boda") || null });
  return data;
}

async function enter() {
  try {
    await loadData();
  } catch (e) {
    if (e.status === 401) return showLogin();
    await supa.signOut().catch(() => {});
    return message("No encontramos vuestra boda", "Este email no tiene ninguna web de boda. Si creéis que es un error, escribid a WeddingWebs.");
  }
  renderShell();
  addEventListener("hashchange", onHashChange);
  route();
}

const couple = () => (data.wedding.couple || []).filter(Boolean);
const hasGuests = () => Boolean(data.features?.rsvp_ampliado);

function renderShell() {
  app.removeAttribute("aria-busy");
  app.className = "";
  const nav = [["/", "Inicio", icons.home], hasGuests() && ["/invitados", "Invitados", icons.leads], ["/respuestas", "Respuestas", icons.tasks], ["/datos", "Datos", icons.weddings]].filter(Boolean);
  const [a = "", b = ""] = couple();
  const date = data.wedding.wedding_date;
  render(app, html`<div class="couple">
    <header class="couple__head"><div class="couple__inner">
      <div class="couple__top">
        <a class="couple__brand" href="#/"><img src="/studio/icono.svg" alt="">WeddingWebs</a>
        <span>${data.staff ? html`<a href="/panel/#/bodas/${data.wedding.id}">Volver al panel</a> · ` : ""}<button type="button" data-logout>Salir</button></span>
      </div>
      ${data.staff ? html`<p class="notice" style="margin-bottom:14px">Estás viendo el panel de esta pareja como equipo de WeddingWebs.</p>` : ""}
      <h1 class="couple__names">${a} <span class="amp">&amp;</span> ${b}</h1>
      <p class="couple__when">${date ? html`${fmtDateLong(date)} · <b>${untilDate(date)}</b>` : "Fecha por confirmar"}</p>
      <nav class="couple__nav" aria-label="Secciones">${nav.map(([p, label]) => html`<a href="#${p}" data-nav="${p}">${label}</a>`)}</nav>
    </div></header>
    <main class="couple__body"><div class="couple__inner" id="view"></div></main>
    <nav class="tabs" aria-label="Secciones" style="--tabs:${nav.length}">${nav.map(([p, label, icon]) => html`<a href="#${p}" data-nav="${p}">${raw(icon)}${label}</a>`)}</nav>
  </div>`);
  app.querySelector("[data-logout]").addEventListener("click", async () => {
    if (leaveGuard && !leaveGuard()) return;
    leaveGuard = null;
    await supa.signOut();
  });
}

function onHashChange() {
  if (leaveGuard && !leaveGuard()) { history.replaceState(null, "", currentHash || "#/"); return; }
  leaveGuard = null;
  window.onbeforeunload = null;
  route();
}

async function route() {
  currentHash = location.hash;
  const { path, query } = parseHash();
  let match = ROUTES.map(([re, view, title]) => ({ m: re.exec(path), view, title })).find((r) => r.m);
  if (!match || (match.view === "invitados" && !hasGuests())) match = { view: "inicio", title: "Inicio" };
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === "/" + (path.split("/")[1] || "");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = `${match.title} · ${couple().join(" y ")}`;
  const el = $("#view");
  render(el, html`<p class="muted">Cargando…</p>`);
  scrollTo(0, 0);
  try {
    await loadData(); // cifras siempre al día al cambiar de pantalla
    const mod = await import(`./views/${match.view}.js`);
    await mod.default({
      el, data, query, go, staff: data.staff, weddingId: data.wedding.id,
      reload: async () => { renderShell(); await route(); },
      refreshData: loadData,
      setLeaveGuard: (fn) => {
        leaveGuard = fn;
        window.onbeforeunload = fn ? (e) => { if (!fn(true)) { e.preventDefault(); e.returnValue = ""; } } : null;
      },
    });
  } catch (e) {
    console.error(e);
    render(el, html`<div class="problems"><strong>No se ha podido abrir esta pantalla.</strong><p>${e.message}</p></div>`);
  }
}

start().catch((e) => { console.error(e); message("No se ha podido abrir el panel", e.message); });
void toast;
