// ══════════════════════════════════════════════════════════════
// HIPL Tracker v3 — Service Worker
// Provides offline caching and background sync capability.
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'hipl-v4';

// Files to pre-cache on install (the full app shell)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ── Install: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting(); // become active immediately
});

// ── Activate: remove stale caches from previous versions ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // take control of all open tabs
});

// ── Fetch: network-first for POST (API calls), cache-first for assets ──
self.addEventListener('fetch', event => {

  // POST requests (Google Apps Script submissions) — always try network
  if (event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ status: 'queued', message: 'Saved for sync' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // GET requests — cache-first, fallback to network, then to index.html
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ── Background Sync — notifies the page to flush its offline queue ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-hipl') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }))
      )
    );
  }
});
