# The service worker's runtime cache silently cached nothing, ever

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** caught mid-session while building task 23 (Convert to
  PWA), before this ever shipped - after fixing the reload crash (see
  [service-worker-broke-every-page-reload.md](./service-worker-broke-every-page-reload.md)),
  reloading still worked online, but nothing was ever actually being
  written to the cache - confirmed directly by reading back
  `caches.open("instruction-builder-v1")`'s contents after a normal,
  successful page load: always empty. Offline support - the entire point
  of this file - didn't exist yet, but nothing about a normal online
  session made that obvious.
- **Root cause:** the caching helper called `response.clone()` too late -
  inside an already-async `.then()` chain (`caches.open(...).then(cache =>
  cache.put(request, response.clone()))`), rather than synchronously before
  returning the response to the page. By the time that `.then()` actually
  ran, the page had frequently already started reading the original
  response's body to render itself, and `Response.clone()` throws
  (`TypeError: Failed to execute 'clone' on 'Response': Response body is
  already used`) the moment a response's body has been read at all - a
  rejected promise inside an uncaught `.then()`, so it failed completely
  silently from the outside; the response was still served to the page
  correctly either way, which is exactly what made this invisible without
  deliberately reading the cache back afterward.
- **Fix:** `response.clone()` now happens synchronously, immediately after
  the response is received - before anything else touches it - and only
  the resulting clone is handed to the (still async) `caches.open(...).then(cache
  => cache.put(request, copy))` chain, which itself is now wrapped in
  `event.waitUntil` so the service worker is guaranteed to stay alive long
  enough for that write to finish.
- **Verified by:** the same `pwa-check.mjs` script - reading `caches.open(...).keys()`
  back after a page load returned `[]` before the fix (despite the fetch
  handler visibly running on every request, confirmed via the service
  worker's own console output during debugging) and the expected cached
  URLs (the page itself, the hashed JS/CSS bundles) after. A subsequent
  fully-offline reload - the actual point of task 23 - only started
  succeeding once this was fixed too; the reload crash fix alone wasn't
  enough.
- **Found & fixed:** 2026-09-14 (task 23, Convert to PWA).
