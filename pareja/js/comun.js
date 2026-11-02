// Utilidades de las pantallas de la pareja.
import { db, siteUrl } from "/panel/js/supa.js";
import { html, waLink, fmtDateLong } from "/panel/js/ui.js";

export const webUrl = (slug) => `${siteUrl()}/b/${slug}`;
export const inviteUrl = (slug, token) => `${siteUrl()}/b/${slug}?i=${encodeURIComponent(token)}`;

// Grupos con sus personas y la respuesta vigente de cada grupo; y las respuestas sin grupo.
export async function loadGuests(weddingId) {
  const [groups, answers] = await Promise.all([
    db.select("guest_groups", { select: "*,guests(*)", wedding_id: `eq.${weddingId}`, order: "sort.asc,name.asc", limit: 3000 }),
    db.select("rsvp_current", { select: "*", wedding_id: `eq.${weddingId}`, order: "created_at.desc", limit: 5000 }),
  ]);
  const byGroup = new Map(answers.filter((a) => a.group_id).map((a) => [a.group_id, a]));
  groups.forEach((g) => {
    g.guests.sort((a, b) => Number(a.is_child) - Number(b.is_child) || a.created_at.localeCompare(b.created_at));
    g.answer = byGroup.get(g.id) || null;
  });
  return { groups, loose: answers.filter((a) => !a.group_id), answers };
}

export const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(" ");

// Personas de una respuesta: con lista, las que vienen; sin lista, adultos + niños.
export function peopleOf(a) {
  if (!a || !a.attending) return 0;
  if (a.adults == null && a.children == null) return 1;
  return (a.adults || 0) + (a.children || 0);
}

export function statusOf(g) {
  if (g.token_revoked_at) return { s: "perdido", label: "Enlace anulado" };
  if (!g.answer) return { s: "borrador", label: "Sin contestar" };
  if (!g.answer.attending) return { s: "perdido", label: "No vienen" };
  return { s: "ganado", label: `Vienen ${peopleOf(g.answer)} de ${Math.max(g.seats, g.guests.length)}` };
}

export function inviteMessage(data, g) {
  const [a, b] = data.wedding.couple || [];
  const date = data.wedding.wedding_date ? ` el ${fmtDateLong(data.wedding.wedding_date)}` : "";
  return `¡Hola, ${g.name}! Nos casamos${date} y queremos que estéis. Aquí tenéis toda la información y podéis confirmar asistencia: ${inviteUrl(data.wedding.slug, g.token)}\n\n${[a, b].filter(Boolean).join(" y ")}`;
}

export function reminderMessage(data, g) {
  const [a, b] = data.wedding.couple || [];
  return `¡Hola, ${g.name}! ¿Nos decís si podréis venir a la boda? Es un momento: ${inviteUrl(data.wedding.slug, g.token)}\n\n${[a, b].filter(Boolean).join(" y ")}`;
}

export const whatsapp = (phone, text) => waLink(phone, text) || `https://wa.me/?text=${encodeURIComponent(text)}`;

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export const noModule = (data) => html`<div class="notice">
  La lista de invitados con enlaces personales, acompañantes, alergias y autobús no está incluida en vuestro plan.
  ${data.contacto?.email || data.contacto?.telefono ? "Si os interesa, escribid a WeddingWebs." : ""}</div>`;
