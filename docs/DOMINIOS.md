# Webs de boda en su subdominio: maria-y-pablo.weddingwebstudio.es

Sin terminal. Se hace **una vez** (unos 15 minutos y lo que tarde el certificado). Después, cada boda que publiques tiene su dirección sola, sin hacer nada más.

Mientras no termines el paso 4, todo sigue como siempre: las webs se abren en `www.weddingwebstudio.es/b/maria-y-pablo`, y esa dirección **seguirá funcionando siempre** (los enlaces ya mandados no se rompen).

## Lo que vas a tocar

- **Vercel**, donde está la web: añadir el dominio `*.weddingwebstudio.es` y una variable.
- **Cloudflare**, donde está el dominio: dos o tres registros DNS. **El correo no se toca**: los registros MX se quedan como están.

## 1. Vercel: añadir el dominio de las bodas

1. Entra en [vercel.com](https://vercel.com), abre el proyecto de la web › **Settings** › **Domains** › **Add Domain**.
2. Escribe `*.weddingwebstudio.es` (con el asterisco y el punto) y pulsa **Add**.
3. Vercel te enseña los registros que necesita. Como el dominio está en Cloudflare, elige la opción de **no cambiar los nameservers** («delegate the `_acme-challenge`» o parecido). Te pedirá:
   - **2 registros NS** con nombre `_acme-challenge`, que apuntan a `ns1.vercel-dns.com` y `ns2.vercel-dns.com`. Sirven para que Vercel pueda hacer el certificado del candado (https) de todas las bodas a la vez.
   - **1 registro CNAME** con nombre `*` que apunta a la dirección que te enseñe Vercel (algo como `cname.vercel-dns-0.com`). Es el que manda las visitas de las bodas a la web.

Deja esa pestaña abierta: los vas a copiar tal cual.

## 2. Cloudflare: añadir esos registros

1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com) › `weddingwebstudio.es` › **DNS** › **Records**.
2. **Add record** por cada uno de los del paso anterior, copiando tipo, nombre y valor.
3. En el CNAME `*`, deja la nube **gris («DNS only»)**, no naranja. Con la naranja, Vercel no puede hacer el certificado y las bodas no abrirían.
4. No borres ni cambies nada más (los MX del correo, `www`, etc.).

## 3. Esperar a que Vercel diga que está bien

Vuelve a Vercel › **Domains**. En unos minutos (a veces hasta una hora) `*.weddingwebstudio.es` pasa a **Valid Configuration**. Entonces abre en el móvil la dirección de una boda publicada, por ejemplo `https://lucia-y-martin.weddingwebstudio.es`. Tiene que salir su web, con el candado.

Si sale «No encontramos esta página», esa boda no está publicada o no se llama así: mira su dirección en el panel.

## 4. Activarlo en el panel y en los enlaces

Solo cuando el paso 3 funcione:

1. Vercel › **Settings** › **Environment Variables** › **Add**: nombre `WEDDING_DOMAIN`, valor `weddingwebstudio.es`, entorno **Production**. Guardar.
2. Vercel › **Deployments** › los tres puntos del último › **Redeploy**.

Desde ese momento el panel, el panel de la pareja, los códigos QR, los mensajes de WhatsApp y los emails dan la dirección nueva. Las bodas nuevas se crean ya con ella.

## Si algo va mal

- **Para volver atrás:** borra la variable `WEDDING_DOMAIN` y haz **Redeploy**. Los enlaces vuelven a ser `/b/…` (que nunca dejan de funcionar).
- **Una boda concreta no abre en su subdominio pero sí en `/b/…`:** su dirección tiene algo raro (más de 60 letras, por ejemplo). Cámbiala en el editor o sigue usando la de `/b/`.

## Para quien programe

- `middleware.js`: en la raíz `/` de un subdominio de boda enseña esa boda (`/api/boda?slug=…`). Va en un middleware porque Vercel sirve antes los archivos que las reglas de `vercel.json`, y en la raíz está el `index.html` de la Clásica.
- `vercel.json`: la redirección de `/` a `/studio/` no se aplica en los subdominios de boda (sí en `www` y en las vistas previas).
- `lib/direccion.js`: la dirección y el enlace de invitados de cada boda, en un solo sitio para el panel, el panel de la pareja, los emails y la web.
- En local: `curl -H "Host: lucia-y-martin.weddingwebstudio.es" http://localhost:3000/`.
