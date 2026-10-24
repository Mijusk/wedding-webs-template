# Inventario del repositorio (24 de octubre de 2026)

Lo que había antes de empezar el SaaS, para no romper nada.

## Plantillas y estilos

- **25 maquetaciones**: la Clásica (raíz del repositorio) y 24 carpetas en `plantillas/`: acuarela, azulejo, botanica, capilla, carrete, carta, ciudades, costa, editorial, estrellas, etiqueta, galeria, jardin, lacre, lino, minimal, monograma, negro, palacio, postal, toile, vegetal, verbena y villa.
- **27 estilos** en el escaparate (`studio/studio.json > styles`): uno por maquetación, y la Clásica con tres (Olivar, Atardecer y Noche), que solo cambian `config.theme`.
- Todas cargan su config con `js/config.js > loadConfig()` y guardan el RSVP con `js/storage.js`. Son 25 copias idénticas de cada archivo: ahí está el único punto de enganche con la base de datos.

## Secciones (`config.sections`)

| Sección | Qué es | Plantillas |
| --- | --- | --- |
| `hero` | Portada | todas menos Postal |
| `card` | Tarjeta de invitación | Postal |
| `details` | Fecha, lugar, cuenta atrás, calendario | todas menos Postal |
| `story` | Historia en capítulos | todas menos Postal, Verbena y Clásica (la tiene, pero sin registrar) |
| `schedule` | Programa del día | todas menos Postal |
| `gallery` | Fotos | todas menos Editorial y Postal |
| `gifts`, `closing`, `rsvp` | Regalo, cierre y confirmación | todas |
| `dresscode` | Código de vestimenta | Etiqueta, Palacio, Villa |
| `liturgy` | Lecturas y música | Capilla |
| `travel` | Viaje y cómo llegar | Costa, Dos ciudades |

## Campos del config

- Comunes a todas: `locale`, `event` (pareja, fecha con zona, fin, frase, foto, encuadre, texto alternativo), `venue` (nombre, dirección, ciudad, mapa), `schedule`, `gifts` (titular, IBAN), `rsvp` (fecha límite, botón, destino), `copy` (todos los textos, por sección) y `sections`.
- Casi todas: `story.chapters` y `gallery`.
- Propios: `venue.lat/lon` (Costa, Noche estrellada), `cities` y `copy_en` (Dos ciudades, bilingüe), `copy.letter` (Carta), `copy.envelope` (Lacre), `copy.museum` (Galería), etc.
- Esquema completo: [`schema/wedding-config.schema.json`](../schema/wedding-config.schema.json). Las 25 configs de ejemplo lo cumplen (`npm run validar`).

## Integraciones

- **Leads del escaparate**: `studio/app/leads.js` → Apps Script `integrations/leads.gs` → hoja "Contactos" + email a Luis.
- **RSVP de cada boda**: `js/storage.js` → Apps Script `integrations/google-sheets.gs` en la hoja de la pareja.
- **Herramientas**: `herramientas/fotos.html` (fotos sin perder calidad) y `herramientas/compartir.html` (tarjeta de WhatsApp e icono).
- **Legal**: `studio/legal.html` lee el titular de `studio.json > legal` (NIF y domicilio vacíos).
- **Vercel**: preset "Other", sin compilación, `vercel.json` con cabeceras (nadie puede incrustar las páginas) y `/` → `/studio/`.

## Ramas

Solo `main`. No había ninguna boda real en una rama todavía. Si aparece alguna: `npm run importar-boda -- --rama <nombre>`.

## Problema encontrado

La Clásica no se pinta en `main` (ver [DECISIONES.md](DECISIONES.md#problemas-encontrados-que-ya-estaban-en-main)).
