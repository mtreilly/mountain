import { useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

function getPreferredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  useEffect(() => {
    const transitionGuard = document.createElement("style");
    transitionGuard.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.append(transitionGuard);
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("theme", theme);

    // Commit the color-scheme swap as a single frame so surfaces do not smear.
    void document.body.offsetHeight;
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => transitionGuard.remove());
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      transitionGuard.remove();
    };
  }, [theme]);

  const toggleTheme = useMemo(() => () => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggleTheme };
}
