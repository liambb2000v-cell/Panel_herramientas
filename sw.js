// sw.js — Service Worker del Panel de herramientas
//
// Intercepta CUALQUIER petición de red que haga una página cargada desde
// nuestro dominio (incluyendo las herramientas embebidas vía /proxy) y,
// si esa petición va hacia otro dominio, la redirige a través de nuestro
// servidor (/proxy-raw) en vez de dejar que el navegador la bloquee por
// CORS. Esto arregla llamadas dinámicas (fetch/XHR) que el sitio hace
// después de cargar, no solo lo que ya viene escrito en su HTML original.

const OWN_ORIGIN = self.location.origin;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return; // URL rara (ej. chrome-extension://) — se ignora, no se toca
  }

  // Mismo origen (nuestro propio dominio): se deja pasar tal cual,
  // sin interceptar. Esto evita bucles infinitos con /proxy y /proxy-raw.
  if (url.origin === OWN_ORIGIN) return;

  // No interceptamos peticiones que no sean http/https (ej. data:, blob:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(handleCrossOrigin(event.request, url));
});

async function handleCrossOrigin(request, url) {
  const proxyUrl = OWN_ORIGIN + '/proxy-raw?url=' + encodeURIComponent(url.toString());

  const init = {
    method: request.method,
    headers: request.headers,
    credentials: 'omit',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      init.body = await request.clone().arrayBuffer();
    } catch (e) {
      // sin cuerpo legible, se continúa sin body
    }
  }

  try {
    return await fetch(proxyUrl, init);
  } catch (e) {
    return new Response('No se pudo completar la petición vía proxy: ' + e.message, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

