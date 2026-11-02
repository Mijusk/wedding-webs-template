# Emails: que salgan de verdad (lo que tienes que hacer tú)

Hasta que hagas esto, ningún email sale de verdad: se apuntan como «simulado» y la web sigue funcionando igual. Afecta a todos los emails:
- la confirmación del pago con la factura;
- el enlace de acceso de las parejas;
- las propuestas;
- los resúmenes de respuestas;
- las automatizaciones.

Necesitas **tu dominio** (pendiente de decidir, ver DECISIONES.md). Unos 20 minutos más lo que tarde el DNS (normalmente 15 minutos, como mucho 72 horas).

---

## 1. Cuenta en Resend

1. Entra en [resend.com](https://resend.com) y crea una cuenta. El plan gratis vale para empezar: 3.000 emails al mes, como mucho 100 al día.
2. **Domains** › **Add Domain**.
   - Pon un **subdominio** de tu dominio, por ejemplo `mail.tudominio.es`. Resend lo recomienda: así, si algún día un email va a spam, no arrastra al resto de tu dominio.
   - **Región**: la más cercana a tus clientes, es decir, una de Europa.

## 2. Los registros DNS

1. Resend te enseña unos registros (TXT y MX). Cópialos **tal cual** en el sitio donde compraste el dominio, en la sección DNS.
2. Si usas Cloudflare, pon esos registros con la nube **gris** (sin proxy).
3. Vuelve a Resend y pulsa **Verify**. Suele tardar unos 15 minutos.
4. Cuando esté verificado, añade también el registro **DMARC** que te sugiere Resend. Ayuda a que tus emails no acaben en spam.

## 3. La clave y las variables

1. Resend › **API Keys** › **Create API Key**, con permiso **Sending access**. Copia la clave: empieza por `re_`.
2. En Vercel › **Settings** › **Environment Variables** (primero **solo Preview**, para probar):

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | la clave `re_…` (márcala **Sensitive**) |
| `EMAIL_FROM` | `WeddingWebs <hola@mail.tudominio.es>` (el subdominio que verificaste) |
| `NOTIFY_EMAIL` | tu email, para los avisos de pagos, leads y cambios |

3. **Redeploy** del último despliegue.
4. En el panel › **Ajustes** › **Datos fiscales**, el **email de contacto** es a donde llegan las respuestas de las parejas cuando contestan a un email automático. Pon uno que mires.

## 4. Probar

- En el escaparate, prueba una web con **tu** email y marca la casilla. Con «Bienvenida al probar una web» activada en Panel › Automatizaciones, te llega al momento.
- En Panel › Automatizaciones, activa las que quieras y pulsa **Revisar ahora**. En las vistas previas no hay aviso diario: el de cada mañana solo funciona en la web publicada (producción).

> Antes de activar nada en producción, lee los textos de cada email en Panel › Automatizaciones y cámbialos a tu gusto. Los emails comerciales llevan solos el enlace de baja que pide la ley.

Fuentes: [Resend: añadir un dominio](https://resend.com/docs/add-a-domain) · [precios de Resend](https://resend.com/pricing).
