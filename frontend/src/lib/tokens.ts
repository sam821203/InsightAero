import type { Theme } from "@/contexts/themeStorage";

/**
 * Read design tokens from CSS so JavaScript-drawn UI (Google Maps polylines,
 * info windows, marker icons) uses the same values as the rest of the app.
 *
 * Values are read from a hidden probe element carrying the requested theme
 * class instead of from <html>. When the theme toggles, child effects run
 * before ThemeProvider updates the <html> class, so reading from <html>
 * would return the previous theme's colors.
 */

const probes: Partial<Record<Theme, HTMLElement>> = {};

function getProbe(theme: Theme): HTMLElement {
  const existing = probes[theme];
  if (existing && existing.isConnected) return existing;
  const el = document.createElement("div");
  el.className = theme;
  el.setAttribute("aria-hidden", "true");
  el.style.display = "none";
  document.body.appendChild(el);
  probes[theme] = el;
  return el;
}

function readChannels(name: string, theme: Theme): string {
  const value = getComputedStyle(getProbe(theme)).getPropertyValue(`--${name}`).trim();
  if (!value) {
    throw new Error(`Design token --${name} is not defined`);
  }
  return value;
}

function parseChannels(channels: string): [number, number, number] {
  const [h, s, l] = channels.split(/\s+/).map((part) => parseFloat(part));
  return [h, s, l];
}

/** CSS color string, e.g. "hsl(210 88% 62%)". Accepted by Polyline/Circle options. */
export function readColorToken(name: string, theme: Theme): string {
  return `hsl(${readChannels(name, theme)})`;
}

/** "#rrggbb". Needed where an API only accepts hex (Maps styles, SVG data URLs). */
export function readHexToken(name: string, theme: Theme): string {
  const [h, s, l] = parseChannels(readChannels(name, theme));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
