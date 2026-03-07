/* POTENTRIX Service Worker */
'use strict';

var CACHE = 'ptx-v5';
var ASSETS = [
  '/01-splash-onboarding.html',
  '/02-chat-interface.html',
  '/03-voice-mode.html',
  '/04-settings.html',
  '/05-profile-persona.html',
  '/06-history.html',
  '/07-mode-selector.html',
  '/08-empty-states.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Skip non-GET and API calls
  if (e.request.method !== 'GET' || url.hostname === 'api.groq.com') return;

  // Network-first for HTML (always get fresh), cache-first for assets
  if (e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var clone = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
        return res;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        return cached || fetch(e.request).then(function (res) {
          var clone = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
          return res;
        });
      })
    );
  }
});
