import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en";
import zhTW from "@/locales/zh-TW";

export const SUPPORTED_LANGUAGES = ["en", "zh-TW"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-TW": { translation: zhTW },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      // Only a saved choice counts; the browser language is ignored so the
      // default stays English. Add "navigator" here to follow the browser.
      order: ["localStorage"],
      lookupLocalStorage: "insightaero-language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // React already escapes rendered values.
    },
  });

const syncHtmlLang = (language: string) => {
  document.documentElement.lang = language;
};

syncHtmlLang(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
