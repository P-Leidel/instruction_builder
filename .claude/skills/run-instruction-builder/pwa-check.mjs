// PWA verification for the Visual Instruction Builder (task 23).
// Usage: node pwa-check.mjs [previewUrl]
//
// Unlike driver.mjs (which drives the dev server - the service worker is
// deliberately NOT registered there, see main.tsx), this needs a real
// PRODUCTION build served statically: `npm run build && npm run preview --
// --port 4173 --strictPort`, then run this script. The service worker,
// hashed asset filenames, and offline behavior it checks only exist in that
// build - `npm run dev`'s unhashed, live-reloading modules aren't it.
import { chromium } from "playwright";

// Named PREVIEW_URL, not URL - driver.mjs's own top-level `URL` constant
// shadows the global URL constructor for its whole module (see its
// Gotchas entry in SKILL.md); naming it differently here avoids needing
// the same workaround.
const PREVIEW_URL = process.argv[2] ?? "http://localhost:4173/";

const browser = await chromium.launch();
const context = await browser.newContext();
const requestFailures = [];
const page = await context.newPage();
page.on("requestfailed", (req) => {
  requestFailures.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
});

await page.goto(PREVIEW_URL);
await page.waitForSelector(".instruction-canvas__svg");

// Manifest + icons are reachable (the basic installability signals beyond
// the service worker itself).
const manifestOk = (await page.request.get(new URL("manifest.webmanifest", PREVIEW_URL).href)).ok();
const icon192Ok = (await page.request.get(new URL("icons/icon-192.png", PREVIEW_URL).href)).ok();
const icon512Ok = (await page.request.get(new URL("icons/icon-512.png", PREVIEW_URL).href)).ok();
const iconMaskableOk = (await page.request.get(new URL("icons/icon-maskable-512.png", PREVIEW_URL).href)).ok();
const manifestAndIconsReachable = manifestOk && icon192Ok && icon512Ok && iconMaskableOk;

// The very first navigation that registers a service worker is never
// itself SW-controlled (standard lifecycle - install/activate happens as a
// side effect of that load, too late to intercept it), so wait for control
// and then reload once more to simulate a real second visit - the one
// that's actually SW-driven and populates the runtime cache.
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 });
await page.reload();
await page.waitForSelector(".instruction-canvas__svg");
await page.waitForTimeout(300); // let event.waitUntil's cache writes finish

const cachedUrls = await page.evaluate(async () => {
  const cache = await caches.open("instruction-builder-v1");
  return (await cache.keys()).map((k) => new URL(k.url).pathname);
});
const shellIsCached = cachedUrls.includes("/");

// The actual point of task 23: reload with no network at all.
await context.setOffline(true);
let appLoadsOffline = false;
try {
  await page.reload();
  appLoadsOffline = (await page.locator(".instruction-canvas__svg").count()) > 0;
} catch {
  appLoadsOffline = false;
}
await context.setOffline(false);

await browser.close();

console.log("MANIFEST_AND_ICONS_REACHABLE=" + manifestAndIconsReachable);
console.log("SHELL_CACHED_AFTER_SECOND_VISIT=" + shellIsCached);
console.log("CACHED_URLS=" + JSON.stringify(cachedUrls));
console.log("APP_LOADS_WHILE_OFFLINE=" + appLoadsOffline);
console.log("REQUEST_FAILURES_COUNT=" + requestFailures.length);
for (const f of requestFailures) console.log("[requestfailed] " + f);
