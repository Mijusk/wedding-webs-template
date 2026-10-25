import { $, esc, session } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { loadCatalog, renderStyleCards, limitToTwoRows } from "./catalog.js";
import { setupBuilder, openBuilder, closeBuilder, playLoading, SAMPLE_EMAIL } from "./builder.js";
import { setupStage, prepareStage, openStage, closeStage, toggleSectionsPanel } from "./stage.js";
import { setupPricing } from "./pricing.js";
import { saveLead } from "./leads.js";
import { startEntrance, revealOnScroll } from "./entrance.js";
import { captureAttribution } from "./attribution.js";

async function start() {
  captureAttribution();
  const catalog = await loadCatalog();
  const { studio, styles, available, templateIds, demoPhotos, urlOf, configFor, withTheme } = catalog;

  document.title = studio.brand.name;
  $("#brand-name").textContent = studio.brand.name;
  $("#foot-brand").textContent = studio.brand.name;
  $("#brand-tagline").textContent = studio.brand.tagline;
  startEntrance();

  // Móvil de la portada
  fitScaled($(".phone .scaled"));
  showInFrame($("#intro-frame"), urlOf(available[0]), withTheme(available[0]));

  // Estilos
  const templates = new Set(templateIds);
  const soon = styles.filter((s) => s.status !== "available").map((s) => s.name);
  $("#styles-note").textContent =
    `Ahora mismo hay ${templates.size === 1 ? "una plantilla" : `${templates.size} plantillas`} en ${available.length} estilos.`
    + (soon.length ? ` ${soon.join(", ")} está en camino.` : "");
  renderStyleCards($("#styles-grid"), catalog);
  limitToTwoRows($("#styles-grid"), $("#styles-more"));
  $("#styles-grid").addEventListener("click", (e) => {
    const t = e.target.closest("[data-try], [data-demo]");
    if (!t) return;
    if (t.dataset.try) return openBuilder(t.dataset.try);
    prepareStage(null, styles.find((s) => s.id === t.dataset.demo));
    openStage();
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
      setupPricing.prefill(wedding);
      const ready = prepareStage(wedding, style);
      await Promise.all([ready, playLoading(wedding, studio.generator)]);
      openStage();
    },
  });
  document.querySelectorAll("[data-open-builder]").forEach((b) => b.addEventListener("click", () => openBuilder()));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#builder").hidden) closeBuilder();
    else if (!$("#sections-panel").hidden) toggleSectionsPanel(false);
    else if (!$("#stage").hidden) closeStage();
  });

  setupNudge();

  // Desde plantillas.html: ?probar=<estilo> abre el generador y ?ver=<estilo> el ejemplo.
  const params = new URLSearchParams(location.search);
  const pick = (id) => available.find((s) => s.id === id);
  if (params.has("probar")) openBuilder(pick(params.get("probar"))?.id);
  else if (pick(params.get("ver"))) { prepareStage(null, pick(params.get("ver"))); openStage(); }
  if (params.has("probar") || params.has("ver")) history.replaceState(null, "", location.pathname + location.hash);
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

// Aviso "¿Probamos con vuestra boda?" al llegar a los estilos. Una vez por visita.
function setupNudge() {
  const nudge = $("#nudge"), KEY = "studio-nudge-done";
  if (session.get(KEY)) return;
  const done = () => { session.set(KEY, "1"); nudge.hidden = true; removeEventListener("scroll", onScroll); };
  const onScroll = () => {
    const trigger = $("#estilos").offsetTop - innerHeight * 0.4;
    const busy = !$("#builder").hidden || !$("#stage").hidden || !$("#loading").hidden;
    // Si ya están en las tarifas (o reservando), el aviso estorbaría: tapa el botón de pagar en el móvil.
    const atPricing = $("#tarifas").getBoundingClientRect().top < innerHeight * 0.8;
    if (atPricing) return;
    if (scrollY > trigger && !busy) { nudge.hidden = false; removeEventListener("scroll", onScroll); }
  };
  $("#contact-form").addEventListener("focusin", () => { if (!nudge.hidden) done(); });
  addEventListener("scroll", onScroll, { passive: true });
  $("#nudge-yes").addEventListener("click", () => { done(); openBuilder(); });
  $("#nudge-no").addEventListener("click", done);
  document.querySelectorAll("[data-open-builder], [data-try]").forEach((b) => b.addEventListener("click", done));
}

start().catch((e) => {
  startEntrance();
  $("#styles-grid").innerHTML = `<p class="error">No se pudo cargar el escaparate: ${esc(e.message)}</p>`;
});
