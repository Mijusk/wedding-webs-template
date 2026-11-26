import { $, esc, session, friendlyError, faqItems } from "./util.js";
import { fitScaled } from "./preview.js";
import { loadStudio, makeCatalog, applyLivePrices, renderStyleCards, limitToTwoRows } from "./catalog.js";
import { setupBuilder, openBuilder, closeBuilder, playLoading } from "./builder.js";
import { setupStage, prepareStage, openStage, closeStage, toggleSectionsPanel, stageState, weddingFromHash } from "./stage.js";
import { setupQuick } from "./quick.js";
import { setupSend, closeSend, sendOpen, scheduleSaveNudge, hideNudge } from "./send.js";
import { setupPricing } from "./pricing.js";
import { saveLead } from "./leads.js";
import { startEntrance, revealOnScroll, scrollToHash } from "./entrance.js";
import { watchViewport } from "./viewport.js";
import { captureAttribution } from "./attribution.js";
import { setupConsent } from "./consent.js";
import { initAnalytics, track } from "./analytics.js";
import { addStructuredData } from "./seo.js";
import { initAds, conversion } from "./ads.js";

// La portada (textos y fotos) ya está en el HTML y la cortina la levanta un script de la propia
// página, sin esperar a nada. Aquí solo hace falta studio.json para el resto; los precios de la
// base de datos y el config de cada plantilla llegan después, sin bloquear.
startEntrance();
watchViewport();

