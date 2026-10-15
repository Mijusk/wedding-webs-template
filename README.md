# Wedding Webs · template

Web de boda configurable desde un único `config.json`. HTML, CSS y JS sin framework ni paso de build.

## Probar en local

```bash
npx serve .          # o: python3 -m http.server 8000
# plantilla: http://localhost:3000/   escaparate: http://localhost:3000/studio/
```

No hay `npm run dev`: no hay paso de build.

(Hace falta un servidor: `fetch("config.json")` no funciona abriendo el archivo directamente.)

## Estructura

| Ruta | Qué es |
| --- | --- |
| `config.json` | Datos de la boda: pareja, fecha, lugar, programa, RSVP y secciones visibles |
| `css/theme.css` | Colores y tipografías (lo único de estilo que debería cambiar por cliente) |
| `css/base.css`, `css/rsvp.css` | Maquetación y formulario |
| `js/main.js` | Carga el config y pinta las secciones de `config.sections` |
| `js/sections/*.js` | Una sección por archivo (hero, detalles, programa) |
| `js/rsvp.js` | Formulario flotante de confirmación |
| `js/storage.js` | Guardado del RSVP: Google Sheets si hay `rsvp.endpoint`, si no, simulado en localStorage |
| `css/themes/*.css` | Estilos alternativos (`config.theme`): sobrescriben los tokens de `theme.css` |
| `studio/` | Escaparate comercial con el generador de vista previa (ver abajo) |
| `plantillas/editorial/` | Segunda plantilla (portada a pantalla completa, historia en capítulos, la página atardece). Autocontenida |
| `plantillas/minimal/` | Minimalista: blanco y negro, nombres enormes, secciones numeradas con líneas finas, fotos en gris. Autocontenida |
| `plantillas/verbena/` | Exagerada: fiesta de pueblo con banderines, pegatinas, cinta que corre, cuenta atrás grande y fotos tipo polaroid. Autocontenida |
| `plantillas/postal/` | Sencilla: una sola tarjeta de invitación de papel con todo lo esencial, más el regalo. Autocontenida |
| `integrations/leads.gs` | Apps Script para los contactos del escaparate: guarda pruebas y reservas en una hoja y te avisa por email |
| `integrations/google-sheets.gs` | Apps Script que recibe las respuestas en la hoja de la pareja |
| `fonts/`, `plantillas/*/fonts/`, `studio/fonts/` | Fuentes alojadas en la propia web (sin conectar con Google, por privacidad) |
| `studio/legal.html` | Aviso legal, privacidad y condiciones. Los datos del titular y los plazos salen de `studio.json > legal` |
| `vercel.json`, `_headers` | Cabeceras para Vercel y Netlify: ninguna otra web puede incrustar estas páginas |

## Nueva boda

1. Rama nueva desde `main`.
2. Edita `config.json`, `css/theme.css` y cambia la foto en `assets/`.
3. Para guardar respuestas en Sheets: pega `integrations/google-sheets.gs` en la hoja (Extensiones > Apps Script), despliega como aplicación web con acceso "Cualquiera" y pon la URL en `rsvp.endpoint`.
4. Cambia a mano las etiquetas `og:` de `index.html` (título, texto y la URL completa de la foto): son la tarjeta que sale al compartir el enlace por WhatsApp, que no ejecuta JavaScript.

Guarda la fecha con su zona horaria (`2027-06-12T18:00:00+02:00`): sin ella, "Añadir al calendario" y la cuenta atrás usan la zona del invitado.

### Qué hace la web sola según la fecha

- Hasta `rsvp.deadline` (incluido): formulario abierto.
- Pasada la fecha límite: el formulario se cierra y sale `rsvp.closedText` (Clásica) o `copy.rsvp.closedText` (el resto).
- El día de la boda: "Es hoy". Después: sin cuenta atrás ni botón de confirmar.
- Si la hoja no confirma que ha guardado la respuesta, el invitado ve un error y puede reintentar (nunca un "gracias" falso). Si alguien contesta dos veces con el mismo nombre, vale la última respuesta.

## Añadir una sección

Crea `js/sections/<nombre>.js` exportando una función `(config) => html`, regístrala en `SECTIONS` dentro de `js/main.js` y añade su nombre a `config.sections`.

La fecha y la hora se muestran tal cual están en el config (hora local del lugar), sin convertir a la zona horaria del invitado.

## Escaparate y generador (`studio/`)

`http://localhost:8000/studio/` es la web comercial: estilos con ejemplos en vivo, un formulario mínimo que genera la web de la pareja con su nombre, fecha, lugar y fotos, tarifas y formulario de reserva.

- Entrada: la primera vez en cada visita sale una cortina oscura con el monograma de las dos W dibujándose y un contador; la cortina sube y la portada aparece por capas (titular palabra a palabra, fotos que se abren alrededor de la web de ejemplo). Las fotos se mueven un poco con el ratón y al bajar, y cada bloque aparece al llegar a él. Código en `studio/app/entrance.js` y `studio/entrance.css`; sin animaciones si el sistema pide reducir movimiento.
- Tras cambiar `integrations/leads.gs` o `google-sheets.gs`, vuelve a desplegar en Apps Script: Implementar > Gestionar implementaciones > editar > Versión nueva (la URL no cambia).
- `studio/studio.json` manda: marca, estilos del selector (`status: "available"` o `"soon"`), tiempos de la carga, tarifas y `contact.endpoint` (Apps Script para guardar reservas; vacío = simulado en el navegador).
- La plantilla se pinta en un iframe con `index.html#preview`: en ese modo no lee `config.json`, lo recibe del escaparate por `postMessage`. Cambiar de estilo es reenviar el config con otro `theme`, sin recargar.
- Las fotos se reducen en el navegador y no se suben a ningún sitio.
- Un estilo nuevo con la misma maquetación = un archivo en `css/themes/` y una entrada en `styles`. Una maquetación nueva = otra carpeta en `plantillas/` con su `index.html` que entienda el modo `#preview`, una entrada en `templates` y, si usa campos propios, su línea en `studio/app/wedding.js` (que traduce los datos del formulario al config de cada plantilla).
