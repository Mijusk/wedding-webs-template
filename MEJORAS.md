# Mejoras

Registro del trabajo autónomo de mejora. Rama: `mejoras/auto-2026-11-25`, que sale de `origin/main` (cc1b6d6). Commits locales, sin push.

## Punto de partida (2026-11-25)

| Comprobación | Resultado |
| --- | --- |
| `npm test` en una copia limpia de `origin/main` | Pasa: 48 tests, 45 configs válidos, `instalar.sql` al día |
| `npm test` en la carpeta de Luis | Falla solo «instalar.sql está al día» (ver «Pendiente de Luis», punto 1, y la mejora de finales de línea) |
| Sintaxis de todo el JS (`node --check`) | Sin errores |
| Build, lint, typecheck | No existen en el proyecto |
| `test:api`, `test:db`, `test:e2e` | No se pueden ejecutar: necesitan un Supabase local con Docker, que está parado. No hay `.env`, así que nada de esta carpeta apunta a producción |
| 45 plantillas con los datos mínimos que permite el esquema | 44 bien; falla Clásica (escribe «undefined») |
| 15 comprobaciones de los paneles en navegador, con Supabase simulado | 13 fallan (son los errores de abajo) |

## Backlog

Orden: impacto / (esfuerzo + riesgo).

| # | Qué | Dónde | A quién afecta | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Un corte de red cierra la sesión de la pareja, y su enlace de acceso sirve una sola vez | `panel/js/supa.js`, `pareja/js/app.js` | Parejas y Luis | Reproducido | Pendiente |
| 2 | Con dos pestañas, la segunda reutiliza la clave de refresco ya gastada: se cierra la sesión | `panel/js/supa.js` | Parejas y Luis | Reproducido | Pendiente |
| 3 | Al llegar una respuesta, «Respuestas» se pinta encima de «Datos» y se pierde lo que estaban escribiendo | `pareja/js/views/respuestas.js` | Parejas | Reproducido | Pendiente |
| 4 | Ctrl+S en el editor de bodas guarda una versión vieja y descarta lo nuevo | `panel/js/views/boda.js` | Luis | Reproducido | Pendiente |
| 5 | Si falla «¡Nos encanta, publicadla!», no sale ningún aviso y el botón se queda bloqueado. «Mandadme el enlace» también | `seguimiento/seguimiento.js` | Parejas | Reproducido | Pendiente |
| 6 | Corregir una errata en un nombre borra al invitado y pierde su respuesta | `pareja/js/views/invitados.js` | Parejas, catering | Reproducido | Pendiente |
| 7 | Dos respuestas del enlace general se unen solas al mismo grupo y una tapa a la otra | `pareja/js/emparejar.js` | Parejas, catering | Lectura del código y de la vista `rsvp_current` | Pendiente |
| 8 | No se puede teclear una hora seguida: pierde el foco y guarda otra | `pareja/js/views/datos.js`, `panel/js/views/boda.js` | Parejas y Luis | Reproducido (09:15 acaba en 00:00) | Pendiente |
| 9 | Un CSV guardado con Excel en Windows pierde tildes y eñes al importarlo | `pareja/js/views/invitados.js` | Parejas | Reproducido | Pendiente |
| 10 | Clásica escribe «undefined» si falta la frase, la foto, el tipo o la dirección | `js/sections/*.js`, `js/format.js` | Invitados | Reproducido | Pendiente |
| 11 | El email de devolución lleva la palabra «null» | `api/_lib/emails.js` | Parejas | `afterRefund` pasa `trackingUrl: null` | Pendiente |
| 12 | Una cookie rara hace que se diga «no guardado» a un contacto que sí se guardó | `api/_lib/meta.js` | Parejas que reservan | Lectura del código | Pendiente |
| 13 | Si falla un email del aviso diario, no se ejecuta el resto (tareas y borrado de datos) | `api/cron.js`, `api/_lib/automatizaciones.js` | Luis, protección de datos | Lectura del código | Pendiente |
| 14 | Si Resend pide ir más despacio (429), el recordatorio se da por fallido y no se reintenta | `api/_lib/avisos.js` | Parejas, invitados | Lectura del código | Pendiente |
| 15 | `npm test` falla en Windows por los finales de línea | `scripts/unir-migraciones.mjs` | Quien programe en este PC | Reproducido | Pendiente |
| 16 | Tras volver a entrar, «Más» abre dos menús en el móvil | `panel/js/app.js` | Luis | Reproducido | Pendiente |

## Hecho

(todavía nada)

## Decisiones tomadas

- **No se tocan los archivos de los PR abiertos** (#11, #12, #14 y #15): escaparate (`studio/index.html`, `studio.css`, `main.js`, `send.js`, `builder.js`, `pricing.js`, `stage.js`, `util.js`), `api/lead.js`, `api/pedido.js`, `panel/js/ui.js`, `panel/js/views/lead.js` y `leads.js`, `api/_lib/render.js`, README e INVENTARIO. Lo que se vea ahí se apunta, para después de unirlos. `api/cron.js` también lo toca el #12.
- **Ningún cambio de base de datos.** Lo que lo necesite va a «Pendiente de Luis».
- **Las pruebas de navegador usan un Supabase simulado**: no sale nada del equipo, no se envían emails y no se toca ningún dato.
- **`supabase/migrations/20261112000100_cookies.sql` y `supabase/.temp/`** tenían cambios sin guardar de antes. No se tocan ni entran en los commits.

## Pendiente de Luis

1. **El archivo `supabase/migrations/20261112000100_cookies.sql` de tu carpeta está estropeado.** Tiene pegado, sin querer, un informe de otro proyecto (habla de `UpdateRequired.vue`). En git está bien; solo está mal tu copia sin guardar. **No lo pegues en Supabase.** Para recuperarlo: `git checkout -- supabase/migrations/20261112000100_cookies.sql`.
