# A naive service worker fetch handler broke every page reload

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** caught mid-session while building task 23 (Convert to
  PWA), before this ever shipped - the very first version of `public/sw.js`
  made every `page.reload()` (and every real-user reload/refresh) fail
  outright with `net::ERR_FAILED`, even fully online. Any navigation
  intercepted by the service worker's `fetch` handler and re-issued via a
  plain `fetch(request)` failed immediately.
- **Root cause:** a reload's navigation `Request` can carry
  `request.cache === "only-if-cached"` paired with `request.mode ===
  "navigate"` (not `"same-origin"`) - a combination the Fetch spec only
  allows for same-origin requests. Re-fetching that exact `Request` object
  inside the service worker inherits both properties and throws
  immediately (`TypeError: 'only-if-cached' can be set only if 'mode' is
  'same-origin'`), before the request ever reaches the network - a
  well-known, easy-to-miss constraint of intercepting navigation requests
  in a service worker, not anything specific to this app's caching logic.
- **Fix:** the `fetch` handler now checks for exactly this combination
  (`request.cache === "only-if-cached" && request.mode !== "same-origin"`)
  and returns early without calling `respondWith` at all, letting the
  browser handle that one request natively instead of intercepting it.
- **Verified by:** a Playwright script (now `.claude/skills/run-instruction-builder/pwa-check.mjs`)
  that registers the service worker against a real production build (`vite
  preview`) and reloads the page - failed with the exact `net::ERR_FAILED`
  above before the fix, passes cleanly after.
- **Found & fixed:** 2026-09-14 (task 23, Convert to PWA).
