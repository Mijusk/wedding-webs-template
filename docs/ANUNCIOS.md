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

## 3. API de conversiones de Meta (desde el servidor)

Cuando una pareja guarda su prueba (lead nuevo) o envía una reserva, `api/lead.js` manda también el
evento a Meta desde el servidor (`api/_lib/meta.js`). Meta lo junta con el del píxel gracias al
mismo `eventID` y lo cuenta una sola vez. Sirve para los que tienen bloqueador de anuncios o un
navegador que corta el píxel, y Meta empareja mejor a la persona con el anuncio que vio.

- Solo se manda con el permiso de **Publicidad** del aviso de cookies (el mismo que el píxel).
- Sale: email y teléfono **cifrados** (SHA-256), IP, navegador, cookies `_fbp`/`_fbc`, la página y
  la tarifa. Nunca nombres, fecha ni lugar. Lo explica la página legal.
- Las reservas que pasan directamente a pagar con Stripe (`/api/pedido`) todavía no se mandan
  desde el servidor: solo las ve el píxel.

Para activarla, en Vercel › Settings › Environment Variables (Production y Preview):

| Variable | De dónde sale |
| --- | --- |
| `META_CAPI_TOKEN` | Administrador de eventos › tu píxel › Configuración › API de conversiones › «Generar identificador de acceso». Es secreta: solo en Vercel, nunca en el código ni en chats. |
| `META_PIXEL_ID` | Opcional: si no está, usa `studio.json › ads.metaPixelId`. |
| `META_TEST_EVENT_CODE` | Opcional, solo para probar: el código de «Probar eventos» (p. ej. `TEST12345`). Quítala después. |

Comprobar: con `META_TEST_EVENT_CODE` puesta, abre la web, acepta la publicidad y guarda una
prueba con tu email. En «Probar eventos» tiene que salir `Lead` dos veces (Navegador y Servidor)
marcado como «Desduplicado».

## 4. Dónde abandona la gente (embudo del generador)

Con la analítica aceptada, el «Probar» manda a Umami un evento por paso (desde el 27/11/2026 son
tres toques: nombres → estilo → su web con datos de ejemplo):

1. `probar_abierto` (con `desde`: portada_nombres, boton, boton_fijo, estilos).
2. `paso_generador` con `paso: nombres`: han escrito los dos nombres.
3. `estilos_abiertos` y `estilo_elegido` (con `estilo` y `posicion` en la cuadrícula).
4. `prueba_generada`: ya ven su web.
5. `aviso_datos` (`accion`: visto, si, no) y `datos_puestos` (`completos`: si/no): el aviso que sale
   al bajar por la web y el panel para poner fecha, lugar y fotos encima de ella.
6. `guardar_abierto` y `lead_prueba`.

El salto más grande entre un paso y el siguiente es el que hay que mejorar.

**Prueba A/B de la tarjeta del móvil** (desde el 27/11/2026, `studio.json > phoneGate`): a la mitad
de las visitas, la primera vez que ven su web les sale «¿Dónde os la mandamos?» pidiendo el móvil
(se puede cerrar). Cada navegador se queda en su grupo y **todos** los eventos llevan
`grupo_movil` (`tarjeta` o `sin`). En Umami, compara por `grupo_movil`: cuántos `lead_prueba` hay
en cada grupo por cada `prueba_generada`, y cuántos llegan a `reserva_enviada`. La tarjeta manda además
`tarjeta_movil` con `accion`: vista, dejado, cerrada. Tras ~2 semanas, si gana: `share: 1`; si
pierde: `enabled: false`. Para verla a mano: `/studio/?ab=tarjeta` (o `?ab=sin`). `ver_todas` cuenta
cuántos vuelven a la cuadrícula desde la vista previa.

## 5. Pie «Hecha con WeddingWebs» en las webs de boda

Cada web publicada en `/b/<boda>` lleva al final un pie discreto: «Web hecha con WeddingWebs ·
Haced la vuestra», que enlaza al escaparate con `utm_source=web-boda&utm_campaign=<boda>`. En el
CRM se ve qué boda trajo a cada pareja nueva. Para quitarlo en una boda (si una pareja de Atelier
lo pide), pon `"credit": false` en su config.

## 6. Lo que queda para más adelante

- Mandar también la compra pagada con Stripe (`Purchase`) desde el webhook.
- Si algún día se quiere **remarketing** (enseñar anuncios a quien ya visitó la web), hay que
  añadirlo al texto del aviso de cookies (`studio/app/consent.js`, subiendo `VERSION`) y a la
  página legal antes de activarlo.