async function start() {
  setupConsent();
  captureAttribution();
  const studio = await loadStudio();
  const catalog = makeCatalog(studio);
  initAnalytics(studio);
  initAds(studio);
  const { styles, available, templateIds, demoPhotos, urlOf, configFor, previewFor, withTheme } = catalog;

  document.title = studio.brand.name;
  const faq = faqItems(studio);
  addStructuredData(studio, { faq });
  // El HTML ya trae la marca y el titular; solo se tocan si studio.json dice otra cosa.
  if ($("#brand-name").textContent !== studio.brand.name) $("#brand-name").textContent = studio.brand.name;
  if ($("#foot-brand").textContent !== studio.brand.name) $("#foot-brand").textContent = studio.brand.name;
  if ($("#brand-tagline").getAttribute("aria-label") !== studio.brand.tagline) $("#brand-tagline").textContent = studio.brand.tagline;

  // Estilos
  const templates = new Set(templateIds);
  const soon = styles.filter((s) => s.status !== "available").map((s) => s.name);
  $("#styles-note").textContent =
    `Ahora mismo hay ${templates.size === 1 ? "una plantilla" : `${templates.size} plantillas`} en ${available.length} estilos.`
    + (soon.length ? ` ${soon.join(", ")} está en camino.` : "");
  renderStyleCards($("#styles-grid"), catalog);
  limitToTwoRows($("#styles-grid"), $("#styles-more"));
  $("#styles-grid").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-try], [data-demo]");
    if (!t) return;
    if (t.dataset.try) { track("probar_abierto", { estilo: t.dataset.try, desde: "estilos" }); return openBuilder(t.dataset.try); }
    track("ejemplo_visto", { estilo: t.dataset.demo });
    await showExample(styles.find((s) => s.id === t.dataset.demo));
  });

  revealOnScroll(".hero__foot .lead, .section-head, .style-card, .steps__list li, .tier, .contact, .foot");

  // Generador
  setupPricing({ studio, templateUrl: (style) => new URL(urlOf(style), location.href) });
  setupStage({
    studio, configFor,
    onEdit: (styleId) => openBuilder(styleId),
    onKeep: (state) => setupPricing.choose(state),
    onClose: () => hideNudge(),
    onGuest: () => track("probar_como_invitado", { estilo: stageState()?.style.id }),
    onShare: () => track("prueba_compartida", { estilo: stageState()?.style.id }),
  });

  // Guardar la prueba (el email se pide al final, ver send.js). Cada email es un contacto; si
  // después editan los datos o cambian de estilo, se actualiza su fila sin volver a preguntar.
  let saved = null; // { phone, email } de la última vez que la guardaron
  const saveTrial = async (contact, { wedding, style }) => {
    const { payload } = await saveLead(leadFromTrial({ ...wedding, ...contact }, style), studio.contact);
    const key = `studio-lead:${(contact.phone || contact.email).replace(/\s+/g, "").toLowerCase()}`;
    if (!session.get(key)) { session.set(key, "1"); conversion("lead", { estilo: style.id }, { eventId: payload.eventId }); }
    saved = contact;
    setupPricing.prefill({ ...wedding, ...contact });
  };
  setupSend({
    getState: () => stageState(),
    onOpen: (from) => track("guardar_abierto", { desde: from }),
    onSave: saveTrial,
  });

  setupBuilder({
    studio, demoPhotos, previewFor,
    onGenerate: async (wedding, style) => {
      track("prueba_generada", { estilo: style.id, fotos: wedding.photos.length, ejemplo: wedding.sample ? "si" : "no" });
      setupPricing.prefill(saved ? { ...wedding, ...saved } : wedding);
      const loading = playLoading(wedding, studio.generator);
      try {
        await Promise.all([prepareStage(wedding, style), loading]);
        openStage();
        if (saved) saveTrial(saved, { wedding, style }).catch(() => {});
        else scheduleSaveNudge();
      } catch (e) {
        console.error("[WeddingWebs] vista previa:", e);
        await loading;
        openBuilder(style.id);
        $("#b-error").textContent = "No hemos podido preparar la vista previa. Revisad la conexión y volved a intentarlo.";
      }
    },
  });
  const quick = setupQuick({
    style: available[0], url: urlOf(available[0]), withTheme,
    onStart: (names, focus) => { track("probar_abierto", { desde: "portada_nombres", nombres: names.every(Boolean) ? "si" : "no" }); openBuilder(available[0].id, { names, focus }); },
  });
  document.querySelectorAll("[data-open-builder]").forEach((b) => b.addEventListener("click", () => { track("probar_abierto", { desde: "boton" }); openBuilder(); }));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (sendOpen()) closeSend();
    else if (!$("#builder").hidden) closeBuilder();
    else if (!$("#share-pop").hidden) $("#share-pop").hidden = true;
    else if (!$("#sections-panel").hidden) toggleSectionsPanel(false);
    else if (!$("#stage").hidden) closeStage();
  });

  trackCookieBanner();
  renderAbout(studio.about);
  renderTestimonials(studio.testimonials);
  renderFaq(faq);
  setupNudge();
  // Si se llegó con un enlace a una sección (#tarifas), ahora que ya está pintada.
  scrollToHash();

  // Móvil de la portada: la web de ejemplo, en cuanto la página ha cargado lo suyo.
  fitScaled($(".phone .scaled"));
  // Con los nombres que ya hayan escrito, si se adelantaron.
  afterLoad(() => quick.paint(true).catch((e) => console.error("[WeddingWebs] móvil de la portada:", e)));

  // Precios de la base de datos, cuando lleguen.
  applyLivePrices(studio).then((changed) => { if (changed) { setupPricing.refresh(); addStructuredData(studio, { faq }); } });

  // Desde plantillas.html: ?probar=<estilo> abre el generador y ?ver=<estilo> el ejemplo.
  const params = new URLSearchParams(location.search);
  const pick = (id) => available.find((s) => s.id === id);
  const shared = weddingFromHash();
  if (shared) {
    // Enlace que les ha pasado su pareja (#boda=…): directos a su web, con fotos de ejemplo.
    history.replaceState(null, "", location.pathname + location.search);
    track("prueba_abierta_compartida", { estilo: shared.style });
    setupPricing.prefill(shared.wedding);
    try { await prepareStage(shared.wedding, pick(shared.style) || available[0]); openStage(); scheduleSaveNudge(30000); }
    catch (e) { console.error("[WeddingWebs] enlace compartido:", e); }
  } else if (params.has("probar")) openBuilder(pick(params.get("probar"))?.id);
  else if (pick(params.get("ver"))) await showExample(pick(params.get("ver")));
  else if (params.has("prueba")) await openSavedTrial(params.get("prueba"), (id) => pick(id) || available[0]);
  if (params.has("probar") || params.has("ver") || params.has("prueba")) history.replaceState(null, "", location.pathname + location.hash);
}

