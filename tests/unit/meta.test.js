// API de conversiones de Meta: qué se manda y, sobre todo, cuándo NO se manda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildMetaEvent, normalizePhone, normalizeEmail, adsConsented } from "../../api/_lib/meta.js";
import { creditFooter } from "../../api/_lib/render.js";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const yes = { choices: { publicidad: true, analitica: false }, text: "…" };
const base = { kind: "lead", eventId: "3f1c2a9e-1111-4222-8333-944455556666", ip: "1.2.3.4", userAgent: "UA", siteOrigin: "https://www.weddingwebstudio.es", now: 1_800_000_000_000 };

test("sin permiso de publicidad no sale nada hacia Meta", () => {
  assert.equal(buildMetaEvent({ ...base, payload: { email: "a@b.es" } }), null);
  assert.equal(buildMetaEvent({ ...base, payload: { email: "a@b.es", cookieConsent: { choices: { publicidad: false } } } }), null);
  assert.equal(buildMetaEvent({ ...base, payload: { email: "a@b.es", cookieConsent: { granted: false } } }), null);
  assert.equal(adsConsented({ granted: true }), true); // aviso v1
});

test("lead: email y teléfono cifrados, mismo eventID que el píxel, sin nombres", () => {
  const ev = buildMetaEvent({ ...base, cookies: "_fbp=fb.1.1.123; otra=1", payload: {
    email: "  Lucia@Ejemplo.ES ", phone: "612 345 678", nameA: "Lucía", style: "villa", page: "/studio/", cookieConsent: yes,
  } });
  assert.equal(ev.event_name, "Lead");
  assert.equal(ev.event_id, base.eventId);
  assert.equal(ev.action_source, "website");
  assert.equal(ev.event_source_url, "https://www.weddingwebstudio.es/studio/");
  assert.deepEqual(ev.user_data.em, [sha("lucia@ejemplo.es")]);
  assert.deepEqual(ev.user_data.ph, [sha("34612345678")]);
  assert.equal(ev.user_data.fbp, "fb.1.1.123");
  assert.equal(ev.custom_data.content_name, "villa");
  assert.doesNotMatch(JSON.stringify(ev), /Luc[ií]a/);
});

test("reserva lleva el valor; fbc se rehace con el fbclid del anuncio", () => {
  const ev = buildMetaEvent({ ...base, kind: "reserva", value: 139, payload: {
    email: "a@b.es", tier: "con-cambios", cookieConsent: yes, attribution: { first: { fbclid: "AbC123" } },
  } });
  assert.equal(ev.event_name, "SubmitApplication");
  assert.deepEqual([ev.custom_data.value, ev.custom_data.currency], [139, "EUR"]);
  assert.equal(ev.user_data.fbc, "fb.1.1800000000000.AbC123");
});

test("normalización de teléfonos y emails", () => {
  assert.equal(normalizePhone("+34 612 34 56 78"), "34612345678");
  assert.equal(normalizePhone("0033 6 12 34 56 78"), "33612345678");
  assert.equal(normalizePhone("912345678"), "34912345678");
  assert.equal(normalizePhone("12"), "");
  assert.equal(normalizeEmail("no-es-un-email"), "");
});

test("eventID raro no se manda; pagina externa no se cuela", () => {
  const ev = buildMetaEvent({ ...base, eventId: "<script>", payload: { email: "a@b.es", page: "https://otra.web/x", cookieConsent: yes } });
  assert.equal(ev.event_id, undefined);
  assert.equal(ev.event_source_url, "https://www.weddingwebstudio.es/studio/");
});

test("pie de las webs: enlace al escaparate con la UTM de la boda", () => {
  const html = creditFooter("https://www.weddingwebstudio.es", "lucia-y-martin");
  assert.match(html, /href="https:\/\/www\.weddingwebstudio\.es\/studio\/\?utm_source=web-boda&amp;utm_medium=referral&amp;utm_campaign=lucia-y-martin"/);
  assert.match(html, /Web hecha con/);
});
