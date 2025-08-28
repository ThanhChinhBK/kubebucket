const CACHE_NAME = 'kube-bucket-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './manifest.json',
  './assets/bucket.svg',
  './assets/pod-backend.svg',
  './assets/pod-cache.svg',
  './assets/pod-db.svg',
  './assets/pod-frontend.svg',
  './assets/pod-mltask.svg',
  './assets/pod-monitor.svg',
  './assets/resource-cpu.svg',
  './assets/resource-gpu.svg',
  './assets/resource-ram.svg',
  './assets/resource-ssd.svg',
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache installation failed:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return offline page
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
