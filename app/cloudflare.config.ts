import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .env, .env.example. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

export default defineConfig({
  worker: {
    name: "convergence-explorer",
    compatibilityDate: "2026-09-14",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "worker/index.ts",
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: true,
    },
    env: {
      DB: bindings.d1({
        name: "convergence-db",
        id: "e3f335e8-087d-4612-a9f1-ef3e6cce4a3d",
      }),
      ASSETS: bindings.assets(),
    },
  },
});
