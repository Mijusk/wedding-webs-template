# Medir los anuncios de Meta y Google

El escaparate (`/studio/`) ya está preparado para el píxel de Meta (Instagram y Facebook) y la
etiqueta de Google Ads. Está **apagado**: mientras los identificadores estén vacíos no se carga
nada. Solo hay que pegarlos en `studio/studio.json` y publicar.

## Qué hace

- Solo se carga si la persona acepta **«Publicidad y medición de anuncios»** en el aviso de
  cookies. Si rechaza o no contesta, no se carga nada. Si después retira el permiso, se deja de
  enviar y se borran las cookies de Meta y Google de la web.
- Envía dos conversiones, sin nombres ni emails (solo tarifa, estilo y precio):
  - **lead**: cuando envían el formulario «Probar con vuestra boda» (con un email de verdad, no
    el del botón de ejemplo). En Meta es el evento `Lead`.
  - **reserva**: cuando envían una reserva o pasan a pagarla. En Meta es `SubmitApplication`.
- Las dos conversiones salen de un único sitio, `conversion()` en `studio/app/ads.js`, que también
  las manda a Umami (`lead_prueba` y `reserva_enviada`, como hasta ahora).
- En Google Ads, la personalización de anuncios (remarketing) va denegada, porque el aviso de
  cookies no la pide.
- No se carga en `localhost`: se prueba en la vista previa de Vercel o en la web publicada.

## 1. Pegar los identificadores

En `studio/studio.json`, bloque `ads`:

```json
"ads": {
  "metaPixelId": "123456789012345",
  "googleAdsId": "AW-1234567890",
  "events": {
    "lead":    { "umami": "lead_prueba",     "meta": "Lead",              "googleLabel": "AbCdEfGhIjk" },
    "reserva": { "umami": "reserva_enviada", "meta": "SubmitApplication", "googleLabel": "LmNoPqRsTuv" }
  }
}
```

- **metaPixelId**: Meta Business Suite › Administrador de eventos › tu píxel › el número del
  identificador (solo números).
- **googleAdsId**: Google Ads › Objetivos › Conversiones › crea una conversión de tipo «Sitio
  web» › «Configurar manualmente» › «Usar Google tag». Es el `AW-…` de `send_to`.
- **googleLabel**: la parte de después de la barra en `send_to: 'AW-1234567890/AbCdEfGhIjk'`.
  Crea una conversión para «lead» y otra para «reserva», y pega cada etiqueta en su sitio.
  Si una etiqueta está vacía, esa conversión no se manda a Google.

Se puede poner solo uno de los dos (solo Meta o solo Google).

Antes de activar Meta, acepta en el Administrador de eventos las condiciones de las herramientas para
empresas de Meta: incluyen el acuerdo de corresponsabilidad que cita la página legal («Meta,
corresponsable»).

Haz commit, súbelo y espera a la vista previa de Vercel.

## 2. Comprobar que funciona

1. Abre la vista previa en una ventana de incógnito (para que salga el aviso de cookies).
2. **Sin aceptar** (pulsa «Rechazar todo»): en Chrome, F12 › pestaña Red › filtra por
   `facebook` y por `googletagmanager`. No tiene que aparecer nada.
3. Abre «Configurar cookies» al pie y activa **Publicidad**. Ahora sí tienen que aparecer
   `fbevents.js` y `gtag/js`.
4. **Meta**: Administrador de eventos › tu píxel › «Probar eventos». Pega la dirección de la vista
   previa, abre la web desde ahí y acepta la publicidad. Deben llegar `PageView`; prueba el
   generador con un email real tuyo (llega `Lead`) y envía una reserva de prueba (llega
   `SubmitApplication`). La extensión «Meta Pixel Helper» de Chrome también lo enseña.
5. **Google**: con la extensión «Tag Assistant» (tagassistant.google.com) conectada a la vista
   previa, acepta la publicidad y repite el generador y la reserva: deben salir los eventos
   `conversion` con tu `send_to`. En Google Ads, las conversiones pueden tardar unas horas en
   aparecer como «Registrando conversiones».
6. Vuelve a «Configurar cookies», apaga la publicidad y comprueba en F12 › Aplicación › Cookies que
   desaparecen `_fbp`, `_fbc`, `_gcl_au` y `_gcl_aw`.

## 3. Lo que queda para más adelante

- **API de conversiones** (enviar los eventos también desde el servidor, más fiable con
  bloqueadores): no está hecha. Iría en `api/lead.js` y `api/pedido.js`.
- Si algún día se quiere **remarketing** (enseñar anuncios a quien ya visitó la web), hay que
  añadirlo al texto del aviso de cookies (`studio/app/consent.js`, subiendo `VERSION`) y a la
  página legal antes de activarlo.
