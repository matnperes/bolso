// NYC de Bolso — guarda o app no aparelho para abrir sem internet.
const CACHE = "nyc-de-bolso-ebca7392b3";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

async function store(cache, url) {
  const res = await fetch(url, { cache: "reload" });
  if (!res.ok) throw new Error(url + " " + res.status);
  // O Safari recusa respostas com redirecionamento em navegação: guarda uma cópia limpa.
  const clean = res.redirected
    ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
    : res;
  await cache.put(url, clean);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map((u) => store(cache, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function offline() {
  return new Response("<meta charset=utf-8><p style=\"font:16px -apple-system,sans-serif;padding:24px\">Sem internet e o app ainda não foi guardado neste aparelho. Abra uma vez com internet.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Abre na hora com a cópia guardada; em segundo plano, busca a versão nova para a próxima vez.
    const network = fetch(req).then(async (res) => {
      if (res.ok && !res.redirected && res.type === "basic") {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        await cache.put("./index.html", copy);
      }
      return res;
    });
    event.waitUntil(network.then(() => {}, () => {}));
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match("./index.html"))
        .then((cached) => cached || network)
        .catch(() => offline())
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
  );
});
