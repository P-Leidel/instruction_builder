import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Vercel serves this app at the domain root.
export default defineConfig({
  base: "/",
  plugins: [preact()],
});
