self.addEventListener('install', e => e.waitUntil(
  caches.open('pit-v1').then(c => c.addAll(['/','/','/logo.png']))
));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))
));