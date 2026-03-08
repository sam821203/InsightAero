const STORAGE_KEY = "insightaero-theme";

export type Theme = "dark" | "light";

/** 從 localStorage 讀取已儲存的 theme，供同步初始化（例如地圖建立時）使用 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
