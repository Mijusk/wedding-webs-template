# Mejoras

Registro del trabajo autónomo de mejora. Rama: `mejoras/auto-2026-11-25`, que sale de `origin/main` (cc1b6d6). Commits locales, sin push.

## Punto de partida y estado final (2026-11-25)

| Comprobación | Al empezar | Al acabar |
| --- | --- | --- |
| `npm test` en una copia limpia | 48 tests pasan | 64 tests pasan |
| `npm test` en una copia limpia con finales de línea de Windows | Falla «instalar.sql está al día» | Pasa |
| `npm test` en la carpeta de Luis | Falla «instalar.sql está al día» | Sigue fallando, solo por «Pendiente de Luis», punto 1 |
| 45 plantillas con los datos mínimos del esquema | Falla Clásica | Las 45 bien |
| 45 plantillas con nombres largos en 320, 360 y 390 px | 5 desbordes (Minimalista, Terciopelo, Costa) | 0 |
| RSVP ampliado en Clásica | No funcionaba | Funciona |
| 18 comprobaciones de los paneles en navegador | 13 de las 15 primeras fallaban | 18 de 18 bien |
| Barra de arriba del escaparate en 320, 360 y 375 px | Botón cortado, la página se desplaza de lado | Bien |
| Peso (móvil) | Escaparate 1,3 MB, plantillas 0,8 MB de media, panel 0,13 MB | Igual: no hacía falta tocarlo |
| Build, lint, typecheck | No existen | No existen |
| `test:api`, `test:db`, `test:e2e` | No ejecutados | No ejecutados: necesitan un Supabase local con Docker (parado, y el PC va justo de memoria) |

## Hecho

Cada línea es un commit. «Navegador» quiere decir Chromium con Supabase y emails simulados: no sale nada del equipo.

### Lo que nota una pareja que llega al escaparate
- **Los dos campos de nombres de la portada medían 8 px en el móvil** (desde el 18/11): no se veían ni se podía escribir. Navegador, 360 px (`c5f1220`).
- El botón «Probar con vuestra boda» salía cortado en móviles de 375 px o menos. Navegador, 5 anchos (`ac5a630`).
- Si la vista previa no cargaba, se quedaba en la portada sin decir nada. Ahora avisa a los 20 s y se puede reintentar. Navegador, cortando la carga, antes y después (`4b53c26`).

### Lo que nota una pareja cliente
- Un corte de red, o tener dos pestañas, cerraba la sesión (y su enlace sirve una sola vez). Navegador y 5 tests (`08fe53b`, `d52cacc`).
- Una respuesta nueva borraba lo que estuvieran escribiendo en «Datos». Navegador (`44c656f`).
- Teclear una hora la cambiaba por otra (09:15 acababa en 00:00). Navegador, también en el panel de Luis (`e94325c`).
- Corregir una errata borraba al invitado y su respuesta. Navegador (`3cdfe0c`). El catering y las respuestas enseñan el nombre corregido (`7699537`).
- Dos personas del mismo grupo se tapaban al unirse solas. Test (`56882bd`).
- El Excel guardado como CSV en Windows perdía tildes y eñes. Navegador y test (`53863e5`).
- En el seguimiento, si fallaba aprobar o pedir el enlace, el botón se quedaba bloqueado sin aviso. Navegador (`d7fa9ad`).

### Lo que nota un invitado
- **Clásica (Olivar, Atardecer y Noche) no tenía RSVP ampliado**: el enlace personal se ignoraba y no se preguntaba por acompañantes, alergias ni autobús. Navegador, en los tres modos (`7bb9c70`).
- Clásica escribía «undefined» si faltaba un dato (`84d5da3`). Nombres largos en Minimalista, Terciopelo y Costa (`9a703d2`). Navegador.

