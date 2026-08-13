// server.js — servidor local para el Panel de herramientas
// Sirve los archivos del dashboard y actúa como proxy para poder
// mostrar sitios dentro del iframe aunque bloqueen la incrustación.
//
// Uso: node server.js   →  abre http://localhost:3000

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

// Encabezados que impiden la incrustación en iframe — se eliminan
// solo de la respuesta que llega a nuestro propio servidor, nunca
// se modifica nada en el sitio original.
const BLOCKED_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'content-length', // se recalcula tras modificar el HTML
  'content-encoding', // ya lo descomprimimos nosotros
  'set-cookie', // evita conflictos de cookies entre orígenes distintos
]);

function serveStatic(req, res) {
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ''));

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No encontrado');
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function fetchThroughProxy(targetUrl, res, redirectsLeft = 5) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('URL inválida');
    return;
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const options = {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  };

  const upstream = client.request(parsed, options, (upstreamRes) => {
    // Seguir redirecciones manualmente, reescribiéndolas hacia el proxy
    if ([301, 302, 303, 307, 308].includes(upstreamRes.statusCode) && upstreamRes.headers.location && redirectsLeft > 0) {
      const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
      upstreamRes.resume();
      fetchThroughProxy(nextUrl, res, redirectsLeft - 1);
      return;
    }

    const chunks = [];
    upstreamRes.on('data', (c) => chunks.push(c));
    upstreamRes.on('end', () => {
      let buffer = Buffer.concat(chunks);
      const encoding = upstreamRes.headers['content-encoding'];

      try {
        if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
        else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
        else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
      } catch (e) {
        // si falla la descompresión, se envía tal cual
      }

      const contentType = upstreamRes.headers['content-type'] || '';
      const headers = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (!BLOCKED_RESPONSE_HEADERS.has(key.toLowerCase())) headers[key] = value;
      }

      if (contentType.includes('text/html')) {
        let html = buffer.toString('utf8');
        // Inserta <base> para que las rutas relativas y absolutas
        // del sitio sigan apuntando a su dominio real, no al proxy.
        const baseTag = `<base href="${parsed.origin}${parsed.pathname}">`;
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
        } else {
          html = baseTag + html;
        }
        buffer = Buffer.from(html, 'utf8');
      }

      headers['content-length'] = Buffer.byteLength(buffer);
      res.writeHead(upstreamRes.statusCode || 200, headers);
      res.end(buffer);
    });
  });

  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No se pudo cargar el sitio (' + err.message + '). Prueba "Abrir en pestaña nueva".');
  });

  upstream.end();
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname === '/proxy') {
    const target = reqUrl.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Falta el parámetro url');
      return;
    }
    fetchThroughProxy(target, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Panel de herramientas corriendo en http://localhost:${PORT}`);
});
