#!/usr/bin/env node
// Servidor local sin dependencias que se comporta como Vercel con este repositorio:
// archivos estáticos + funciones de /api + redirecciones, reescrituras y cabeceras de vercel.json.
//
//   node scripts/servidor-local.mjs          (o: npm run dev)   -> http://localhost:3000
//
// Lee las variables de .env.local (o .env) como haría Vercel. Copia .env.example para empezar.
import http from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);

for (const file of [".env.local", ".env"]) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));

// Patrones de vercel.json ("/b/:slug", "/(a|b)/:path*") -> expresión regular con grupos con nombre.
function compile(source) {
  const re = source
    .replace(/:(\w+)\*/g, "(?<$1>.*)")
    .replace(/:(\w+)/g, "(?<$1>[^/]+)");
  return new RegExp(`^${re}$`);
}
const rules = (list = []) => list.map((r) => ({ ...r, re: compile(r.source) }));
const redirects = rules(vercel.redirects);
const rewrites = rules(vercel.rewrites);
const headerRules = rules(vercel.headers);
const fill = (dest, groups = {}) => dest.replace(/:(\w+)/g, (_, k) => encodeURIComponent(groups[k] ?? ""));

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".gs": "text/plain; charset=utf-8",
};

function staticFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, clean);
  if (!file.startsWith(ROOT)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

async function runFunction(name, req, res) {
  const file = join(ROOT, "api", `${name}.js`);
  if (!/^[a-z0-9-]+$/.test(name) || !existsSync(file)) return false;
  const mod = await import(`${pathToFileURL(file).href}?v=${statSync(file).mtimeMs}`);
  await mod.default(req, res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    for (const rule of headerRules) {
      if (rule.re.test(url.pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    }
    for (const rule of redirects) {
      const m = rule.re.exec(url.pathname);
      if (m) {
        res.statusCode = rule.permanent ? 308 : 307;
        res.setHeader("Location", fill(rule.destination, m.groups) + url.search);
        return res.end();
      }
    }
    // Como en Vercel: primero los archivos que existen; luego las reescrituras.
    let path = url.pathname;
    if (!path.startsWith("/api/") && !staticFile(path)) {
      for (const rule of rewrites) {
        const m = rule.re.exec(path);
        if (!m) continue;
        const dest = new URL(fill(rule.destination, m.groups), url);
        for (const [k, v] of url.searchParams) if (!dest.searchParams.has(k)) dest.searchParams.set(k, v);
        req.url = dest.pathname + dest.search;
        path = dest.pathname;
        break;
      }
    }
    if (path.startsWith("/api/")) {
      const name = path.slice(5).replace(/\/$/, "");
      if (!name.startsWith("_") && await runFunction(name, req, res)) return;
    }
    const file = staticFile(path);
    if (file) {
      if (url.pathname.length > 1 && !url.pathname.endsWith("/") && file.endsWith("index.html") && !path.endsWith("index.html")) {
        res.statusCode = 308;
        res.setHeader("Location", `${url.pathname}/${url.search}`);
        return res.end();
      }
      res.setHeader("Content-Type", MIME[extname(file)] || "application/octet-stream");
      return createReadStream(file).pipe(res);
    }
    res.statusCode = 404;
    res.setHeader("Content-Type", MIME[".html"]);
    res.end(readFileSync(join(ROOT, "404.html")));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.end("Error del servidor local: " + e.message); }
  }
});

server.listen(PORT, () => {
  console.log(`WeddingWebs en local: http://localhost:${PORT}/studio/   ·   panel: http://localhost:${PORT}/panel/`);
  if (!process.env.SUPABASE_URL) console.log("Sin SUPABASE_URL: el escaparate y las plantillas funcionan; el panel y /b/<boda> necesitan Supabase (ver docs/ARRANCAR.md).");
});