### Lo que nota Luis
- Ctrl+S podía guardar una versión vieja, y marcar un cambio como hecho perdía lo que estuviera a medias. Navegador (`fef0968`).
- Borrar una foto en el editor la rompía al momento en la web publicada y en las propuestas. Navegador (`be623a0`).
- Los datos de facturación a medias se perdían al tocar un pedido. Navegador (`0b00e59`).
- Un precio de tarifa vacío se guardaba como 0 € (`7abcff4`). Un pago a mano sin fecha daba un error raro (`700b256`). Solo lectura del código.
- «Más» abría dos menús y «Revisar ahora» no avisaba si fallaba (`daf9f45`). El primero, navegador; el segundo, lectura.
- Contraste, etiquetas y textos largos en móvil. Navegador, 21 pantallas en 2 tamaños (`f0c5166`, `3bfbbfd`).

### Servidor, seguridad y pruebas
- Si fallaba un email del aviso diario, no se hacían las tareas ni el borrado de datos; el email de devolución decía «null»; un 429 de Resend daba el email por perdido; una cookie rara hacía decir «no guardado». 9 tests (`200c817`).
- MEJORAS.md no se publica y hay `X-Content-Type-Options: nosniff`. Servidor local (`2d0d20f`).
- `npm test` funciona con finales de línea de Windows (`68fa3a1`). DECISIONES al día (`5da2fb4`).
- Revisado y bien: permisos de las 55 funciones públicas de la base y RLS (análisis del SQL), claves en el repositorio (ninguna), inyección de HTML en las 45 plantillas.

## Backlog: cuando se unan los PR abiertos

| Qué | Dónde | Por qué espera |
| --- | --- | --- |
| En la ficha de un lead, los rechazos de cookies salen como «Aceptó» (no se mira `granted`) | `panel/js/views/lead.js`, sección Consentimiento | Lo toca el PR #14 |
| Si falla guardar un grupo de invitados, se pierde lo escrito (el diálogo ya se ha cerrado) | `panel/js/ui.js` (`formDialog`) | Lo toca el PR #14 |
| La rama del PR #11 tiene un conflicto con `main` en `studio/app/main.js` | PR #11 | No es de esta rama |
| INVENTARIO aún dice que la Clásica no se pinta | `docs/INVENTARIO.md` | Lo toca el PR #15 |

## Decisiones tomadas

- **No se tocan los archivos de los PR abiertos** (#11, #12, #14 y #15), salvo líneas sueltas de `studio/studio.css` y `api/cron.js` lejos de las suyas. Comprobado con `git merge-tree`: esta rama no añade ningún conflicto con ellos.
- **Ningún cambio de base de datos.** Lo que lo necesita está en «Pendiente de Luis».
- **Fotos borradas que aún usa una versión o una propuesta:** se quitan del editor, pero el archivo se guarda hasta borrar la boda (pasa a `kind = 'otro'`).
- **Cambiar el nombre en la fila de un invitado conserva su respuesta.** Si se quiere poner a otra persona, hay que quitar la fila y añadir otra.
- **Dos personas del mismo grupo por el enlace general:** no se une ninguna sola; se sugieren las dos.
- **Emails:** solo se reintenta si Resend responde 429, porque entonces seguro que no ha salido. Con otros errores podría llegar dos veces.
- **Aviso diario:** los emails paran a los 35 s; lo que falte sale al día siguiente.
- **En móviles de 400 px o menos** la marca de arriba se queda en «WeddingWebs», sin «studio».

## Pendiente de Luis

1. **El archivo `supabase/migrations/20261112000100_cookies.sql` de tu carpeta está estropeado.** Tiene pegado, sin querer, un informe de otro proyecto (habla de `UpdateRequired.vue`). En git está bien. **No lo pegues en Supabase.** Para recuperarlo: `git checkout -- supabase/migrations/20261112000100_cookies.sql`.
2. **Subir y unir esta rama.** Los fallos de la portada en móvil están en `main`, así que es fácil que estén costando contactos.
3. **Migración: la pareja no puede quitar su IBAN ni el enlace del mapa.** `app.couple_patch` conserva el valor anterior cuando llega vacío. Hoy solo puede ocultar la sección de regalo.
4. **Decidir: dos invitados con el mismo nombre y apellidos** que contestan por el enlace general cuentan como uno (vale la última respuesta). Cambiarlo necesita una migración.
5. **Pasar `test:db`, `test:api` y `test:e2e`** en un entorno con Docker antes de publicar.
