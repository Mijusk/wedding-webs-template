// Fotos de las pruebas compartidas (api/compartir.js): dónde están y su borrado a los 30 días.
import { rpc, storage } from "./supabase.js";

export const BUCKET = "prueba-fotos";
export const MAX_PHOTOS = 6;
export const photoPath = (id, n) => `${id}/${n}.jpg`;

// Lo llama api/cron.js cada mañana: borra las fotos de las pruebas compartidas que ya tienen 30 días.
export async function deleteExpiredShares() {
  const due = await rpc("api_shares_expired", { p_limit: 300 });
  if (!due?.length) return { caducadas: 0, borradas: 0 };
  const prefixes = due.flatMap((s) => Array.from({ length: s.photos }, (_, i) => photoPath(s.id, i)));
  // La API borra hasta 1000 rutas por llamada (aquí, como mucho 300 × 6 = 1800: en dos).
  for (let i = 0; i < prefixes.length; i += 900) {
    await storage(`/object/${BUCKET}`, { method: "DELETE", body: { prefixes: prefixes.slice(i, i + 900) } });
  }
  const borradas = await rpc("api_shares_deleted", { p_ids: due.map((s) => s.id) });
  return { caducadas: due.length, borradas };
}
