// Arranque del panel: conexión con Supabase, acceso, estructura (menú, buscador) y rutas.
import * as supa from "./supa.js";
import { db } from "./supa.js";
import { html, raw, render, $, icons, debounce, toast, fail, showDialog } from "./ui.js";

const app = document.getElementById("app");
let staff = null;
let leaveGuard = null;
let currentHash = location.hash;

const ROUTES = [
  [/^\/?$/, "inicio", "Inicio"],
  [/^\/leads$/, "leads", "Leads"],
  [/^\/leads\/(?<id>[0-9a-f-]{36})$/, "lead", "Lead"],
  [/^\/tareas$/, "tareas", "Tareas"],
  [/^\/clientes$/, "clientes", "Clientes"],
  [/^\/clientes\/(?<id>[0-9a-f-]{36})$/, "cliente", "Cliente"],
  [/^\/bodas$/, "bodas", "Bodas"],
  [/^\/bodas\/nueva$/, "nueva-boda", "Nueva boda"],
  [/^\/bodas\/(?<id>[0-9a-f-]{36})$/, "boda", "Boda"],
  [/^\/importar$/, "importar", "Importar"],
  [/^\/ajustes$/, "ajustes", "Ajustes"],
];

const NAV = [
  ["/", "Inicio", icons.home], ["/leads", "Leads", icons.leads], ["/tareas", "Tareas", icons.tasks],
  ["/clientes", "Clientes"], ["/bodas", "Bodas", icons.weddings], ["/importar", "Importar"], ["/ajustes", "Ajustes"],
];

export const go = (path) => { location.hash = `#${path}`; };

