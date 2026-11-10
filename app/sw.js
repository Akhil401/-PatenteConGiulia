// Service worker: app shell cached at install; chapters, dictionaries and images
// cached the first time they are used (and refreshed in the background).
const VERSION = "pcg-v6";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/learn.js", "js/data.js", "js/store.js", "js/speech.js", "js/giulia.js", "js/sound.js",
  "js/scenes/engine.js", "js/scenes/overtake.js", "js/scenes/signs.js", "js/scenes/index.js",
  "data/index.json", "data/ready.json", "data/glossary.json", "data/intros.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Images never change: cache first. Everything else: network first (so updates arrive),
  // falling back to the cache when offline or when the network is slower than 3 s.
  const isImage = /\/images\/|\/icons\//.test(new URL(req.url).pathname);
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (isImage && hit) return hit;
    // "no-cache" = always ask the server if the file changed (so updates to chapters arrive)
    const net = (req.mode === "navigate" ? fetch(req) : fetch(req, { cache: "no-cache" }))
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    const res = hit ? await Promise.race([net, new Promise(r => setTimeout(() => r(null), 3000))]) : await net;
    if (res) return res;
    if (hit) return hit;
    if (req.mode === "navigate") return cache.match("index.html");
    return new Response("Offline and not cached yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }));
});
