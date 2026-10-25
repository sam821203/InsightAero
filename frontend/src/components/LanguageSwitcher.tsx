import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, type Language } from "@/i18n";

/*
 * Shown in their own language so each option is readable whichever language
 * is active. `name` is announced by screen readers instead of the short label.
 */
const LANGUAGE_LABEL: Record<Language, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  "zh-TW": { short: "繁中", name: "繁體中文" },
};

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className="inline-flex items-center rounded-md border border-border p-0.5"
    >
      {SUPPORTED_LANGUAGES.map((language) => {
        const active = i18n.resolvedLanguage === language;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={active}
            aria-label={LANGUAGE_LABEL[language].name}
            title={LANGUAGE_LABEL[language].name}
            onClick={() => i18n.changeLanguage(language)}
            className={cn(
              "rounded-sm px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LANGUAGE_LABEL[language].short}
          </button>
        );
      })}
    </div>
  );
}
