import { render } from "preact";
import { App } from "./app";
import { initPersistence } from "./state/persistence";
import { startViewportTracking } from "./state/canvas";
import "./styles/global.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app element not found in index.html");
}

// Synchronous and ahead of the render below on purpose: `isDesktop`
// defaults to desktop at import (state/canvas.ts touches no DOM there, so
// the node test env can load it), and seeding it from the real viewport
// only after the first paint would flash a desktop canvas at a phone.
startViewportTracking();

// Task 12: resolve any previously-saved document before the first render,
// so the default empty document never flashes on screen only to be
// replaced a moment later once the (async) IndexedDB read completes.
initPersistence().finally(() => {
  render(<App />, root);
});

// Task 23 (Convert to PWA): registered only in a production build - the
// dev server's own fast-refreshing, unhashed module URLs are exactly what
// a caching service worker would fight with, so `import.meta.env.PROD`
// keeps `npm run dev` (and this project's Playwright driver, which drives
// the dev server) completely unaffected. Registration failure (an
// unsupported browser, an odd deployment served over plain HTTP) is
// swallowed - offline support is a progressive enhancement, never a
// requirement for the app to work online.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
