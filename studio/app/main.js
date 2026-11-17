import { $, esc, session, friendlyError } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { loadStudio, makeCatalog, applyLivePrices, renderStyleCards, limitToTwoRows } from "./catalog.js";
import { setupBuilder, openBuilder, closeBuilder, playLoading, SAMPLE_EMAIL } from "./builder.js";
import { setupStage, prepareStage, openStage, closeStage, toggleSectionsPanel } from "./stage.js";
import { setupPricing } from "./pricing.js";
import { saveLead } from "./leads.js";
import { startEntrance, revealOnScroll, scrollToHash } from "./entrance.js";
import { captureAttribution } from "./attribution.js";
import { setupConsent } from "./consent.js";
import { initAnalytics, track } from "./analytics.js";
import { addStructuredData } from "./seo.js";

// La portada (textos y fotos) ya está en el HTML y la cortina la levanta un script de la propia
// página, sin esperar a nada. Aquí solo hace falta studio.json para el resto; los precios de la
// base de datos y el config de cada plantilla llegan después, sin bloquear.
startEntrance();

async function start() {
  setupConsent();
  captureAttribution();
  const studio = await loadStudio();
  const catalog = makeCatalog(studio);
  initAnalytics(studio);
  const { styles, available, templateIds, demoPhotos, urlOf, configFor, withTheme } = catalog;

  document.title = studio.brand.name;
  addStructuredData(studio);
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
  });
  setupBuilder({
    studio, demoPhotos,
    onGenerate: async (wedding, style) => {
      // Cada prueba es un contacto: se guarda en cuanto se genera (sin fotos). Una vez por
      // email y visita, aunque editen los datos, y nunca el email del botón de ejemplo.
      const key = `studio-lead:${wedding.email.toLowerCase()}`;
      if (wedding.email !== SAMPLE_EMAIL && !session.get(key)) {
        session.set(key, "1");
        saveLead(leadFromTrial(wedding, style), studio.contact).catch(() => session.set(key, ""));
      }
      track("prueba_generada", { estilo: style.id, fotos: wedding.photos.length });
      setupPricing.prefill(wedding);
      const loading = playLoading(wedding, studio.generator);
      try {
        await Promise.all([prepareStage(wedding, style), loading]);
        openStage();
      } catch (e) {
        console.error("[WeddingWebs] vista previa:", e);
        await loading;
        openBuilder(style.id);
        $("#b-error").textContent = "No hemos podido preparar la vista previa. Revisad la conexión y volved a pulsar «Crear nuestra web».";
      }
    },
  });
  document.querySelectorAll("[data-open-builder]").forEach((b) => b.addEventListener("click", () => { track("probar_abierto", { desde: "boton" }); openBuilder(); }));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#builder").hidden) closeBuilder();
    else if (!$("#sections-panel").hidden) toggleSectionsPanel(false);
    else if (!$("#stage").hidden) closeStage();
  });

  renderAbout(studio.about);
  setupNudge();
  // Si se llegó con un enlace a una sección (#tarifas), ahora que ya está pintada.
  scrollToHash();

  // Móvil de la portada: la web de ejemplo, en cuanto la página ha cargado lo suyo.
  fitScaled($(".phone .scaled"));
  afterLoad(() => withTheme(available[0])
    .then((config) => showInFrame($("#intro-frame"), urlOf(available[0]), config))
    .catch((e) => console.error("[WeddingWebs] móvil de la portada:", e)));

  // Precios de la base de datos, cuando lleguen.
  applyLivePrices(studio).then((changed) => { if (changed) { setupPricing.refresh(); addStructuredData(studio); } });

  // Desde plantillas.html: ?probar=<estilo> abre el generador y ?ver=<estilo> el ejemplo.
  const params = new URLSearchParams(location.search);
  const pick = (id) => available.find((s) => s.id === id);
  if (params.has("probar")) openBuilder(pick(params.get("probar"))?.id);
  else if (pick(params.get("ver"))) await showExample(pick(params.get("ver")));
  else if (params.has("prueba")) await openSavedTrial(params.get("prueba"), (id) => pick(id) || available[0]);
  if (params.has("probar") || params.has("ver") || params.has("prueba")) history.replaceState(null, "", location.pathname + location.hash);
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
    const wedding = { couple: p.couple, date: p.date, time: p.time, venue: p.venue, city: p.city, email: p.email, photos: [] };
    setupPricing.prefill(wedding);
    await prepareStage(wedding, styleFor(p.style));
    openStage();
  } catch { /* sin la prueba guardada, el escaparate de siempre */ }
}

function leadFromTrial(w, style) {
  return {
    type: "prueba",
    email: w.email,
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

// Botón pequeño fijo abajo, «Probar con vuestra boda», mientras miran los estilos. No sale con el
// aviso de cookies puesto, con una capa abierta ni al llegar a las tarifas (tapaba el botón de pagar).
function setupNudge() {
  const nudge = $("#nudge");
  const update = () => {
    const pastHero = $("#estilos").getBoundingClientRect().top < innerHeight * 0.6;
    const atPricing = $("#tarifas").getBoundingClientRect().top < innerHeight * 0.9;
    const busy = ["#builder", "#stage", "#loading"].some((id) => !$(id).hidden);
    const show = pastHero && !atPricing && !busy && !document.querySelector(".cookies");
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
