import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 26 defines its own global `localStorage`, which is undefined unless Node is started
// with --localstorage-file, and that shadows jsdom's implementation.
if (typeof window.localStorage?.clear !== "function") {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
    } satisfies Storage,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
