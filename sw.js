const CACHE = 'euskera-v5';
const BASE = self.registration.scope;
const STATIC = [
  '',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/firebase.js',
  'js/srs.js',
  'js/course.js',
  'js/exercises.js',
  'js/ui.js',
  'js/app.js',
  'data/course_a1.json',
  'data/units/u01/meta.json',
  'data/units/u01/l01.json',
  'data/units/u01/l02.json',
  'data/units/u01/l03.json',
  'data/units/u01/l04.json',
  'data/units/u01/l05.json',
  'data/units/u01/l06.json',
  'data/units/u01/l07.json',
  'data/units/u01/test.json',
  'data/units/u02/meta.json',
  'data/units/u02/l01.json',
  'data/units/u02/l02.json',
  'data/units/u02/l03.json',
  'data/units/u02/l04.json',
  'data/units/u02/l05.json',
  'data/units/u02/l06.json',
  'data/units/u02/l07.json',
  'data/units/u02/test.json',
  'data/units/u03/meta.json',
  'data/units/u03/l01.json',
  'data/units/u03/l02.json',
  'data/units/u03/l03.json',
  'data/units/u03/l04.json',
  'data/units/u03/l05.json',
  'data/units/u03/l06.json',
  'data/units/u03/l07.json',
  'data/units/u03/test.json',
  'data/units/u04/meta.json',
  'data/units/u04/l01.json',
  'data/units/u04/l02.json',
  'data/units/u04/l03.json',
  'data/units/u04/l04.json',
  'data/units/u04/l05.json',
  'data/units/u04/l06.json',
  'data/units/u04/l07.json',
  'data/units/u04/test.json',
  'data/units/u05/meta.json',
  'data/units/u05/l01.json',
  'data/units/u05/l02.json',
  'data/units/u05/l03.json',
  'data/units/u05/l04.json',
  'data/units/u05/l05.json',
  'data/units/u05/l06.json',
  'data/units/u05/l07.json',
  'data/units/u05/test.json',
  'data/units/u06/meta.json',
  'data/units/u06/l01.json',
  'data/units/u06/l02.json',
  'data/units/u06/l03.json',
  'data/units/u06/l04.json',
  'data/units/u06/l05.json',
  'data/units/u06/l06.json',
  'data/units/u06/l07.json',
  'data/units/u06/test.json',
  'data/units/u07/meta.json',
  'data/units/u07/l01.json',
  'data/units/u07/l02.json',
  'data/units/u07/l03.json',
  'data/units/u07/l04.json',
  'data/units/u07/l05.json',
  'data/units/u07/l06.json',
  'data/units/u07/l07.json',
  'data/units/u07/test.json',
  'data/units/u08/meta.json',
  'data/units/u08/l01.json',
  'data/units/u08/l02.json',
  'data/units/u08/l03.json',
  'data/units/u08/l04.json',
  'data/units/u08/l05.json',
  'data/units/u08/l06.json',
  'data/units/u08/l07.json',
  'data/units/u08/test.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
].map(p => BASE + p);

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
