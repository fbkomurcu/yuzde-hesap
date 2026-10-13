// İnternetsiz çalışma: tüm dosyalar saklanır, önce saklanandan verilir, arkada yenisi alınır.
// Dosyaları değiştirince SURUM'u artır; telefonlar bir sonraki açılışta yeni sürümü alır.
const SURUM = "yuzde-hesap-1.4.0";
const DOSYALAR = [
  "./", "index.html", "stil.css", "uygulama.js", "hesaplar.js", "tinos.ttf",
  "manifest.webmanifest", "ikon.svg", "ikon-180.png", "ikon-192.png", "ikon-512.png", "ikon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(SURUM).then(async (c) => {
      const saklanan = await c.match(e.request, { ignoreSearch: true });
      const ag = fetch(e.request)
        .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })
        .catch(() => saklanan);
      return saklanan || ag;
    }),
  );
});
