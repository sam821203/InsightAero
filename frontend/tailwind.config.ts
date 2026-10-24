import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Tailwind reads semantic tokens only (see src/styles/tokens/README.md).
 * Primitive tokens are intentionally not exposed, so a class like
 * `bg-blue-400` cannot bypass the theme.
 *
 * The shadcn/ui color names (background, card, primary, muted, accent, ...)
 * are kept so the components in src/components/ui keep working; they are
 * aliases onto the semantic roles.
 */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-code)"],
      },
      colors: {
        /* shadcn aliases -> semantic roles */
        background: token("color-bg-canvas"),
        foreground: token("color-fg-default"),
        border: token("color-border-default"),
        input: token("color-border-default"),
        ring: token("color-focus-ring"),
        card: {
          DEFAULT: token("color-bg-surface"),
          foreground: token("color-fg-default"),
        },
        popover: {
          DEFAULT: token("color-bg-surface-raised"),
          foreground: token("color-fg-default"),
        },
        primary: {
          DEFAULT: token("color-accent"),
          hover: token("color-accent-hover"),
          foreground: token("color-fg-on-accent"),
        },
        secondary: {
          DEFAULT: token("color-bg-muted"),
          hover: token("color-border-strong"),
          foreground: token("color-fg-default"),
        },
        muted: {
          DEFAULT: token("color-bg-muted"),
          foreground: token("color-fg-muted"),
        },
        accent: {
          DEFAULT: token("color-bg-hover"),
          foreground: token("color-fg-default"),
        },
        destructive: {
          DEFAULT: token("color-danger-solid"),
          foreground: token("color-danger-on-solid"),
          text: token("color-danger-text"),
          subtle: token("color-danger-subtle"),
          border: token("color-danger-border"),
        },

        /* Semantic roles without a shadcn equivalent */
        surface: {
          DEFAULT: token("color-bg-surface"),
          raised: token("color-bg-surface-raised"),
          sunken: token("color-bg-sunken"),
          selected: token("color-bg-selected"),
        },
        subtle: {
          foreground: token("color-fg-subtle"),
        },
        disabled: {
          foreground: token("color-fg-disabled"),
        },
        "border-subtle": token("color-border-subtle"),
        "border-strong": token("color-border-strong"),
        interactive: {
          DEFAULT: token("color-accent"),
          text: token("color-accent-text"),
          subtle: token("color-accent-subtle"),
        },
        success: {
          DEFAULT: token("color-success-solid"),
          foreground: token("color-success-on-solid"),
          text: token("color-success-text"),
          subtle: token("color-success-subtle"),
          border: token("color-success-border"),
        },
        warning: {
          DEFAULT: token("color-warning-solid"),
          foreground: token("color-warning-on-solid"),
          text: token("color-warning-text"),
          subtle: token("color-warning-subtle"),
          border: token("color-warning-border"),
        },
        info: {
          DEFAULT: token("color-info-solid"),
          foreground: token("color-info-on-solid"),
          text: token("color-info-text"),
          subtle: token("color-info-subtle"),
          border: token("color-info-border"),
        },
        backdrop: token("color-bg-backdrop"),
      },
      borderRadius: {
        sm: "var(--radius-inline)",
        md: "var(--radius-control)",
        lg: "var(--radius-container)",
        xl: "var(--radius-overlay)",
      },
      boxShadow: {
        raised: "var(--elevation-raised)",
        overlay: "var(--elevation-overlay)",
      },
      transitionDuration: {
        fast: "var(--motion-duration-fast)",
        DEFAULT: "var(--motion-duration-base)",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--motion-ease)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
