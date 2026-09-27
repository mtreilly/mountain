import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Locale files live in public/ with a stable URL, so browsers can serve a stale copy
// after a deploy. Hashing their contents into the request URL busts that cache.
function localesVersion(dir = "public/locales"): string {
  const hash = createHash("sha256");
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else hash.update(path).update(readFileSync(path));
    }
  };
  walk(dir);
  return hash.digest("hex").slice(0, 10);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __LOCALES_VERSION__: JSON.stringify(localesVersion()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("i18next")) return "i18n-vendor";
          if (id.includes("jszip")) return "thread-vendor";
          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8788",
      "/share": "http://localhost:8788",
    },
  },
});
