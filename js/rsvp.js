import { saveRsvp } from "./storage.js";
import { esc, dayMonth, weddingPhase, rsvpClosed } from "./format.js";

// Formulario de confirmación en un <dialog>. Lo abre cualquier [data-rsvp-open]:
// el botón flotante (visible entre la portada y el cierre) y el del cierre.
export function mountRsvp(root, config) {
  const { rsvp = {}, event } = config;
  // Después de la boda no hay nada que confirmar.
  if (weddingPhase(event) === "after") { root.innerHTML = ""; return; }
  const closed = rsvpClosed(config);
  const deadline = rsvp.deadline ? dayMonth(rsvp.deadline) : null;

  root.innerHTML = `
    <button class="rsvp-fab" id="rsvp-open" aria-expanded="false" aria-controls="rsvp-panel">${esc(rsvp.buttonLabel || "Confirmar asistencia")}</button>
    <div class="rsvp-panel" id="rsvp-panel" role="dialog" aria-labelledby="rsvp-title" hidden>
      <button class="close" id="rsvp-close" aria-label="Cerrar">×</button>
      <p class="eyebrow">RSVP</p>
      <h2 id="rsvp-title">¿Vienes?</h2>
      ${closed
        ? `<p class="note">${esc(rsvp.closedText || "Ya hemos cerrado la lista de invitados. Si necesitas cambiar algo, escríbenos directamente.")}</p>`
        : deadline ? `<p class="note">Confírmanos antes del ${esc(deadline)}.</p>` : ""}
      <form id="rsvp-form" novalidate${closed ? " hidden" : ""}>
        <div class="hp" aria-hidden="true"><label>No rellenar <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="field">
          <label for="rsvp-name">Nombre y apellidos</label>
          <input type="text" id="rsvp-name" name="name" autocomplete="name" required>
        </div>
        <fieldset class="field">
          <legend>Asistencia</legend>
          <div class="choice">
            <label><input type="radio" id="rsvp-yes" name="attending" value="si"><span>Sí, allí estaré</span></label>
            <label><input type="radio" id="rsvp-no" name="attending" value="no"><span>No podré ir</span></label>
          </div>
        </fieldset>
        <div class="field">
          <label for="rsvp-song">Una canción que no puede faltar</label>
          <input type="text" id="rsvp-song" name="song" placeholder="Opcional">
        </div>
        <p class="error" id="rsvp-error" role="alert"></p>
        <button class="submit" type="submit" id="rsvp-submit">Enviar respuesta</button>
      </form>
      <div class="thanks" id="rsvp-thanks" hidden></div>
    </div>`;

  const $ = (id) => root.querySelector(`#${id}`);
  const panel = $("rsvp-panel"), fab = $("rsvp-open"), form = $("rsvp-form");
  const toggle = (open) => { panel.hidden = !open; fab.setAttribute("aria-expanded", open); if (open) $("rsvp-name").focus(); };

  fab.addEventListener("click", () => toggle(panel.hidden));
  $("rsvp-close").addEventListener("click", () => toggle(false));
  // Se puede montar varias veces (vista previa): quita el listener del montaje anterior.
  document.removeEventListener("keydown", root._onKey);
  root._onKey = (e) => { if (e.key === "Escape") toggle(false); };
  document.addEventListener("keydown", root._onKey);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const name = (data.name || "").trim();
    const song = (data.song || "").trim();
    const err = $("rsvp-error");
    if (data.website) { form.hidden = true; return; } // campo trampa: un bot
    if (name.length < 2) { err.textContent = "Escribe tu nombre para saber quién eres."; return $("rsvp-name").focus(); }
    if (!data.attending) { err.textContent = "Marca si vienes o no."; return; }
    err.textContent = "";

    const btn = $("rsvp-submit");
    btn.disabled = true; btn.textContent = t.sending;
    try {
      await saveRsvp({ name, attending: data.attending, song }, rsvp);
      const first = name.split(" ")[0];
      const thanks = $("rsvp-thanks");
      thanks.innerHTML = data.attending === "si"
        ? `<h3>${fill(t.thanksYesTitle, { name: first })}</h3><p>${fill(t.thanksYesText)} ${song && t.thanksSong ? fill(t.thanksSong, { song }) : ""}</p>`
        : `<h3>${fill(t.thanksNoTitle)}</h3><p>${fill(t.thanksNoText, { name: first })}</p>`;
      form.hidden = true;
      thanks.hidden = false;
      $("rsvp-close").focus();
    } catch {
      err.textContent = "No se ha podido guardar tu respuesta. Revisa tu conexión y vuelve a intentarlo; si sigue fallando, avísanos por otra vía.";
      btn.disabled = false; btn.textContent = "Enviar respuesta";
    }
  });
}

// El botón flotante solo aparece cuando no se ve ni la portada ni el cierre.
function watchPill(pill) {
  const blockers = document.querySelectorAll(".hero, .closing");
  const visible = new Set();
  const set = (shown) => {
    pill.classList.toggle("is-shown", shown);
    pill.tabIndex = shown ? 0 : -1;
    pill.setAttribute("aria-hidden", String(!shown));
  };
  if (!blockers.length || !("IntersectionObserver" in window)) return set(true);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    set(visible.size === 0);
  }, { threshold: 0.12 });
  blockers.forEach((el) => io.observe(el));
}
