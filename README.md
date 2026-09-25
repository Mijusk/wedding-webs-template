# Wedding Webs · template

Web de boda configurable desde un único `config.json`. HTML, CSS y JS sin framework ni paso de build.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

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
| `integrations/google-sheets.gs` | Apps Script que recibe las respuestas en la hoja de la pareja |

## Nueva boda

1. Rama nueva desde `main`.
2. Edita `config.json`, `css/theme.css` y cambia la foto en `assets/`.
3. Para guardar respuestas en Sheets: pega `integrations/google-sheets.gs` en la hoja (Extensiones > Apps Script), despliega como aplicación web con acceso "Cualquiera" y pon la URL en `rsvp.endpoint`.

## Añadir una sección

Crea `js/sections/<nombre>.js` exportando una función `(config) => html`, regístrala en `SECTIONS` dentro de `js/main.js` y añade su nombre a `config.sections`.

La fecha y la hora se muestran tal cual están en el config (hora local del lugar), sin convertir a la zona horaria del invitado.
