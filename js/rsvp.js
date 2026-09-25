import { saveRsvp } from "./storage.js";
import { dateParts, esc, fill } from "./format.js";

// Formulario de confirmación en un <dialog>. Lo abre cualquier [data-rsvp-open]:
// el botón flotante (visible entre la portada y el cierre) y el del cierre.
export function mountRsvp(root, config) {
  const { rsvp = {}, locale, copy = {} } = config;
  const t = copy.rsvp || {};
  const deadline = rsvp.deadline ? dateParts(rsvp.deadline, locale).dayMonth : "";

  root.innerHTML = `
    <button class="button rsvp-pill" type="button" data-rsvp-open aria-haspopup="dialog" tabindex="-1" aria-hidden="true">${esc(rsvp.buttonLabel)}</button>
    <dialog class="rsvp-dialog" id="rsvp-dialog" aria-labelledby="rsvp-title">
      <div class="rsvp-dialog__inner">
        <button class="rsvp-close" type="button" id="rsvp-close" aria-label="${esc(t.close)}">×</button>
        <p class="eyebrow">${esc(t.eyebrow)}</p>
        <h2 class="rsvp-title" id="rsvp-title">${esc(t.title)}</h2>
        ${deadline && t.deadlineNote ? `<p class="rsvp-note">${fill(t.deadlineNote, { deadline })}</p>` : ""}
        <form class="rsvp-form" id="rsvp-form" novalidate>
          <div class="field">
            <label for="rsvp-name">${esc(t.name)}</label>
            <input type="text" id="rsvp-name" name="name" autocomplete="name" required>
          </div>
          <fieldset class="field">
            <legend>${esc(t.attending)}</legend>
            <div class="choice">
              <label><input type="radio" id="rsvp-yes" name="attending" value="si"><span>${esc(t.yes)}</span></label>
              <label><input type="radio" id="rsvp-no" name="attending" value="no"><span>${esc(t.no)}</span></label>
            </div>
          </fieldset>
          <div class="field">
            <label for="rsvp-song">${esc(t.song)}</label>
            <input type="text" id="rsvp-song" name="song" placeholder="${esc(t.songPlaceholder)}">
          </div>
          <p class="rsvp-error" id="rsvp-error" role="alert"></p>
          <button class="button" type="submit" id="rsvp-submit">${esc(t.submit)}</button>
        </form>
        <div class="rsvp-thanks" id="rsvp-thanks" hidden></div>
      </div>
    </dialog>`;

  const $ = (id) => root.querySelector(`#${id}`);
  const dialog = $("rsvp-dialog"), form = $("rsvp-form");

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-rsvp-open]")) return;
    dialog.showModal();
    if (!form.hidden) $("rsvp-name").focus();
  });
  $("rsvp-close").addEventListener("click", () => dialog.close());
  // Clic en el fondo oscuro: el contenido ocupa todo el <dialog>, así que solo el backdrop es el propio dialog.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  watchPill(root.querySelector(".rsvp-pill"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const name = (data.name || "").trim();
    const song = (data.song || "").trim();
    const err = $("rsvp-error");
    if (name.length < 2) { err.textContent = t.errorName; return $("rsvp-name").focus(); }
    if (!data.attending) { err.textContent = t.errorAttending; return; }
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
      err.textContent = t.errorNetwork;
      btn.disabled = false; btn.textContent = t.submit;
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
