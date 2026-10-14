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
| `integrations/leads.gs` | Apps Script para los contactos del escaparate: guarda pruebas y reservas en una hoja y te avisa por email |
| `integrations/google-sheets.gs` | Apps Script que recibe las respuestas en la hoja de la pareja |

## Nueva boda

1. Rama nueva desde `main`.
2. Edita `config.json`, `css/theme.css` y cambia la foto en `assets/`.
3. Para guardar respuestas en Sheets: pega `integrations/google-sheets.gs` en la hoja (Extensiones > Apps Script), despliega como aplicación web con acceso "Cualquiera" y pon la URL en `rsvp.endpoint`.

## Añadir una sección

Crea `js/sections/<nombre>.js` exportando una función `(config) => html`, regístrala en `SECTIONS` dentro de `js/main.js` y añade su nombre a `config.sections`.

La fecha y la hora se muestran tal cual están en el config (hora local del lugar), sin convertir a la zona horaria del invitado.

## Escaparate y generador (`studio/`)

`http://localhost:8000/studio/` es la web comercial: estilos con ejemplos en vivo, un formulario mínimo que genera la web de la pareja con su nombre, fecha, lugar y fotos, tarifas y formulario de reserva.

- `studio/studio.json` manda: marca, estilos del selector (`status: "available"` o `"soon"`), tiempos de la carga, tarifas y `contact.endpoint` (Apps Script para guardar reservas; vacío = simulado en el navegador).
- La plantilla se pinta en un iframe con `index.html#preview`: en ese modo no lee `config.json`, lo recibe del escaparate por `postMessage`. Cambiar de estilo es reenviar el config con otro `theme`, sin recargar.
- Las fotos se reducen en el navegador y no se suben a ningún sitio.
- Un estilo nuevo con la misma maquetación = un archivo en `css/themes/` y una entrada en `styles`. Una maquetación nueva = otra carpeta en `plantillas/` con su `index.html` que entienda el modo `#preview`, una entrada en `templates` y, si usa campos propios, su línea en `studio/app/wedding.js` (que traduce los datos del formulario al config de cada plantilla).
