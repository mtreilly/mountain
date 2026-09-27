import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// Injected by vite.config.ts; absent under tools that skip that config.
declare const __LOCALES_VERSION__: string | undefined;
const localesVersion = typeof __LOCALES_VERSION__ === "string" ? __LOCALES_VERSION__ : "dev";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    cleanCode: true,
    debug: false,
    interpolation: { escapeValue: false },
    backend: { loadPath: `/locales/{{lng}}/{{ns}}.json?v=${localesVersion}` },
  });
