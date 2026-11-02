# Facturas y Verifactu

## Cómo factura hoy la web

- **Cuándo:** sola, en cuanto un pedido queda pagado (con Stripe o cuando apuntas un Bizum o una transferencia en el panel). La pareja la recibe en PDF por email y la puede descargar desde su página de seguimiento.
- **Qué tipo:**
  - **Simplificada** (serie `WS-2026-0001`): si la pareja no pide factura a nombre de alguien y el importe no pasa de 400 €. Es lo normal con particulares.
  - **Completa** (serie `WW-2026-0001`): si dan nombre, NIF y dirección, o si pasa de 400 €.
  - **Rectificativa** (serie `R-2026-0001`): sale sola cuando devuelves dinero, también si es solo una parte. La original nunca se toca.
- **Reglas que pone la base de datos** (no se pueden saltar desde la pantalla):
  - números seguidos sin huecos, por serie y año;
  - una factura emitida no se puede cambiar ni borrar;
  - cada factura deja un registro encadenado con su huella, en el formato de la AEAT.
- **Si faltan tus datos fiscales** (Panel › Ajustes), el pago entra igual, la factura se queda en borrador y te sale la tarea «Hacer la factura». La emites desde Panel › Facturas.
- **Para la gestoría:** Panel › Facturas › trimestre › «Libro de facturas emitidas». Es un Excel con una fila por factura, y al lado tienes el resumen de IVA del trimestre (modelo 303).

## Verifactu: qué es y cuándo toca

Verifactu obliga a que el programa de facturación mande cada factura a Hacienda al emitirla. La factura lleva además un código QR y la leyenda «VERI*FACTU».

- **Fechas que hay hoy en la ley** (Real Decreto-ley 15/2025):
  - **1 de enero de 2027** si eres sociedad;
  - **1 de julio de 2027** si eres autónomo.
- **Aviso de Hacienda:** el 5 de octubre de 2026 anunció que lo retrasará a **octubre de 2028**. A 25 de octubre de 2026 **aún no ha salido en el BOE**, así que por ley siguen valiendo las fechas de 2027.
- Hasta esa fecha, facturar como ahora (sin mandar nada a Hacienda) es legal. Las facturas salen con el proveedor «manual».

Fuentes: [Webpsilon, revisado el 17/10/2026](https://www.webpsilon.com/blog/verifactu-que-es-cuando-entra-en-vigor-y-a-quien-afecta/) · [Autointellia, 6/10/2026](https://autointellia.com/blog/verifactu-aplazamiento-octubre-2028-pendiente-boe). Antes de la fecha, confírmalo con tu gestoría o en la web de la AEAT.

## Elegir proveedor (decisión tuya, sin prisa)

La web ya hace la factura, el número, el PDF y la cadena de huellas. Al proveedor solo le falta **mandar el registro a Hacienda** y devolver el QR. El código está preparado para enchufarlo: `api/_lib/facturacion.js`, variable `INVOICING_PROVIDER`.

| | **Verifacti** | **BeeL** | **Quaderno** |
| --- | --- | --- | --- |
| Qué es | Solo la parte de Hacienda, por API | Facturación + Verifactu por API, con conector de Stripe | Programa de facturación completo con Verifactu |
| Precio | 2,90 € al mes por NIF; tienen un plan gratis de 1 NIF* | Desde 15 € al mes (API, hasta 250 facturas al mes)* | No publicado en lo que he podido consultar |
| ¿Usa nuestras facturas tal cual? | Sí: mandamos nuestros datos y nuestro número | Sí (también puede hacer el PDF) | No: hace sus propias facturas, habría que dejar de hacerlas aquí |
| Certificado digital | No hace falta: actúan como tu representante ante Hacienda | No hace falta, según su web | **Sí**: tienes que subir tu certificado |
| Pruebas sin enviar nada real | Sí | Sí | Sí |

\* Precios según una comparativa publicada por BeeL en mayo de 2026: BeeL es parte interesada. Confírmalos en la web de cada uno antes de contratar.

**Mi recomendación: Verifacti.** Es lo más barato. Encaja con lo que ya está hecho (nuestras facturas y nuestro PDF), así que solo hay que conectar el envío. Y no necesitas certificado digital.

**Si prefieres no depender de un proveedor tan pequeño:** BeeL es la alternativa. Es más caro, pero también puede hacer el PDF y se conecta con Stripe.

Quaderno lo descartaría: duplicaría lo que ya hace la web y pide tu certificado.

Otras opciones que he mirado y son para empresas grandes: B2Brouter, Invopop y fiskaly.

Fuentes: [comparativa de BeeL (mayo 2026)](https://beel.es/blog/comparativa-apis-verifactu) · [documentación de Quaderno](https://developers.quaderno.io/guides/e-invoicing/verifactu) · [B2Brouter](https://www.b2brouter.net/es/api-verifactu/).

## Qué preguntarle a tu gestoría

1. ¿Autónomo o sociedad? Cambia la fecha de Verifactu y los datos de las facturas.
2. ¿Te vale la factura simplificada para particulares hasta 400 €, y completa si la piden con NIF?
3. ¿Les vale el libro de facturas emitidas en Excel que saca el panel, o lo quieren en otro formato?
4. Régimen de IVA (general al 21 % salvo que te digan otra cosa). Se pone en Panel › Ajustes.
