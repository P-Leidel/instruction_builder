import { render } from "preact";
import { App } from "./app";
import { initPersistence } from "./state/persistence";
import "./styles/global.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("#app element not found in index.html");
}

// Task 12: resolve any previously-saved document before the first render,
// so the default empty document never flashes on screen only to be
// replaced a moment later once the (async) IndexedDB read completes.
initPersistence().finally(() => {
  render(<App />, root);
});
