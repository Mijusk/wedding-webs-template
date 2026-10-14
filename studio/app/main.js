import { $, esc, session } from "./util.js";
import { showInFrame, fitScaled } from "./preview.js";
import { setupBuilder, openBuilder, closeBuilder, playLoading } from "./builder.js";
import { setupStage, prepareStage, openStage, closeStage } from "./stage.js";
import { setupPricing } from "./pricing.js";

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
  // El config de ejemplo de la plantilla sirve de demo y de base para cada web generada.
  const templateBase = new URL(urlOf(available[0]), location.href);
  const demo = await getJson(new URL("config.json", templateBase));
  const withTheme = (style) => ({ ...demo, theme: style.theme });

  document.title = studio.brand.name;
  $("#brand-name").textContent = studio.brand.name;
  $("#foot-brand").textContent = studio.brand.name;
  $("#brand-tagline").textContent = studio.brand.tagline;

  // Móvil de la portada
  fitScaled($(".phone .scaled"));
  showInFrame($("#intro-frame"), urlOf(available[0]), withTheme(available[0]));

  // Estilos
  const templates = new Set(available.map((s) => s.template));
  const soon = styles.filter((s) => s.status !== "available").map((s) => s.name);
  $("#styles-note").textContent =
    `Ahora mismo hay ${templates.size === 1 ? "una plantilla" : `${templates.size} plantillas`} en ${available.length} estilos.`
    + (soon.length ? ` ${soon.join(", ")} está en camino.` : "");
  $("#styles-grid").innerHTML = styles.map((s) => s.status === "available" ? `
    <article class="style-card">
      <div class="scaled" data-base-width="1280" data-base-height="960">
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
  $("#styles-grid").querySelectorAll(".scaled").forEach((box, i) => {
    fitScaled(box);
    showInFrame(box.querySelector("iframe"), urlOf(available[i]), withTheme(available[i]));
  });
  $("#styles-grid").addEventListener("click", (e) => {
    const t = e.target.closest("[data-try], [data-demo]");
    if (!t) return;
    if (t.dataset.try) return openBuilder(t.dataset.try);
    const style = styles.find((s) => s.id === t.dataset.demo);
    prepareStage(demo, style, { demo: true });
    openStage();
  });

  // Generador
  setupPricing({ studio, templateBase });
  setupStage({
    studio,
    onEdit: (styleId) => openBuilder(styleId),
    onKeep: (state) => setupPricing.choose(state),
  });
  setupBuilder({
    studio, demo,
    onGenerate: async (config, style) => {
      prepareStage(config, style);
      await playLoading(config, studio.generator);
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
