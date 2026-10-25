// RSVP ampliado (módulo opcional del plan). Lo carga el rsvp.js de cada plantilla solo cuando el
// servidor activa config.rsvp.extended; si no, la plantilla sigue con su formulario sencillo.
// Usa las mismas clases que el formulario de siempre (.field, .choice, .rsvp-note), así cada
// plantilla lo pinta con su propio estilo.
//
// config.rsvp.extended = {
//   invite: { token, name, seats, children_seats, guests: [{ id, name, child }], answer } | null,
//   inviteInvalid, bus, dietary
// }

const CSS = `
.rsvp-form [hidden] { display: none !important; }
.rsvp-form .choice.choice--n { grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
.rsvp-form .choice.choice--n label { padding: 10px 2px; }
.rsvp-guests { display: grid; gap: 18px; }
.rsvp-guest { display: grid; gap: 8px; }
.rsvp-guest__name { font-size: 16px; }
.rsvp-guest__name small { opacity: .7; }
`;

export function enhance(form, config, { esc, fill, dateParts }) {
  const ext = config.rsvp.extended || {};
  const t = { ...DEFAULTS, ...(config.copy?.rsvp || {}) };
  const inv = ext.invite;
  const guests = inv?.guests || [];
  const mode = inv ? (guests.length ? "lista" : "plazas") : "general";
  const plural = mode !== "general";
  const ans = inv?.answer || null;

  if (!document.getElementById("rsvp-ampliado-css")) {
    document.head.append(Object.assign(document.createElement("style"), { id: "rsvp-ampliado-css", textContent: CSS }));
  }

  // Saludo personal encima del formulario.
  const note = document.createElement("p");
  note.className = "rsvp-note rsvp-greeting";
  if (inv) {
    const answered = ans?.at ? ` ${fill(t.alreadyAnswered, { date: dateParts(ans.at.slice(0, 10), config.locale).dayMonth })}` : "";
    note.innerHTML = `${fill(mode === "lista" ? t.helloList : t.helloSeats, { name: inv.name, seats: inv.seats })}${answered}`;
  } else if (ext.inviteInvalid) {
    note.textContent = t.inviteInvalid;
  }
  if (note.innerHTML) form.before(note);

  const radio = (name, value, text, checked) =>
    `<label><input type="radio" name="${name}" value="${esc(value)}"${checked ? " checked" : ""}><span>${esc(text)}</span></label>`;
  const numbers = (name, from, to, selected) => {
    const n = to - from + 1;
    if (n > 9) return `<input type="text" name="${name}" inputmode="numeric" pattern="[0-9]*" value="${selected ?? ""}" autocomplete="off">`;
    return `<div class="choice choice--n" style="--n:${n}">${Array.from({ length: n }, (_, i) => radio(name, from + i, String(from + i), selected === from + i)).join("")}</div>`;
  };
  const yes = ans?.attending === true, no = ans?.attending === false;
  const guestAnswer = (id) => (ans?.guests || []).find((g) => g.id === id);

  let html = "";
  if (mode === "general") {
    html += `<div class="field"><label for="rsvp-name">${esc(t.name)}</label><input type="text" id="rsvp-name" name="name" autocomplete="name" required></div>`;
  }
  if (mode === "lista") {
    html += `<fieldset class="field"><legend>${esc(t.whoComes)}</legend><div class="rsvp-guests">${guests.map((g) => {
      const a = guestAnswer(g.id);
      return `<div class="rsvp-guest" role="group" aria-label="${esc(g.name)}">
        <span class="rsvp-guest__name">${esc(g.name)}${g.child ? ` <small>${esc(t.child)}</small>` : ""}</span>
        <div class="choice">${radio(`g-${g.id}`, "si", t.guestYes, a?.attending === true)}${radio(`g-${g.id}`, "no", t.guestNo, a && a.attending === false)}</div>
      </div>`;
    }).join("")}</div></fieldset>`;
  } else {
    html += `<fieldset class="field"><legend>${esc(t.attending)}</legend><div class="choice">
      ${radio("attending", "si", plural ? t.yesPlural : t.yes, yes)}${radio("attending", "no", plural ? t.noPlural : t.no, no)}</div></fieldset>`;
    const max = mode === "plazas" ? inv.seats : 6;
    html += `<fieldset class="field" data-if-yes><legend>${esc(mode === "plazas" ? t.howManyAdults : t.howManyYou)}</legend>
      ${numbers("adults", mode === "plazas" ? 0 : 1, max, ans ? ans.adults : mode === "plazas" ? null : 1)}</fieldset>`;
    if (mode === "general" || inv.children_seats > 0) {
      html += `<fieldset class="field" data-if-yes><legend>${esc(t.howManyChildren)}</legend>
        ${numbers("children", 0, mode === "plazas" ? Math.min(inv.seats, Math.max(inv.children_seats, 1)) : 4, ans ? ans.children ?? 0 : 0)}</fieldset>`;
    }
  }
  const someone = (guests.find((g) => g.child) || guests[0])?.name.split(" ")[0];
  const dietaryHint = someone ? fill(t.dietaryPlaceholderNamed, { name: someone }) : plural ? t.dietaryPlaceholderPlural : t.dietaryPlaceholder;
  if (ext.dietary !== false) {
    html += `<div class="field" data-if-yes><label for="rsvp-dietary">${esc(t.dietary)}</label>
      <input type="text" id="rsvp-dietary" name="dietary" maxlength="500" placeholder="${esc(dietaryHint)}" value="${esc(ans?.dietary || "")}"></div>`;
  }
  if (ext.bus) {
    html += `<fieldset class="field" data-if-yes><legend>${esc(plural ? t.busPlural : t.bus)}</legend><div class="choice">
      ${radio("bus", "si", t.busYes, ans?.bus === true)}${radio("bus", "no", t.busNo, ans?.bus === false)}</div></fieldset>`;
  }
  html += `<div class="field" data-if-yes><label for="rsvp-song">${esc(t.song)}</label>
    <input type="text" id="rsvp-song" name="song" maxlength="300" placeholder="${esc(t.songPlaceholder)}" value="${esc(ans?.song || "")}"></div>`;
  html += `<div class="field"><label for="rsvp-message">${esc(t.message)}</label>
    <input type="text" id="rsvp-message" name="message" maxlength="1000" placeholder="${esc(t.messagePlaceholder)}" value="${esc(ans?.message || "")}"></div>`;

  form.querySelectorAll(":scope > .field").forEach((f) => f.remove());
  form.querySelector("#rsvp-error").insertAdjacentHTML("beforebegin", html);

  // Lo que solo tiene sentido si vienen se esconde al marcar que no.
  const comes = () => {
    if (mode === "lista") return guests.some((g) => form.elements[`g-${g.id}`]?.value === "si");
    return form.elements.attending?.value === "si";
  };
  const sync = () => {
    const show = mode === "lista" ? comes() || !guests.every((g) => form.elements[`g-${g.id}`]?.value) : form.elements.attending?.value !== "no";
    form.querySelectorAll("[data-if-yes]").forEach((el) => { el.hidden = !show; });
  };
  form.addEventListener("change", sync);
  sync();

  const num = (name) => {
    const v = form.elements[name]?.value;
    return v === undefined || v === "" ? null : Number(v);
  };

  return {
    collect() {
      const v = (name) => String(form.elements[name]?.value ?? "").trim();
      const entry = { dietary: v("dietary"), bus: v("bus"), song: v("song"), message: v("message") };
      if (inv) entry.invite = inv.token;
      if (mode === "lista") {
        const missing = guests.find((g) => !form.elements[`g-${g.id}`]?.value);
        if (missing) return { error: t.errorEachGuest, focus: form.querySelector(`[name="g-${missing.id}"]`) };
        entry.guests = guests.map((g) => ({ id: g.id, attending: form.elements[`g-${g.id}`].value === "si" }));
        entry.attending = entry.guests.some((g) => g.attending) ? "si" : "no";
        entry.name = inv.name;
        const c = entry.guests.filter((g) => g.attending);
        entry.count = c.length;
        return { entry };
      }
      if (mode === "general") {
        entry.name = v("name");
        if (entry.name.length < 2) return { error: t.errorName, focus: form.elements.name };
      } else entry.name = inv.name;
      entry.attending = form.elements.attending?.value || "";
      if (!entry.attending) return { error: t.errorAttending };
      if (entry.attending === "si") {
        entry.adults = num("adults") ?? (mode === "general" ? 1 : 0);
        entry.children = num("children") ?? 0;
        if (!Number.isInteger(entry.adults) || !Number.isInteger(entry.children) || entry.adults < 0 || entry.children < 0) return { error: t.errorNumber };
        if (entry.adults + entry.children === 0) return { error: t.errorNobody };
        if (mode === "plazas" && entry.adults + entry.children > inv.seats) return { error: fill(t.errorSeats, { seats: inv.seats }) };
        entry.count = entry.adults + entry.children;
      }
      return { entry };
    },
    thanks(entry) {
      const first = plural ? entry.name : entry.name.split(" ")[0];
      if (entry.attending !== "si") return `<h3>${fill(plural ? t.thanksNoTitlePlural : t.thanksNoTitle)}</h3><p>${fill(plural ? t.thanksNoPlural : t.thanksNoText, { name: first })}</p>`;
      const people = entry.count > 1 ? fill(t.thanksCount, { n: entry.count }) : "";
      const song = entry.song && t.thanksSong ? ` ${fill(t.thanksSong, { song: entry.song })}` : "";
      return `<h3>${fill(t.thanksYesTitle, { name: first })}</h3><p>${fill(plural || entry.count > 1 ? t.thanksYesPlural : t.thanksYesText)} ${people}${song}</p>`;
    },
  };
}

