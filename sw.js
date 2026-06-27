const CACHE = 'euskera-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/firebase.js',
  '/js/srs.js',
  '/js/exercises.js',
  '/js/ui.js',
  '/js/app.js',
  '/data/topics.json',
  '/data/exercises/a1_saludos.json',
  '/data/exercises/a1_numeros.json',
  '/data/exercises/a1_koloreak.json',
  '/data/exercises/a1_familia.json',
  '/data/exercises/a1_janaria.json',
  '/data/exercises/a1_aditzak.json',
  '/data/exercises/a1_egunak.json',
  '/data/exercises/a1_galderak.json',
  '/data/exercises/a2_etxea.json',
  '/data/exercises/a2_eguraldia.json',
  '/data/exercises/a2_gorputza.json',
  '/data/exercises/a2_hiria.json',
  '/data/exercises/a2_erosketak.json',
  '/data/exercises/a2_lana.json',
  '/data/exercises/a2_pertsonak.json',
  '/data/exercises/a2_iragana.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('gstatic') || url.hostname.includes('firebase')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});
