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
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.tres': 'text/plain; charset=utf-8',
};

// Datos del Release de GitHub donde vive el archivo pesado de Godot
// (godot.editor.wasm, ~82MB) que no cupo en la subida normal del repo.
const GODOT_WASM_RELEASE_URL =
  'https://github.com/liambb2000v-cell/Panel_herramientas/releases/download/godot-assets/godot.editor.wasm';

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

// Convierte una URL (relativa, absoluta, lo que sea) en una URL que pasa
// por nuestro proxy, resuelta contra la URL base de la página/CSS actual.
function toProxyUrl(rawUrl, baseUrl) {
  if (!rawUrl) return rawUrl;
  const trimmed = rawUrl.trim();
  if (/^(data:|javascript:|mailto:|tel:|#|blob:)/i.test(trimmed)) return rawUrl;
  try {
    const abs = new URL(trimmed, baseUrl).toString();
    return '/proxy?url=' + encodeURIComponent(abs);
  } catch (e) {
    return rawUrl;
  }
}

// Reescribe url(...) dentro de texto CSS (hojas de estilo completas,
// bloques <style>, o atributos style="") para que también pasen por el proxy.
function rewriteCssUrls(css, baseUrl) {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, quote, url) => {
    const proxied = toProxyUrl(url, baseUrl);
    return `url(${quote}${proxied}${quote})`;
  });
}

// Reescribe solo el atributo indicado (src/href) dentro de las etiquetas
// de recurso dadas (link, script, img, etc). A propósito NO tocamos <a href>
// ni <form action> — muchos sitios modernos (apps tipo SPA) usan esos
// atributos para su propio enrutamiento interno por JS, y reescribirlos
// confunde su navegación (causa 404 falsos dentro del sitio).
function rewriteAttrInTags(html, tags, attr, baseUrl) {
  const tagPattern = new RegExp(
    `(<(?:${tags.join('|')})\\b[^>]*?\\s${attr}\\s*=\\s*)(["'])(.*?)\\2`,
    'gi'
  );
  return html.replace(tagPattern, (m, prefix, quote, url) => {
    return `${prefix}${quote}${toProxyUrl(url, baseUrl)}${quote}`;
  });
}

// Reescribe src/href/action de etiquetas HTML, además de CSS embebido
// (bloques <style> y atributos style=""), para que todos los recursos
// (CSS, imágenes, fuentes, scripts) pasen por el proxy en vez de pedirse
// directo al sitio original — esto evita bloqueos por Cross-Origin-
// Resource-Policy que rompían el diseño de varios sitios.
function rewriteHtmlUrls(html, baseUrl) {
  html = rewriteAttrInTags(html, ['link'], 'href', baseUrl);
  html = rewriteAttrInTags(html, ['script', 'img', 'source', 'video', 'audio', 'iframe'], 'src', baseUrl);
  html = html.replace(/\bstyle(\s*=\s*)(["'])(.*?)\2/gi, (m, eq, quote, styleContent) => {
    return `style${eq}${quote}${rewriteCssUrls(styleContent, baseUrl)}${quote}`;
  });
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => {
    return open + rewriteCssUrls(css, baseUrl) + close;
  });
  return html;
}

function serveStatic(pathname, res) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ''));

  const isGodot = pathname.startsWith('/godot-editor/');

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No encontrado');
      return;
    }
    const ext = path.extname(fullPath);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // Permite explícitamente que ESTA página se incruste en un iframe
      // en cualquier otro sitio (Google Sites, otros proyectos, etc.)
      'Content-Security-Policy': "frame-ancestors *",
      // Evita que el navegador guarde una copia vieja del archivo
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
    if (isGodot) {
      // Godot necesita aislamiento de origen cruzado (SharedArrayBuffer)
      // para poder correr — estos encabezados solo se aplican aquí,
      // nunca en el resto del panel (rompería el proxy de otras tools).
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// Trae el godot.editor.wasm desde el Release de GitHub (donde sí cabe,
// a diferencia de la subida normal de archivos) y lo transmite tal cual
// fuera un archivo propio, con los encabezados que Godot necesita.
function serveGodotWasm(res, targetUrl = GODOT_WASM_RELEASE_URL, redirectsLeft = 5) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('URL de release inválida');
    return;
  }

  const client = parsed.protocol === 'https:' ? https : http;
  const options = {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PanelHerramientas/1.0)' },
  };

  const upstream = client.request(parsed, options, (upstreamRes) => {
    if ([301, 302, 303, 307, 308].includes(upstreamRes.statusCode) && upstreamRes.headers.location && redirectsLeft > 0) {
      upstreamRes.resume();
      serveGodotWasm(res, upstreamRes.headers.location, redirectsLeft - 1);
      return;
    }
    if (upstreamRes.statusCode !== 200) {
      res.writeHead(upstreamRes.statusCode || 502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No se pudo obtener godot.editor.wasm del Release (código ' + upstreamRes.statusCode + '). Revisa que el Release y el asset existan con esos nombres exactos.');
      return;
    }
    const headers = {
      'Content-Type': 'application/wasm',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    if (upstreamRes.headers['content-length']) {
      headers['Content-Length'] = upstreamRes.headers['content-length'];
    }
    res.writeHead(200, headers);
    upstreamRes.pipe(res); // streaming: no se carga el archivo entero en memoria
  });

  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No se pudo conectar al Release de GitHub (' + err.message + ')');
  });

  upstream.end();
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
        const baseUrl = parsed.toString();
        // Reescribe TODOS los recursos (CSS, imágenes, scripts, fuentes)
        // para que pasen por el proxy, evitando bloqueos por CORP/CORS
        // cuando el sitio y nuestro dominio son distintos.
        html = rewriteHtmlUrls(html, baseUrl);
        // <base> queda como red de seguridad para cualquier URL que se
        // genere dinámicamente por JS y que la reescritura no alcance.
        let injected = `<base href="${parsed.origin}${parsed.pathname}">`;
        // Si el sitio no trae su propia meta viewport, se la agregamos.
        // Sin esto, muchos sitios se renderizan asumiendo un ancho de
        // escritorio (~980px) y se ven diminutos dentro del iframe.
        if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
          injected += `<meta name="viewport" content="width=device-width, initial-scale=1.0">`;
        }
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, (m) => `${m}${injected}`);
        } else {
          html = injected + html;
        }
        buffer = Buffer.from(html, 'utf8');
      } else if (contentType.includes('text/css')) {
        // Las hojas de estilo también pueden referenciar fuentes/imágenes
        // vía url(...) — se reescriben igual para que pasen por el proxy.
        const css = rewriteCssUrls(buffer.toString('utf8'), parsed.toString());
        buffer = Buffer.from(css, 'utf8');
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

  if (reqUrl.pathname === '/godot-editor/godot.editor.wasm') {
    serveGodotWasm(res);
    return;
  }

  serveStatic(reqUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Panel de herramientas corriendo en http://localhost:${PORT}`);
});
