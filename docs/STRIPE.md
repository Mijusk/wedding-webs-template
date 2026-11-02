# Cobros con Stripe (lo que tienes que hacer tú)

Unos 20 minutos. Primero en **modo de prueba**: no hace falta dar de alta el negocio ni poner tu cuenta del banco, y no se cobra nada de verdad. El modo real lo activamos cuando decidas autónomo o sociedad.

Antes: haz primero lo de [SUPABASE.md](SUPABASE.md). Si ya lo hiciste antes de la fase 4, haz el paso 0.

---

## 0. Actualizar la base de datos (solo si ya la instalaste antes)

Pega los archivos nuevos como explica [SUPABASE.md](SUPABASE.md) (el recuadro «¿Ya lo instalaste antes?»).

(Si instalas desde cero, `supabase/instalar.sql` ya lo lleva.)

## 1. Tus datos fiscales en el panel

Sin ellos no sale ninguna factura (el pago entra igual y te queda una tarea «Hacer la factura»).

Panel › **Ajustes** › **Datos fiscales**: nombre, NIF, dirección, email y teléfono. Para pruebas puedes poner datos inventados; acuérdate de cambiarlos antes de cobrar de verdad.

## 2. Crear la cuenta de Stripe

1. Entra en [stripe.com/es](https://stripe.com/es) y crea una cuenta con tu email. País: **España**.
2. Cuando te pida activar los pagos, puedes saltártelo de momento: arriba a la derecha verás **Modo de prueba** (o *Test mode*). Déjalo **activado** en todos los pasos de esta guía.

## 3. La clave secreta de pruebas

1. **Desarrolladores** › **Claves de API** (o *Developers › API keys*).
2. Copia la **Clave secreta**: empieza por `sk_test_…`.

> Como la de Supabase: no la pegues en chats ni emails, solo en Vercel.

## 4. El aviso de pagos (webhook)

Es por donde Stripe le dice a la web «esta pareja ha pagado».

1. En Vercel, abre el despliegue de la rama `saas/fases-0-1-2` y copia su dirección **de la rama** (la que lleva `git-saas-fases-0-1-2`, no cambia con cada despliegue). Algo como `https://wedding-webs-template-git-saas-fases-0-1-2-tuusuario.vercel.app`.
2. Los despliegues de vista previa de Vercel están protegidos y Stripe no podría entrar. Para dejarle pasar: Vercel › tu proyecto › **Settings** › **Deployment Protection** › **Protection Bypass for Automation** › **Add Secret** (o *Create*). Copia ese secreto.
3. En Stripe: **Desarrolladores** › **Webhooks** › **Añadir destino** (o *Add endpoint*).
   - URL: `https://<la dirección del paso 1>/api/stripe?x-vercel-protection-bypass=<el secreto del paso 2>`
   - Eventos (búscalos por nombre y márcalos):
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `charge.refunded`
     - `charge.dispute.created`
4. Guarda. Abre el destino que acabas de crear y copia el **Secreto de firma** (*Signing secret*): empieza por `whsec_…`.

## 5. Bizum (opcional)

En Stripe: **Configuración** › **Pagos** › **Métodos de pago**. Si aparece **Bizum**, actívalo. La página de pago enseñará solo los métodos que tengas activados (tarjeta, Bizum, Apple Pay, Google Pay…). No hay que tocar nada más.

## 6. Ponerlo en Vercel

Vercel › **Settings** › **Environment Variables**, marcando **solo Preview** y **Sensitive**:

| Variable | Valor |
| --- | --- |
| `STRIPE_SECRET_KEY` | la `sk_test_…` del paso 3 |
| `STRIPE_WEBHOOK_SECRET` | la `whsec_…` del paso 4 |

Luego **Deployments** › el último de la rama › tres puntos › **Redeploy**.

## 7. Probarlo

En el despliegue de la rama:

1. `…/studio/` › **Tarifas** › elige **Tal cual** › rellena nombre y email › marca «Queremos que empecéis ya» › **Pagar 79 € y reservar**.
2. En la página de Stripe usa la tarjeta de prueba **4242 4242 4242 4242**, cualquier fecha futura y cualquier CVC.
3. Vuelves a la página de seguimiento: debe poner **¡Pago recibido!**, con la factura para descargar.
4. En el panel:
   - en **Tareas** sale «Preparar la web de…»;
   - en la ficha del cliente, el pedido pagado;
   - en **Facturas**, la factura.
5. Desde la ficha del cliente: **Crear su web** › crea la web › **Propuestas y cambios** › **Mandar la propuesta 1**. En la página de seguimiento de la pareja (otra ventana) prueba «Pedir cambios» y «¡Nos encanta, publicadla!».
6. Devolución: en Stripe › **Pagos** › el pago › **Reembolsar**, primero una parte. En el panel aparece la factura rectificativa.

Si algo falla, en Stripe › **Webhooks** › tu destino verás cada aviso con su respuesta. Mándame una captura.

---

## Más adelante: cobrar de verdad

No hagas esto todavía:

1. En Stripe, **Activar pagos**: datos del negocio (autónomo o sociedad), NIF, tu cuenta del banco y tu DNI.
2. Desactiva el modo de prueba y repite los pasos 3 y 4 con la clave `sk_live_…` y un webhook a tu dominio de producción (sin el `x-vercel-protection-bypass`: producción no está protegida).
3. En Vercel, las dos variables marcando **solo Production**.
4. Pon tus datos fiscales reales en el panel.

Lo que cuesta Stripe está en [COSTES.md](COSTES.md).
