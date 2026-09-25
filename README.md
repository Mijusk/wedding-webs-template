# Wedding Webs · template

Web de boda configurable desde un único `config.json`. HTML, CSS y JS sin framework ni paso de build.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

(Hace falta un servidor: `fetch("config.json")` no funciona abriendo el archivo directamente.)

## La idea: la página atardece

La historia se cuenta como el propio día de la boda. La portada es la foto de la pareja; debajo, la página empieza con luz de tarde y, al bajar por el programa, cada hora tiñe la página con su tono: tarde (`day`), atardecer (`dusk`), hora azul (`blue`) y noche (`night`). El regalo y el cierre ya ocurren de noche, y la página termina con los nombres de la pareja a todo el ancho.

El tono de cada hora se calcula a partir de `schedule[].time` (`js/tone.js`). Si el atardecer de esa fecha no cuadra, un elemento del programa puede forzar su tono con `"tone": "dusk"`. Los colores de cada tono están en `css/theme.css`.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `config.json` | Todo lo variable: pareja, fechas, foto, lugar, historia, programa, IBAN, RSVP, textos (`copy`) y secciones visibles |
| `css/theme.css` | Colores de cada hora y tipografías (lo único de estilo que debería cambiar por cliente) |
| `css/base.css` | Retícula, tipografía base, enlaces, botones y entradas al hacer scroll |
| `css/sections.css` | Maquetación de cada sección |
| `css/rsvp.css` | Botón flotante y formulario |
| `js/main.js` | Carga el config, pinta las secciones de `config.sections` y arranca los comportamientos |
| `js/sections/*.js` | Una sección por archivo: `hero`, `story`, `details`, `schedule`, `gifts`, `closing` |
| `js/tone.js` | Cambio de tono de la página según la hora de la sección visible |
| `js/reveal.js` | Entradas suaves de lo que queda por debajo de la primera pantalla |
| `js/hero-shape.js` | Si la foto de portada es vertical, en escritorio la coloca a la izquierda en vez de recortarla |
| `js/fit.js` | Ajusta la firma final al ancho de la pantalla |
| `js/copy.js` | Botón de copiar IBAN |
| `js/calendar.js` | Enlace "Añadir al calendario" (Google Calendar) |
| `js/rsvp.js` | Formulario de confirmación en un `<dialog>` (hoja inferior en móvil) |
| `js/storage.js` | Guardado del RSVP: Google Sheets si hay `rsvp.endpoint`, si no, simulado en localStorage |
| `integrations/google-sheets.gs` | Apps Script que recibe las respuestas en la hoja de la pareja |

## Nueva boda

1. Rama nueva desde `main`.
2. Edita `config.json` (datos y textos), `css/theme.css` si cambia la paleta, y cambia la foto en `assets/`. `event.photoFocus` decide qué parte de la foto se ve en móvil. La portada acepta fotos horizontales o verticales.
3. Para guardar respuestas en Sheets: pega `integrations/google-sheets.gs` en la hoja (Extensiones > Apps Script), despliega como aplicación web con acceso "Cualquiera" y pon la URL en `rsvp.endpoint`.

La historia va en `story.chapters`: cada capítulo tiene `meta` (una etiqueta corta: lugar, año...), `text` y, si se quiere, `photo`, `photoAlt` y `photoFocus`. Las fotos alternan de lado.

Los textos admiten huecos entre llaves que se rellenan solos: `{days}` en la cuenta atrás, `{deadline}` con la fecha límite del RSVP, `{date}` y `{city}` en el cierre, `{a}` y `{b}` con los nombres en el título del calendario, y `{name}` y `{song}` en el agradecimiento del RSVP.

## Añadir una sección

Crea `js/sections/<nombre>.js` exportando una función `(config) => html`, regístrala en `SECTIONS` dentro de `js/main.js` y añade su nombre a `config.sections`. Pon sus textos en `config.copy.<nombre>`. Si quieres que marque la hora de la página, dale `data-tone`; si quieres que entre al hacer scroll, dale la clase `reveal`.

La fecha y la hora se muestran tal cual están en el config (hora local del lugar), sin convertir a la zona horaria del invitado.