// Testimonios (studio.json > testimonials): solo los que tienen nombre y texto. Sin ninguno, no sale.
function renderTestimonials(list) {
  const items = (Array.isArray(list) ? list : []).filter((t) => t?.name && t?.text);
  if (!items.length) return;
  $("#testimonials-list").innerHTML = items.map((t) => `
    <figure class="testimonial">
      <blockquote><p>${esc(t.text)}</p></blockquote>
      <figcaption>${t.photo ? `<img src="${esc(t.photo)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : ""}<span>${esc(t.name)}</span></figcaption>
    </figure>`).join("");
  $("#testimonios").hidden = false;
  revealOnScroll(".testimonial");
}

// Preguntas frecuentes, desplegables (<details>: funcionan con teclado y sin JavaScript extra).
function renderFaq(items) {
  if (!items.length) return;
  $("#faq-list").innerHTML = items.map((i) => `
    <details class="faq__item"><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`).join("");
  $("#preguntas").hidden = false;
  $("#faq-list").addEventListener("toggle", (e) => { if (e.target.open) track("faq_abierta", { pregunta: e.target.querySelector("summary").textContent.slice(0, 60) }); }, true);
}

// «Quiénes somos» (studio.json > about). Sin datos, la sección no sale.
function renderAbout(about) {
  const el = $("#quienes-somos");
  if (!about?.title || !about.text?.length) return;
  const set = (key, value) => { const n = el.querySelector(`[data-about="${key}"]`); if (n) n.textContent = value || ""; };
  ["eyebrow", "title", "name", "role"].forEach((k) => set(k, about[k]));
  el.querySelector("[data-about=text]").innerHTML = about.text.map((p) => `<p>${esc(p)}</p>`).join("");
  const img = el.querySelector(".about__photo");
  if (about.photo) { img.src = about.photo; img.alt = about.photoAlt || about.name || ""; } else img.remove();
  el.hidden = false;
  revealOnScroll(".about");
}

async function showExample(style) {
  try {
    await prepareStage(null, style);
    openStage();
  } catch (e) {
    console.error("[WeddingWebs] ejemplo:", e);
  }
}

// Después del evento load (fotos de la portada ya bajadas), o enseguida si ya pasó.
function afterLoad(fn) {
  if (document.readyState === "complete") setTimeout(fn, 0);
  else addEventListener("load", () => setTimeout(fn, 0), { once: true });
}

// Desde el email de bienvenida (?prueba=<clave>): la web que probaron, con sus datos y fotos de
// ejemplo (las suyas nunca salieron de su móvil).
async function openSavedTrial(token, styleFor) {
  try {
    const res = await fetch(`/api/lead?prueba=${encodeURIComponent(token)}`);
    if (!res.ok) return;
    const { prueba: p } = await res.json();
    const wedding = { couple: p.couple, date: p.date, time: p.time, venue: p.venue, city: p.city, photos: [] };
    setupPricing.prefill({ ...wedding, email: p.email });
    await prepareStage(wedding, styleFor(p.style));
    openStage();
  } catch { /* sin la prueba guardada, el escaparate de siempre */ }
}

function leadFromTrial(w, style) {
  return {
    type: "prueba",
    email: w.email || undefined,
    phone: w.phone || undefined,
    name: w.couple.join(" y "),
    nameA: w.couple[0],
    nameB: w.couple[1],
    weddingDate: `${w.date} ${w.time}`,
    venue: [w.venue, w.city].filter(Boolean).join(", "),
    city: w.city,
    style: style.id,
    photos: w.photos.length,
    // El texto exacto que aceptaron (prueba del consentimiento, RGPD).
    consent: true,
    consentText: document.querySelector("label[for=b-consent] span")?.textContent.replace(/\s+/g, " ").trim(),
  };
}

// Mientras el aviso de cookies esté abierto, su tamaño en --cookies-h / --cookies-w: el generador
// y la vista previa le dejan sitio para que no tape «Siguiente» ni la barra de estilos.
function trackCookieBanner() {
  const body = document.body;
  const ro = new ResizeObserver(([e]) => {
    const r = e.target.getBoundingClientRect();
    body.style.setProperty("--cookies-h", `${Math.ceil(r.height + 24)}px`);
    body.style.setProperty("--cookies-w", `${Math.ceil(r.width + 24)}px`);
  });
  let watched = null;
  const check = () => {
    const banner = document.querySelector("body > .cookies");
    if (banner === watched) return;
    if (watched) ro.unobserve(watched);
    watched = banner;
    if (banner) ro.observe(banner);
    else { body.style.removeProperty("--cookies-h"); body.style.removeProperty("--cookies-w"); }
  };
  new MutationObserver(check).observe(body, { childList: true });
  check();
}

// Botón pequeño fijo abajo, «Probar con vuestra boda», mientras miran los estilos. No sale con el
// aviso de cookies puesto, con una capa abierta ni al llegar a las tarifas (tapaba el botón de pagar).
function setupNudge() {
  const nudge = $("#nudge");
  const update = () => {
    const pastHero = $("#estilos").getBoundingClientRect().top < innerHeight * 0.6;
    const atPricing = $("#tarifas").getBoundingClientRect().top < innerHeight * 0.9;
    const busy = ["#builder", "#stage", "#loading", "#send"].some((id) => !$(id).hidden);
    // En el móvil el botón de arriba ya está siempre a la vista: aquí sería repetirlo.
    const show = pastHero && !atPricing && !busy && !document.querySelector(".cookies") && !matchMedia("(max-width: 760px)").matches;
    nudge.hidden = !show;
    document.body.classList.toggle("has-nudge", show);
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  // El aviso de cookies entra y sale del <body>; las capas cambian su atributo hidden.
  new MutationObserver(update).observe(document.body, { childList: true });
  ["#builder", "#stage", "#loading"].forEach((id) => new MutationObserver(update).observe($(id), { attributes: true, attributeFilter: ["hidden"] }));
  nudge.addEventListener("click", () => { track("probar_abierto", { desde: "boton_fijo" }); openBuilder(); });
  update();
}

start().catch((e) => {
  $("#styles-grid").innerHTML = friendlyError("los estilos", e);
});
