import { $, esc, session } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { setupBuilder, openBuilder, closeBuilder, playLoading, SAMPLE_EMAIL } from "./builder.js";
import { setupStage, prepareStage, openStage, closeStage } from "./stage.js";
import { setupPricing } from "./pricing.js";
import { toConfig } from "./wedding.js";
import { saveLead } from "./leads.js";
import { findDemoPhotos, applyDemoPhotos } from "./demo.js";

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

async function start() {
  const studio = await getJson("studio.json");
  const styles = studio.styles;
  const available = styles.filter((s) => s.status === "available");
  const urlOf = (style) => studio.templates[style.template].url;
  // Cada plantilla trae su config de ejemplo: sirve de demo y de base para cada web generada.
  const templateIds = [...new Set(available.map((s) => s.template))];
  const bases = Object.fromEntries(await Promise.all(templateIds.map(async (id) =>
    [id, await getJson(new URL("config.json", new URL(studio.templates[id].url, location.href)))])));
  const demoPhotos = await findDemoPhotos(studio.demoPhotos);
  Object.values(bases).forEach((base) => applyDemoPhotos(base, demoPhotos));
  const configFor = (style, wedding) => toConfig(bases[style.template], wedding, style);
  const withTheme = (style) => configFor(style, null);

  document.title = studio.brand.name;
  $("#brand-name").textContent = studio.brand.name;
  $("#foot-brand").textContent = studio.brand.name;
  $("#brand-tagline").textContent = studio.brand.tagline;

  // Móvil de la portada
  fitScaled($(".phone .scaled"));
  showInFrame($("#intro-frame"), urlOf(available[0]), withTheme(available[0]));

  // Estilos
  const templates = new Set(templateIds);
  const soon = styles.filter((s) => s.status !== "available").map((s) => s.name);
  $("#styles-note").textContent =
    `Ahora mismo hay ${templates.size === 1 ? "una plantilla" : `${templates.size} plantillas`} en ${available.length} estilos.`
    + (soon.length ? ` ${soon.join(", ")} está en camino.` : "");
  $("#styles-grid").innerHTML = styles.map((s) => s.status === "available" ? `
    <article class="style-card">
      <div class="scaled" data-base-width="1280" data-base-height="960" data-style="${esc(s.id)}">
        <iframe title="Ejemplo del estilo ${esc(s.name)}" tabindex="-1" aria-hidden="true" loading="lazy"></iframe>
      </div>
      <div><h3>${esc(s.name)}</h3><p class="style-card__meta">Plantilla ${esc(studio.templates[s.template].name)}</p></div>
      <p class="style-card__desc">${esc(s.description)}</p>
      <div class="style-card__actions">
        <button class="btn btn--small" type="button" data-try="${esc(s.id)}">Probar con vuestra boda</button>
        <button class="btn btn--small btn--ghost" type="button" data-demo="${esc(s.id)}">Ver ejemplo</button>
      </div>
    </article>` : `
    <article class="style-card style-card--soon">
      <div class="soon-box">Próximamente</div>
      <div><h3>${esc(s.name)}</h3><p class="style-card__meta"><span class="tag">Nueva plantilla</span></p></div>
      <p class="style-card__desc">${esc(s.description)}</p>
    </article>`).join("");
  $("#styles-grid").querySelectorAll(".scaled").forEach((box) => {
    const style = styles.find((s) => s.id === box.dataset.style);
    fitScaled(box);
    showInFrame(box.querySelector("iframe"), urlOf(style), withTheme(style));
  });
  $("#styles-grid").addEventListener("click", (e) => {
    const t = e.target.closest("[data-try], [data-demo]");
    if (!t) return;
    if (t.dataset.try) return openBuilder(t.dataset.try);
    prepareStage(null, styles.find((s) => s.id === t.dataset.demo));
    openStage();
  });

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
    else if (!$("#stage").hidden) closeStage();
  });

  setupNudge();
}

function leadFromTrial(w, style) {
  return {
    type: "prueba",
    email: w.email,
    name: w.couple.join(" y "),
    weddingDate: `${w.date} ${w.time}`,
    venue: [w.venue, w.city].filter(Boolean).join(", "),
    style: style.id,
    photos: w.photos.length,
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
    if (scrollY > trigger && !busy) { nudge.hidden = false; removeEventListener("scroll", onScroll); }
  };
  addEventListener("scroll", onScroll, { passive: true });
  $("#nudge-yes").addEventListener("click", () => { done(); openBuilder(); });
  $("#nudge-no").addEventListener("click", done);
  document.querySelectorAll("[data-open-builder], [data-try]").forEach((b) => b.addEventListener("click", done));
}

start().catch((e) => {
  $("#styles-grid").innerHTML = `<p class="error">No se pudo cargar el escaparate: ${esc(e.message)}</p>`;
});