function parseHash() {
  const [path, q = ""] = location.hash.replace(/^#/, "").split("?");
  return { path: path || "/", query: new URLSearchParams(q) };
}

async function start() {
  let recovery = null;
  try {
    await supa.init();
    recovery = supa.consumeUrlSession();
  } catch (e) {
    return render(app, html`<main class="login"><div class="login__card">
      <img class="login__mark" src="/studio/icono.svg" alt="">
      <h1>El panel aún no está conectado</h1>
      <p class="muted">${e.message}</p>
      <p class="muted small">Sigue la guía docs/SUPABASE.md para poner las claves en Vercel.</p>
    </div></main>`);
  }
  supa.onAuthChange((s) => { if (!s) showLogin("La sesión se ha cerrado. Vuelve a entrar."); });
  if (recovery === "recovery") return showNewPassword();
  if (!supa.currentSession()) return showLogin();
  await enter();
}

// ── Acceso ─────────────────────────────────────────────────

function showLogin(message = "") {
  staff = null;
  app.removeAttribute("aria-busy");
  app.className = "";
  render(app, html`<main class="login"><div class="login__card">
    <img class="login__mark" src="/studio/icono.svg" alt="">
    <div><h1>Panel de WeddingWebs</h1><p class="muted">Leads, bodas y clientes en un solo sitio.</p></div>
    <form id="login-form" novalidate>
      <div class="field"><label for="l-email">Email</label><input id="l-email" name="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="l-pass">Contraseña</label><input id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="error" id="l-error" role="alert">${message}</p>
      <button class="btn btn--primary" type="submit">Entrar</button>
      <div class="login__alt"><button type="button" id="l-forgot">He olvidado la contraseña</button></div>
    </form>
  </div></main>`);
  const form = $("#login-form"), err = $("#l-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(form));
    if (!email || !password) { err.textContent = "Escribe tu email y tu contraseña."; return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      await supa.signIn(email.trim(), password);
      await enter();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
  $("#l-forgot").addEventListener("click", async () => {
    const email = $("#l-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Escribe tu email arriba y vuelve a pulsar."; return; }
    try {
      await supa.sendPasswordReset(email);
      err.textContent = "";
      toast("Te hemos enviado un email con un enlace para elegir otra contraseña.");
    } catch (ex) { err.textContent = ex.message; }
  });
  $("#l-email").focus();
}

function showNewPassword() {
  app.removeAttribute("aria-busy");
  render(app, html`<main class="login"><div class="login__card">
    <img class="login__mark" src="/studio/icono.svg" alt="">
    <h1>Elige una contraseña nueva</h1>
    <form id="np-form" novalidate>
      <div class="field"><label for="np">Contraseña nueva</label><input id="np" name="password" type="password" autocomplete="new-password" minlength="10" required>
        <span class="hint">Al menos 10 caracteres. Mejor una frase que solo tú recuerdes.</span></div>
      <p class="error" id="np-error" role="alert"></p>
      <button class="btn btn--primary" type="submit">Guardar y entrar</button>
    </form>
  </div></main>`);
  $("#np-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = $("#np").value;
    if (pass.length < 10) { $("#np-error").textContent = "Necesita al menos 10 caracteres."; return; }
    try { await supa.updatePassword(pass); toast("Contraseña cambiada."); await enter(); }
    catch (ex) { $("#np-error").textContent = ex.message; }
  });
}

function userId() {
  const s = supa.currentSession();
  if (s?.user?.id) return s.user.id;
  try { return JSON.parse(atob(s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch { return null; }
}

async function enter() {
  try {
    staff = await db.one("staff", { select: "*", user_id: `eq.${userId()}`, active: "is.true" });
  } catch (e) {
    return showLogin(e.message);
  }
  if (!staff) {
    await supa.signOut();
    return showLogin("Este usuario no tiene acceso al panel. Si eres del equipo, pide a Luis que te dé de alta.");
  }
  renderShell();
  addEventListener("hashchange", onHashChange);
  route();
}

// ── Estructura ─────────────────────────────────────────────

function renderShell() {
  app.removeAttribute("aria-busy");
  app.className = "";
  const nav = NAV.filter(([p]) => p !== "/ajustes" || ["owner", "admin"].includes(staff.role));
  render(app, html`<div class="shell">
    <nav class="rail" aria-label="Secciones">
      <a class="rail__brand" href="#/"><img src="/studio/icono.svg" alt=""><span>WeddingWebs</span></a>
      ${nav.map(([p, label]) => html`<a class="nav" href="#${p}" data-nav="${p}">${label}${p === "/leads" ? html`<span class="count" data-count hidden></span>` : ""}</a>`)}
      <div class="rail__foot">
        <span>${staff.name || staff.email}</span>
        <button type="button" data-logout>Salir</button>
      </div>
    </nav>
    <div class="main">
      <header class="topbar">
        <span class="topbar__title" data-title></span>
        <div class="search" role="search">
          ${raw(icons.search)}
          <input type="search" id="search" placeholder="Buscar pareja, email, teléfono, NIF o web…" autocomplete="off" aria-label="Buscar" aria-controls="search-results">
          <div class="search__results" id="search-results" hidden role="listbox"></div>
        </div>
      </header>
      <div id="view"></div>
    </div>
    <nav class="tabs" aria-label="Secciones">
      <a href="#/" data-nav="/">${raw(icons.home)}Inicio</a>
      <a href="#/leads" data-nav="/leads">${raw(icons.leads)}Leads<span class="count" data-count hidden></span></a>
      <a href="#/tareas" data-nav="/tareas">${raw(icons.tasks)}Tareas</a>
      <a href="#/bodas" data-nav="/bodas">${raw(icons.weddings)}Bodas</a>
      <button type="button" data-more>${raw(icons.more)}Más</button>
    </nav>
  </div>`);
  app.addEventListener("click", async (e) => {
    if (e.target.closest("[data-logout]")) { await supa.signOut(); }
    if (e.target.closest("[data-more]")) {
      const dlg = showDialog(html`<div class="dlg"><h2>Más</h2><nav class="sheet-menu">
        <a href="#/clientes">Clientes</a><a href="#/importar">Importar de la hoja de Google</a>
        ${["owner", "admin"].includes(staff.role) ? html`<a href="#/ajustes">Ajustes</a>` : ""}
        <button type="button" data-logout>Salir</button></nav>
        <div class="dlg__actions"><button class="btn" data-close type="button">Cerrar</button></div></div>`);
      dlg.addEventListener("click", async (ev) => {
        if (ev.target.closest("a")) dlg.close();
        if (ev.target.closest("[data-logout]")) { dlg.close(); await supa.signOut(); }
      });
    }
  });
  setupSearch();
}

async function refreshCounts() {
  try {
    const { count } = await db.select("leads", { select: "id", status: "eq.nuevo", limit: 1 }, { count: true });
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = count; el.hidden = !count; });
  } catch { /* el contador es secundario */ }
}

// ── Rutas ──────────────────────────────────────────────────

function onHashChange() {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, "", currentHash || "#/");
    return;
  }
  leaveGuard = null;
  window.onbeforeunload = null;
  route();
}

async function route() {
  currentHash = location.hash;
  const { path, query } = parseHash();
  const match = ROUTES.map(([re, view, title]) => ({ m: re.exec(path), view, title })).find((r) => r.m);
  const top = "/" + (path.split("/")[1] || "");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === top) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const box = $("#view");
  const el = document.createElement("div");
  el.className = "view";
  box.replaceChildren(el);
  $("[data-title]").textContent = match?.title || "";
  if (!match) {
    render(el, html`<div class="empty"><strong>Esta página no existe.</strong><a href="#/">Volver al inicio</a></div>`);
    return;
  }
  document.title = `${match.title} · Panel WeddingWebs`;
  scrollTo(0, 0);
  refreshCounts();
  try {
    const mod = await import(`./views/${match.view}.js`);
    await mod.default({
      el, params: match.m.groups || {}, query, staff, go,
      setTitle: (t) => { document.title = `${t} · Panel WeddingWebs`; },
      setLeaveGuard: (fn) => {
        leaveGuard = fn;
        window.onbeforeunload = fn ? (e) => { if (!fn(true)) { e.preventDefault(); e.returnValue = ""; } } : null;
      },
      refreshCounts,
    });
  } catch (e) {
    console.error(e);
    render(el, html`<div class="problems"><strong>No se ha podido abrir esta pantalla.</strong><p>${e.message}</p></div>`);
  }
}

