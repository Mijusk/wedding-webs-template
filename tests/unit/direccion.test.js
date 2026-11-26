// Dirección de las webs de boda (lib/direccion.js) y el middleware de los subdominios (middleware.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { weddingUrl, inviteUrl, slugFromHost, cleanDomain } from "../../lib/direccion.js";
import middleware from "../../middleware.js";

const SITE = "https://www.weddingwebstudio.es";

test("sin subdominio activado, la dirección de siempre: /b/<slug>", () => {
  assert.equal(weddingUrl("maria-y-pablo", { site: SITE }), `${SITE}/b/maria-y-pablo`);
  assert.equal(weddingUrl("maria-y-pablo", { site: `${SITE}/`, domain: "" }), `${SITE}/b/maria-y-pablo`);
  assert.equal(inviteUrl("maria-y-pablo", "a/b c", { site: SITE }), `${SITE}/b/maria-y-pablo?i=a%2Fb%20c`);
});

test("con el subdominio activado: https://<slug>.<dominio>", () => {
  const opts = { site: SITE, domain: "weddingwebstudio.es" };
  assert.equal(weddingUrl("maria-y-pablo", opts), "https://maria-y-pablo.weddingwebstudio.es");
  assert.equal(inviteUrl("maria-y-pablo", "tok123", opts), "https://maria-y-pablo.weddingwebstudio.es?i=tok123");
  // Escrito de otras formas en la variable de Vercel: vale igual.
  for (const domain of ["WeddingWebStudio.es", "https://weddingwebstudio.es/", "*.weddingwebstudio.es"]) {
    assert.equal(weddingUrl("ana-y-luis", { site: SITE, domain }), "https://ana-y-luis.weddingwebstudio.es");
  }
  // Un dominio mal escrito no rompe nada: se queda en /b/.
  assert.equal(cleanDomain("no es un dominio"), null);
  assert.equal(weddingUrl("ana-y-luis", { site: SITE, domain: "no es un dominio" }), `${SITE}/b/ana-y-luis`);
});

test("reconoce el subdominio de una boda, y solo ese", () => {
  assert.equal(slugFromHost("maria-y-pablo.weddingwebstudio.es"), "maria-y-pablo");
  assert.equal(slugFromHost("Maria-Y-Pablo.WeddingWebStudio.es:443"), "maria-y-pablo");
  for (const host of ["www.weddingwebstudio.es", "weddingwebstudio.es", "a.b.weddingwebstudio.es", "-mal-.weddingwebstudio.es",
    "x.weddingwebstudio.es", "maria-y-pablo.otrodominio.es", "weddingwebs-git-main-luis8tko.vercel.app", "localhost", ""]) {
    assert.equal(slugFromHost(host), null, host);
  }
});

const run = async (url) => (await middleware(new Request(url)))?.headers.get("x-middleware-rewrite") ?? null;

test("middleware: el subdominio enseña su boda y conserva ?i= y ?vista=", async () => {
  assert.equal(await run("https://maria-y-pablo.weddingwebstudio.es/"), "https://maria-y-pablo.weddingwebstudio.es/api/boda?slug=maria-y-pablo");
  const to = new URL(await run("https://maria-y-pablo.weddingwebstudio.es/?i=tok123&vista=clave&slug=otra&host=x.es"));
  assert.equal(to.pathname, "/api/boda");
  assert.equal(to.searchParams.get("slug"), "maria-y-pablo", "no se puede pedir otra boda desde la dirección");
  assert.equal(to.searchParams.get("i"), "tok123");
  assert.equal(to.searchParams.get("vista"), "clave");
  assert.equal(to.searchParams.get("host"), null);
});

test("middleware: en www, en las vistas previas y en local no hace nada", async () => {
  for (const url of ["https://www.weddingwebstudio.es/", "https://weddingwebstudio.es/", "https://weddingwebs-git-x-luis8tko.vercel.app/", "http://localhost:3000/"]) {
    assert.equal(await middleware(new Request(url)), undefined, url);
  }
});