// Textos por defecto (cada plantilla puede cambiarlos en config.copy.rsvp).
const DEFAULTS = {
  name: "Nombre y apellidos",
  attending: "Asistencia",
  yes: "Sí, allí estaré",
  no: "No podré ir",
  yesPlural: "Sí, allí estaremos",
  noPlural: "No podremos ir",
  helloList: "Hola, {name}. Marcad quién viene.",
  helloSeats: "Hola, {name}. Tenéis {seats} plazas.",
  alreadyAnswered: "Ya nos respondisteis el {date}; si algo cambia, podéis cambiarlo aquí.",
  inviteInvalid: "Este enlace personal ya no es válido, pero podéis confirmar igualmente aquí.",
  whoComes: "¿Quién viene?",
  child: "(niño/a)",
  guestYes: "Viene",
  guestNo: "No viene",
  howManyYou: "¿Cuántos venís, contándote a ti?",
  howManyAdults: "¿Cuántos adultos venís?",
  howManyChildren: "¿Y niños?",
  dietary: "Alergias o intolerancias",
  dietaryPlaceholder: "Opcional",
  dietaryPlaceholderPlural: "Opcional. Decidnos quién y qué",
  dietaryPlaceholderNamed: "Opcional. Por ejemplo: {name}, sin gluten",
  bus: "¿Necesitas autobús?",
  busPlural: "¿Necesitáis autobús?",
  busYes: "Sí",
  busNo: "No",
  song: "Una canción que no puede faltar",
  songPlaceholder: "Opcional",
  message: "Un mensaje para los novios",
  messagePlaceholder: "Opcional",
  errorName: "Escribe tu nombre para saber quién eres.",
  errorAttending: "Marca si venís o no.",
  errorEachGuest: "Marcad si viene o no cada persona.",
  errorNobody: "Si venís, decidnos cuántos sois.",
  errorNumber: "Revisa el número de personas.",
  errorSeats: "Tenéis {seats} plazas como mucho. Si necesitáis más, escribid a los novios.",
  thanksYesTitle: "¡Gracias, {name}!",
  thanksYesText: "Te esperamos.",
  thanksYesPlural: "Os esperamos.",
  thanksCount: "Hemos apuntado a {n} personas.",
  thanksSong: "Tomamos nota de «{song}».",
  thanksNoTitle: "Te echaremos de menos",
  thanksNoTitlePlural: "Os echaremos de menos",
  thanksNoText: "Gracias por avisarnos, {name}.",
  thanksNoPlural: "Gracias por avisarnos.",
};
