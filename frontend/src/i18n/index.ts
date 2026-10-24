import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en";
import zhTW from "@/locales/zh-TW";

export const SUPPORTED_LANGUAGES = ["en", "zh-TW"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

const STORAGE_KEY = "insightaero-language";

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
  return DEFAULT_LANGUAGE;
}

function applyLanguage(language: string) {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore: the choice just won't persist.
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-TW": { translation: zhTW },
  },
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false, // React already escapes rendered values.
  },
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", applyLanguage);

export default i18n;
