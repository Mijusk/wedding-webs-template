import { saveRsvp } from "./storage.js";
import { esc } from "./format.js";

export function mountRsvp(root, config) {
  const { rsvp = {}, event } = config;
  const deadline = rsvp.deadline
    ? new Date(rsvp.deadline).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
    : null;

  root.innerHTML = `
    <button class="rsvp-fab" id="rsvp-open" aria-expanded="false" aria-controls="rsvp-panel">${esc(rsvp.buttonLabel || "Confirmar asistencia")}</button>
    <div class="rsvp-panel" id="rsvp-panel" role="dialog" aria-labelledby="rsvp-title" hidden>
      <button class="close" id="rsvp-close" aria-label="Cerrar">×</button>
      <p class="eyebrow">RSVP</p>
      <h2 id="rsvp-title">¿Vienes?</h2>
      ${deadline ? `<p class="note">Confírmanos antes del ${esc(deadline)}.</p>` : ""}
      <form id="rsvp-form" novalidate>
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const name = (data.name || "").trim();
    const err = $("rsvp-error");
    if (name.length < 2) { err.textContent = "Escribe tu nombre para saber quién eres."; return $("rsvp-name").focus(); }
    if (!data.attending) { err.textContent = "Marca si vienes o no."; return; }
    err.textContent = "";

    const btn = $("rsvp-submit");
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      await saveRsvp({ name, attending: data.attending, song: (data.song || "").trim() }, rsvp);
      form.hidden = true;
      const thanks = $("rsvp-thanks");
      thanks.innerHTML = data.attending === "si"
        ? `<h2>¡Gracias, ${esc(name.split(" ")[0])}!</h2><p>Te esperamos. ${data.song ? `Tomamos nota de «${esc(data.song)}».` : ""}</p>`
        : `<h2>Te echaremos de menos</h2><p>Gracias por avisarnos, ${esc(name.split(" ")[0])}.</p>`;
      thanks.hidden = false;
    } catch {
      err.textContent = "No se pudo enviar. Revisa tu conexión y vuelve a intentarlo.";
      btn.disabled = false; btn.textContent = "Enviar respuesta";
    }
  });
}