// ── Buscador global ────────────────────────────────────────

function setupSearch() {
  const input = $("#search"), box = $("#search-results");
  const KIND = { lead: ["Lead", "/leads/"], cliente: ["Cliente", "/clientes/"], boda: ["Boda", "/bodas/"] };
  let items = [], sel = -1;
  const close = () => { box.hidden = true; sel = -1; };
  const paint = () => {
    box.hidden = false;
    render(box, items.length
      ? html`${items.map((r, i) => html`<a href="#${KIND[r.kind][1]}${r.id}" role="option" aria-selected="${i === sel}">
          <span class="kind">${KIND[r.kind][0]}</span><span>${r.title}</span><span class="sub">${r.subtitle}</span></a>`)}`
      : html`<p class="search__empty">Nada con «${input.value}».</p>`);
  };
  const search = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    try { items = await db.rpc("global_search", { p_q: q }); sel = -1; paint(); }
    catch (e) { fail(e); }
  }, 220);
  input.addEventListener("input", search);
  input.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
    else if (e.key === "Enter" && items[Math.max(sel, 0)]) {
      const r = items[Math.max(sel, 0)];
      go(KIND[r.kind][1] + r.id); input.value = ""; close(); input.blur();
    } else if (e.key === "Escape") close();
  });
  box.addEventListener("click", () => { input.value = ""; close(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) close(); });
}

start().catch((e) => {
  console.error(e);
  render(app, html`<main class="login"><div class="login__card"><h1>No se ha podido abrir el panel</h1><p class="muted">${e.message}</p></div></main>`);
});
