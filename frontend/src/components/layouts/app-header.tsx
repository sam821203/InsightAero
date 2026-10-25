import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Satellite, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTheme } from "@/contexts/useTheme";

interface AppHeaderProps {
  /** Status shown before the language and theme controls (e.g. the live-link indicator). */
  status?: ReactNode;
}

export default function AppHeader({ status }: AppHeaderProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-border bg-card/80 px-5 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Satellite className="h-5 w-5 text-foreground" />
        <h1 className="text-base font-semibold tracking-tight text-foreground">InsightAero</h1>
        <span className="border-l border-border pl-3 text-xs text-muted-foreground">{t("app.tagline")}</span>
      </div>

      <div className="flex items-center gap-2">
        {status}
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 text-muted-foreground"
          aria-label={theme === "dark" ? t("app.switchToLight") : t("app.switchToDark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
