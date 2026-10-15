/* Mathis English : garde l'appli dans l'iPhone pour qu'elle marche sans réseau */
const CACHE = "mathis-english-v1";
const ASSETS = [
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./fonts/atkinson-hyperlegible-latin-400-italic.woff2",
  "./fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "./fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "./fonts/atkinson-hyperlegible-latin-ext-400-italic.woff2",
  "./fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2",
  "./fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2",
  "./fonts/bricolage-grotesque-latin-600-normal.woff2",
  "./fonts/bricolage-grotesque-latin-800-normal.woff2",
  "./fonts/bricolage-grotesque-latin-ext-600-normal.woff2",
  "./fonts/bricolage-grotesque-latin-ext-800-normal.woff2",
  "./fonts/charis-sil-latin-400-normal.woff2",
  "./fonts/charis-sil-latin-ext-400-normal.woff2"
];

async function cleanPage(res){
  const txt = await res.text();
  return {txt, res: new Response(txt, {status: 200, headers: {"Content-Type": "text/html; charset=utf-8"}})};
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    const page = await fetch("./", {cache: "reload"});
    if (page.ok) await cache.put("./index.html", (await cleanPage(page)).res);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");
  if (isPage){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match("./index.html");
      const update = (async () => {
        try{
          const res = await fetch("./", {cache: "no-store"});
          if (!res.ok) return null;
          const fresh = await cleanPage(res);
          const old = cached ? await cached.clone().text() : null;
          await cache.put("./index.html", fresh.res.clone());
          if (old !== null && old !== fresh.txt){
            const clients = await self.clients.matchAll({type: "window"});
            clients.forEach(c => c.postMessage({type: "update"}));
          }
          return fresh.res;
        }catch(err){ return null; }
      })();
      if (cached){ e.waitUntil(update); return cached; }
      const res = await update;
      return res || new Response("<p style='font-family:sans-serif;padding:24px'>Ouvre l'appli une première fois avec du réseau.</p>", {status: 503, headers: {"Content-Type": "text/html; charset=utf-8"}});
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req, {ignoreSearch: true});
    if (cached) return cached;
    try{
      const res = await fetch(req);
      if (res.ok && !res.redirected){ const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    }catch(err){
      return new Response("", {status: 504});
    }
  })());
});
