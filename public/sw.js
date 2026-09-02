/*
 * The studio's service worker (FB-141).
 *
 * ## It caches almost nothing, and that is the design
 *
 * A service worker that caches responses would be the single most dangerous file in this repository.
 * Every interesting page here is venture-scoped and session-scoped: `/venture/<id>` is one founder's
 * desk, decided server-side per request (CLAUDE.md #6). A cache sitting in front of that can serve
 * one founder's venture to the next person to open the app on a shared device, and can serve a
 * decision queue that was emptied an hour ago.
 *
 * So the rule is absolute and it is expressed as an allow-list, not a deny-list: only files that are
 * the same for everybody are ever cached. A deny-list would need updating every time a route is
 * added, and the failure mode of forgetting is a founder seeing another founder's work.
 *
 * ## Why it exists at all
 *
 * Installability. iOS will not add a site to the home screen as an app, and will not accept a push
 * subscription, without a registered service worker. That is the whole job today.
 */

const SHELL = 'foundry-shell-v1';

// Everything here is identical for every viewer, signed in or not. Nothing venture-scoped, nothing
// behind auth, nothing that names a person.
const SHELL_FILES = ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Same-origin GETs of the shell files, and nothing else. Every other request — every page, every
  // API call, every server action — goes to the network untouched, every time.
  const isShell = url.origin === self.location.origin
    && event.request.method === 'GET'
    && SHELL_FILES.includes(url.pathname);

  if (!isShell) return;

  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
