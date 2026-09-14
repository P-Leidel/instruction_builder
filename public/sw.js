// Hand-written service worker for offline support (task 23) - no
// vite-plugin-pwa dependency, per the project's minimal-dependency
// principle (see docs/phase-1/foundation.md's "PWA groundwork"). Runtime
// caching only, not a build-time precache list: this can't cache anything
// before it's actually been requested, so the very first visit to any given
// asset still needs the network - but everything requested since (every
// hashed JS/CSS bundle Vite builds, the manifest, the icons, the page
// itself) gets cached as it's fetched, so a second visit - even fully
// offline - works from cache. Bump CACHE_NAME whenever this file's caching
// logic changes, so `activate` clears out anything cached under the old
// logic instead of accumulating it forever across deploys.
const CACHE_NAME = "instruction-builder-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Routing policy, kept separate from the fetch handler's execution
 * mechanics below (a 2026-09-14 architecture review's own distinction -
 * see docs/known-issues.md) - a pure function of a `Request`'s own
 * properties, with no `self`/`caches`/`event` access, so the decision
 * itself is easy to reason about (and to hand-check against a plain
 * `Request` in a console) independent of the clone/waitUntil mechanics
 * that actually carry it out.
 *
 * - "passthrough": let the browser handle this one natively, untouched.
 * - "network-first": try the network, falling back to the cache.
 * - "cache-first": try the cache, falling back to the network.
 */
function chooseStrategy(request) {
  // Only same-origin GET requests are ever handled - anything else (a
  // POST, a cross-origin font/API call) passes straight through untouched.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return "passthrough";
  }

  // A page reload's navigation request can carry cache:"only-if-cached"
  // paired with mode:"navigate" (not "same-origin") - re-fetching that
  // exact Request object throws immediately ("'only-if-cached' can be set
  // only if 'mode' is 'same-origin'"), breaking every reload. Let the
  // browser handle this one natively instead of intercepting it.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return "passthrough";
  }

  // Navigations (loading/reloading the page itself): network-first, so an
  // online user always gets the current build, falling back to whatever
  // was last cached (the SPA shell at "/") once offline.
  if (request.mode === "navigate") {
    return "network-first";
  }

  // Everything else (hashed JS/CSS bundles, the manifest, icons): cache-first
  // - a hashed filename never changes meaning once built, so a cache hit is
  // never stale.
  return "cache-first";
}

// Caches a response as a side effect of returning it - two things about
// *when* each step happens matter here, not just what they do. `.clone()`
// must happen synchronously, before this function returns, or it throws
// ("Response body is already used") the moment the original response's
// body has started being read elsewhere - which happens almost immediately
// once `event.respondWith` hands it to the page. And writing that clone to
// the cache has to be wrapped in `event.waitUntil`, since a fetch event's
// own promise (the one passed to `respondWith`) is the only thing the
// browser actually guarantees to wait for - without `waitUntil`, the SW can
// be freed before the cache write's own `.then()` chain finishes, silently
// dropping it.
function cachePut(event, request, response) {
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = chooseStrategy(request);

  if (strategy === "passthrough") return;

  if (strategy === "network-first") {
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(event, request, response))
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches
      .match(request)
      .then((cached) => cached ?? fetch(request).then((response) => cachePut(event, request, response))),
  );
});
