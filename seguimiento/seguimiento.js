// Página de seguimiento de un pedido: /seguimiento/K7M3-Q9TX (o /seguimiento/ y escribir el código).
// Sin cuenta ni contraseña: el código es la llave. Habla solo con /api/pedido.
import { html, raw, render, $, $$, toast, fmtDate, fmtDateLong, fmtMoney } from "/panel/js/ui.js";

const app = document.getElementById("app");
const CODE = /^[2-9A-HJKMNP-Z]{8}$/;
const norm = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pretty = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
const params = new URLSearchParams(location.search);
let catalog = null;

function codeFromUrl() {
  const fromPath = decodeURIComponent(location.pathname.replace(/^\/seguimiento\/?/, "").replace(/\/$/, ""));
  return norm(fromPath || params.get("c"));
}

async function api(body) {
  const res = await fetch("/api/pedido", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw Object.assign(new Error(data.error || "error"), { code: data.error, data });
  return data;
}

async function fetchOrder(code) {
  const res = await fetch(`/api/pedido?c=${encodeURIComponent(code)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (res.status === 429) throw Object.assign(new Error("Demasiados intentos. Esperad unos minutos y volved a probar."), { code: "demasiadas" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Ahora mismo no podemos abrir vuestro pedido. Volved a intentarlo en un rato.");
  return data;
}

async function loadCatalog() {
  try { catalog ||= await fetch("/studio/studio.json").then((r) => r.json()); } catch { catalog = {}; }
  return catalog;
}

// ── Escribir el código ─────────────────────────────────────

function showEntry(error = "", value = "") {
  app.removeAttribute("aria-busy");
  app.className = "";
  document.title = "Seguimiento de vuestra web · WeddingWebs";
  render(app, html`<main class="login"><div class="login__card">
    <img class="login__mark" src="/studio/icono.svg" alt="">
    <div><h1>¿Cómo va vuestra web?</h1>
      <p class="muted">Escribid el código de vuestro pedido. Está en el email de confirmación y en el mensaje que os mandamos.</p></div>
    <form class="code-form" novalidate>
      <label class="sr-only" for="code">Código del pedido</label>
      <input class="code-input" id="code" name="code" placeholder="K7M3-Q9TX" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" value="${value}" required>
      <p class="error" role="alert">${error}</p>
      <button class="btn btn--primary" type="submit">Ver nuestro pedido</button>
    </form>
    <p class="fine">No hace falta cuenta ni contraseña. Si no encontráis el código, escribidnos y os lo volvemos a mandar.</p>
  </div></main>`);
  const input = $("#code");
  input.addEventListener("input", () => {
    const c = norm(input.value).slice(0, 8);
    input.value = c.length > 4 ? pretty(c.padEnd(8, " ")).trim() : c;
  });
  $(".code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const c = norm(input.value);
    if (!CODE.test(c)) { $(".error").textContent = "El código tiene 8 letras y números, como K7M3-Q9TX."; return input.focus(); }
    history.pushState(null, "", `/seguimiento/${pretty(c)}`);
    start();
  });
  input.focus();
}

// ── El pedido ──────────────────────────────────────────────

async function start(poll = 0) {
  const code = codeFromUrl();
  if (!code) return showEntry();
  if (!CODE.test(code)) return showEntry("Ese código no parece correcto: tiene 8 letras y números, como K7M3-Q9TX.", code);
  let data;
  try {
    [data] = await Promise.all([fetchOrder(code), loadCatalog()]);
  } catch (e) {
    return showEntry(e.message, pretty(code));
  }
  if (!data) return showEntry("No encontramos ningún pedido con ese código. Revisad que esté bien escrito.", pretty(code));
  show(code, data.pedido, data.pagos, poll);
}

const STATUS = { pendiente: "Pendiente", hecho: "Hecho", descartado: "No se hará" };
const sectionName = (id) => catalog?.sections?.list?.[id]?.name || null;
function styleName(p) {
  const s = (catalog?.styles || []).find((x) => x.id === p.style) || (catalog?.styles || []).find((x) => x.template === p.template && x.theme === p.theme);
  return s?.name || null;
}

function show(code, p, payments, poll) {
  app.removeAttribute("aria-busy");
  app.className = "couple";
  document.title = `${p.names} · seguimiento · WeddingWebs`;
  const due = Math.max(p.total_cents - p.paid_cents, 0);
  const paid = ["pagado", "en_produccion", "entregado"].includes(p.status);
  const closed = ["cancelado", "reembolsado"].includes(p.status);
  const published = Boolean(p.web?.published);
  const proposals = [...p.proposals].reverse();
  const latest = proposals[0];
  const rounds = p.rounds || {};
  const pago = params.get("pago");
  const waiting = pago === "ok" && !paid && !closed;
  const [a, b] = String(p.names).split(" y ");
  const style = styleName(p);
  const sections = (p.sections || []).map(sectionName).filter(Boolean);
  const contact = p.contact || {};
  const wa = contact.telefono ? `https://wa.me/${contact.telefono.replace(/\D/g, "").replace(/^(?!34)(\d{9})$/, "34$1")}` : null;

  const steps = [
    { title: "Pedido recibido", state: "hecho", text: html`El ${fmtDateLong(p.created_at)}.` },
    { title: paid ? "Pago recibido" : "Pago", state: paid ? "hecho" : closed ? "pendiente" : "ahora",
      text: paid ? html`El ${fmtDateLong(p.paid_at)}.` : html`Queda por pagar <b>${fmtMoney(due)}</b>.` },
    { title: "Preparamos vuestra web", state: !paid ? "pendiente" : proposals.length ? "hecho" : "ahora",
      text: p.promised_delivery_at ? html`Os mandamos la primera propuesta como tarde el <b>${fmtDateLong(p.promised_delivery_at)}</b>.`
        : html`Os avisamos en cuanto tengamos la primera propuesta.` },
    { title: "Propuestas y cambios", state: !proposals.length ? "pendiente" : p.approved_at || published ? "hecho" : "ahora",
      text: !proposals.length ? "Aquí veréis cada versión que os mandemos."
        : latest.approved_at ? `Aprobasteis la propuesta ${latest.number}. ¡Gracias!` : html`La <b>propuesta ${latest.number}</b> está lista: miradla y decidnos.` },
    { title: "Web publicada", state: published ? "hecho" : p.approved_at ? "ahora" : "pendiente",
      text: published ? "Vuestra web ya está en internet." : p.approved_at ? "La estamos publicando." : "Cuando nos deis el visto bueno." },
  ];

  render(app, html`
    <header class="couple__head"><div class="couple__inner">
      <div class="couple__top"><a class="couple__brand" href="/studio/"><img src="/studio/icono.svg" alt="">WeddingWebs</a>
        <span>Pedido ${p.number} · código <b class="track__code">${pretty(code)}</b></span></div>
      <h1 class="couple__names">${a}${b ? html` <span class="amp">&amp;</span> ${b}` : ""}</h1>
      <p class="couple__when">${p.plan ? html`Web de boda <b>${p.plan.name}</b>` : "Vuestra web de boda"}${style ? html` · estilo ${style}` : ""}${p.wedding_date ? html` · boda el ${fmtDateLong(p.wedding_date)}` : ""}</p>
      <div style="height:22px"></div>
    </div></header>

    <main class="couple__body"><div class="couple__inner track__body">
      ${pago === "ok" && paid ? html`<p class="notice notice--ok" role="status">¡Pago recibido! Os hemos mandado un email con la confirmación${p.invoices.length ? " y la factura" : ""}.</p>` : ""}
      ${waiting ? html`<p class="notice" role="status">${poll < 20 ? "Estamos confirmando el pago con el banco… (unos segundos)" : "El pago aún no nos ha llegado. Si en unos minutos no se actualiza, escribidnos."}</p>` : ""}
      ${pago === "cancelado" && !paid ? html`<p class="notice" role="status">No se ha completado el pago. Podéis intentarlo otra vez cuando queráis.</p>` : ""}
      ${pago === "no_disponible" ? html`<p class="notice" role="status">El pago con tarjeta aún no está activo. Escribidnos y os decimos cómo pagar.</p>` : ""}
      ${closed ? html`<p class="notice">Este pedido está ${p.status === "reembolsado" ? "devuelto" : "cancelado"}. Si es un error, escribidnos.</p>` : ""}

      ${!paid && !closed && due > 0 ? html`<section class="pay-box" aria-labelledby="pay-t">
        <h2 id="pay-t" class="small muted" style="font-weight:600">Para empezar vuestra web</h2>
        <p class="pay-box__amount">${fmtMoney(due)}</p>
        ${payments ? html`<div class="btn-row"><a class="btn btn--primary" href="/api/pedido?c=${code}&amp;pagar=1" data-pay>Pagar con tarjeta o Bizum</a></div>
          <p class="fine">Pago seguro con Stripe. Al terminar volveréis aquí.</p>`
          : html`<p class="small">El pago con tarjeta aún no está activo. Escribidnos y os decimos cómo pagar.</p>`}
      </section>` : ""}

      <div class="track__grid">
        <div class="stack">
          ${latest ? html`<section class="stack" aria-labelledby="prop-t">
            <h2 id="prop-t" class="sr-only">Propuestas</h2>
            ${proposals.map((x, i) => proposalCard(x, i === 0, code, p, published))}
          </section>` : ""}

          ${latest ? html`${paid ? requestBlock(p, latest, rounds) : ""}${stepsBlock(steps)}` : html`${stepsBlock(steps)}${paid && !closed ? requestBlock(p, latest, rounds) : ""}`}
        </div>

        <aside class="stack">
          ${published ? html`<section class="panel-block"><h2>Vuestra web</h2>
            <p class="small muted" style="margin-bottom:12px">Ya podéis compartirla por WhatsApp o en la invitación.</p>
            <a class="btn btn--primary" href="/b/${p.web.slug}" target="_blank" rel="noopener">Abrir la web</a></section>` : ""}

          ${p.couple_panel ? html`<section class="panel-block"><h2>Invitados y respuestas</h2>
            <p class="small muted" style="margin-bottom:12px">En vuestro panel apuntáis a los invitados, veis quién viene y descargáis el Excel para el catering. Os mandamos el enlace al email (por seguridad: ahí hay datos de vuestros invitados).</p>
            <button class="btn" type="button" data-panel>Mandadme el enlace a mi email</button>
            <p class="small" data-panel-msg role="status" style="margin-top:8px"></p></section>` : ""}

          <section class="panel-block"><h2>Vuestro pedido</h2>
            <div class="rows">${p.lines.map((l) => html`<div class="row"><span class="row__title" style="font-weight:500">${l.description}${l.quantity > 1 ? ` × ${l.quantity}` : ""}</span><span class="row__side">${fmtMoney(l.total_cents)}</span></div>`)}
              <div class="row"><span class="row__title">Total (IVA incluido)</span><span class="row__side"><b>${fmtMoney(p.total_cents)}</b></span></div></div>
            ${p.paid_cents ? html`<p class="small muted" style="margin-top:6px">Pagado: ${fmtMoney(p.paid_cents)}</p>` : ""}
            ${sections.length ? html`<p class="small muted" style="margin:14px 0 6px">Secciones</p><div class="chips">${sections.map((s) => html`<span class="tag">${s}</span>`)}</div>` : ""}
            ${p.invoices.length ? html`<p class="small muted" style="margin:14px 0 6px">Facturas</p><div class="rows">${p.invoices.map((f) => html`<div class="row">
              <a class="row__title" href="/api/factura?c=${code}&amp;n=${encodeURIComponent(f.number)}" target="_blank" rel="noopener">${f.number}</a>
              <span class="row__side small">${fmtDate(f.issued_at)} · ${fmtMoney(f.total_cents)}</span></div>`)}</div>` : ""}
          </section>

          <section class="panel-block"><h2>¿Dudas?</h2>
            <div class="btn-row">
              ${contact.email ? html`<a class="btn btn--small" href="mailto:${contact.email}?subject=${encodeURIComponent(`Pedido ${p.number}`)}">Escribir un email</a>` : ""}
              ${wa ? html`<a class="btn btn--small" href="${wa}?text=${encodeURIComponent(`Hola, os escribo por el pedido ${p.number}.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </div>
            <p class="fine" style="margin-top:12px">Guardad este enlace: con el código <b class="track__code">${pretty(code)}</b> veis vuestro pedido sin contraseña. No lo publiquéis en grupos.</p>
          </section>
        </aside>
      </div>
    </div></main>`);

  bind(code, p, latest);
  if (waiting && poll < 20) setTimeout(() => start(poll + 1), 3000);
  if (pago && (paid || closed)) history.replaceState(null, "", location.pathname);
}

function stepsBlock(steps) {
  return html`<section class="panel-block" aria-labelledby="steps-t">
    <h2 id="steps-t">Cómo va</h2>
    <ol class="steps">${steps.map((s, i) => html`<li class="step" data-state="${s.state}">
      <span class="step__dot" aria-hidden="true">${s.state === "hecho" ? raw("&#10003;") : i + 1}</span>
      <span class="step__title">${s.title}<span class="sr-only"> (${s.state === "hecho" ? "hecho" : s.state === "ahora" ? "ahora" : "pendiente"})</span></span>
      <span class="step__text">${s.text}</span></li>`)}</ol>
  </section>`;
}

function proposalCard(x, current, code, p, published) {
  const url = `/b/${p.web?.slug}?propuesta=${x.number}&c=${code}`;
  if (!current) {
    return html`<article class="proposal proposal--old">
      <div class="proposal__head"><h3 class="proposal__title">Propuesta ${x.number}</h3><span class="small muted">${fmtDate(x.sent_at)}</span></div>
      <div class="btn-row"><a class="btn btn--small" href="${url}" target="_blank" rel="noopener">Ver</a></div></article>`;
  }
  const open = !x.approved_at && !published;
  return html`<article class="proposal proposal--current" aria-labelledby="prop-${x.number}">
    <div class="proposal__head"><h3 class="proposal__title" id="prop-${x.number}">Propuesta ${x.number}</h3>
      <span class="small muted">${x.approved_at ? html`<span class="status" data-s="hecha">Aprobada el ${fmtDate(x.approved_at)}</span>` : `Os la mandamos el ${fmtDate(x.sent_at)}`}</span></div>
    ${x.note ? html`<p class="proposal__note">${x.note}</p>` : ""}
    <div class="btn-row">
      <a class="btn ${open ? "" : "btn--primary"}" href="${url}" target="_blank" rel="noopener">Ver la propuesta</a>
      ${open ? html`<button class="btn btn--primary" type="button" data-approve="${x.number}">¡Nos encanta, publicadla!</button>
        <button class="btn btn--quiet" type="button" data-ask>Pedir cambios</button>` : ""}
    </div>
    ${open ? html`<p class="fine">Miradla en el móvil y en el ordenador. Los botones de confirmar asistencia no guardan nada en las propuestas.</p>` : ""}
  </article>`;
}

function requestBlock(p, latest, rounds) {
  const anyChange = p.requests.some((r) => r.kind === "cambio" && r.proposal === latest?.number && r.status !== "descartado");
  const left = rounds.included == null ? null : rounds.included - rounds.used;
  const canChange = rounds.included !== 0 && (!latest || rounds.included == null || anyChange || left > 0);
  const changeHint = rounds.included === 0 ? "Vuestro plan no incluye cambios de diseño. Si queréis alguno, escribidnos y os decimos el precio."
    : !latest ? "Contadnos lo que tengáis en mente antes de la primera propuesta. No cuenta como ronda."
    : rounds.included == null ? "Los que acordamos para vuestro plan."
    : anyChange ? `Sigue siendo la ronda ${rounds.used} de ${rounds.included}: podéis añadir más cosas.`
    : left > 0 ? `Sería la ronda ${rounds.used + 1} de ${rounds.included}.`
    : `Ya habéis usado las ${rounds.included} rondas de vuestro plan. Si queréis más, escribidnos.`;
  const list = [...p.requests].reverse();
  return html`<section class="panel-block" id="cambios" aria-labelledby="req-t">
    <h2 id="req-t">${latest ? `Pedir cambios sobre la propuesta ${latest.number}` : "¿Algo que debamos saber?"}</h2>
    ${rounds.included != null && rounds.included > 0 ? html`<p class="rounds" style="margin-bottom:12px">Cambios de diseño: <b>${rounds.used} de ${rounds.included}</b> rondas usadas. Corregir datos y erratas no cuenta.</p>` : ""}
    <form class="form stack" data-request novalidate style="gap:12px">
      <fieldset class="kind-pick" style="border:0;padding:0;margin:0"><legend class="sr-only">Qué queréis cambiar</legend>
        <label><input type="radio" name="tipo" value="correccion" checked><span>Corregir datos o erratas</span><small>Siempre incluido: nombres, fechas, horas, direcciones, faltas…</small></label>
        <label><input type="radio" name="tipo" value="cambio" ${canChange ? "" : "disabled"}><span>Cambio de diseño</span><small>${changeHint}</small></label>
      </fieldset>
      <div class="field"><label for="req-msg">¿Qué cambiamos?</label>
        <textarea id="req-msg" name="mensaje" rows="4" maxlength="4000" placeholder="Por ejemplo: el autobús sale a las 17:30, no a las 17:00." required></textarea></div>
      <p class="error" data-req-err role="alert"></p>
      <div class="btn-row"><button class="btn btn--primary" type="submit">Enviar</button></div>
    </form>
    ${list.length ? html`<h3 class="small muted" style="margin:20px 0 8px;font-weight:600">Lo que nos habéis pedido</h3>
      <div>${list.map((r) => html`<div class="request">
        <span class="request__msg">${r.message}</span>
        <span class="status" data-s="${r.status === "hecho" ? "hecha" : r.status === "descartado" ? "cancelada" : "borrador"}">${STATUS[r.status] || r.status}</span>
        <span class="request__meta">${r.kind === "cambio" ? "Cambio de diseño" : "Corrección"}${r.proposal ? ` · propuesta ${r.proposal}` : ""} · ${fmtDate(r.created_at)}</span>
        ${r.reply ? html`<span class="request__reply">${r.reply}</span>` : ""}</div>`)}</div>` : ""}
  </section>`;
}

function bind(code, p, latest) {
  $("[data-ask]")?.addEventListener("click", () => {
    const form = $("[data-request]");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    const change = form.querySelector("input[value=cambio]");
    if (!change.disabled) change.checked = true;
    setTimeout(() => form.mensaje.focus({ preventScroll: true }), 300);
  });

  $("[data-approve]")?.addEventListener("click", async (e) => {
    const n = Number(e.currentTarget.dataset.approve);
    if (!confirm(`¿Aprobáis la propuesta ${n}? La publicaremos tal cual y os avisaremos.`)) return;
    e.currentTarget.disabled = true;
    try {
      await api({ accion: "aprobar", c: code, propuesta: n });
      toast("¡Genial! Os avisamos en cuanto esté publicada.");
      start();
    } catch (ex) {
      e.currentTarget.disabled = false;
      toast(ex.code === "propuesta" ? "Hay una propuesta más nueva: recargad la página." : "No se ha podido enviar. Probad otra vez.", { error: true });
    }
  });

  $("[data-request]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target, err = $("[data-req-err]");
    const mensaje = form.mensaje.value.trim();
    if (mensaje.length < 3) { err.textContent = "Escribid qué queréis cambiar."; return form.mensaje.focus(); }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      await api({ accion: "cambio", c: code, tipo: form.tipo.value, mensaje, propuesta: latest?.number ?? null });
      toast("Recibido. Os avisamos con la próxima propuesta.");
      start();
    } catch (ex) {
      btn.disabled = false; btn.textContent = "Enviar";
      err.textContent = ex.code === "sin_rondas" ? "Ya habéis usado las rondas de cambios de vuestro plan. Escribidnos y lo vemos."
        : ex.code === "demasiadas" ? "Habéis mandado muchos mensajes hoy. Si es urgente, escribidnos."
        : "No se ha podido enviar. Revisad la conexión y probad otra vez.";
    }
  });

  $("[data-panel]")?.addEventListener("click", async (e) => {
    const msg = $("[data-panel-msg]");
    e.currentTarget.disabled = true;
    try {
      const r = await api({ accion: "panel", c: code });
      const sent = r.enviados.filter((x) => x.status === "enviado").map((x) => x.email);
      msg.textContent = sent.length ? `Listo: mirad el email (${sent.join(", ")}). El enlace sirve una vez.`
        : "Ahora mismo no podemos mandar emails. Escribidnos y os pasamos el enlace.";
    } catch (ex) {
      msg.textContent = ex.code === "demasiadas" ? "Ya os lo hemos mandado hace poco: mirad el email (y la carpeta de spam)." : "No se ha podido mandar. Probad otra vez en un rato.";
    }
    e.currentTarget.disabled = false;
  });
}

addEventListener("popstate", () => start());
start();
