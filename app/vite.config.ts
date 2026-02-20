import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
