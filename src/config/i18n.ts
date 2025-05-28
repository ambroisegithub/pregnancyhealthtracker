import i18n from "i18next"
import Backend from "i18next-fs-backend"
import { LanguageDetector } from "i18next-express-middleware"

i18n
  .use(Backend)
  .use(LanguageDetector)
  .init({
    fallbackLng: "en",
    debug: process.env.NODE_ENV === "development",

    // Language detection options
    detection: {
      order: ["header", "querystring", "cookie"],
      caches: ["cookie"],
      lookupHeader: "accept-language",
      lookupQuerystring: "lng",
      lookupCookie: "i18next",
    },

    // Backend options
    backend: {
      loadPath: "./locales/{{lng}}/{{ns}}.json",
    },

    // Interpolation options
    interpolation: {
      escapeValue: false,
    },

    // Supported languages
    supportedLngs: ["en", "fr", "rw"],

    // Default namespace
    defaultNS: "translation",
    ns: ["translation"],
  })

export default i18n
