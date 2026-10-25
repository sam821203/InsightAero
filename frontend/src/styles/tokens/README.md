# Design tokens

InsightAero uses two layers of tokens, following the shadcn/ui + Tailwind convention.

```
primitives.css   →   semantic.css   →   tailwind.config.ts  →  components (Tailwind classes + cva)
 (raw values)        (roles, themes)    src/lib/tokens.ts   →  Google Maps overlays (JS)
```

| Layer | Answers | Example | Changes with theme? |
|---|---|---|---|
| Primitive | What values exist? | `--gray-900`, `--blue-400`, `--radius-200` | No |
| Semantic | What is this value *for*? | `--color-bg-surface`, `--color-danger-text` | Yes, the only layer that does |

## Why there is no component layer

Large design systems (Material 3, GitHub Primer, antd's Component Tokens) add a third layer of per-component tokens such as `--button-primary-bg`. They need it because the people styling a component cannot edit its source; tokens are the only way in.

Here the component source lives in the repo (`src/components/ui`), so per-component decisions are written directly in the component as Tailwind classes and `cva` variants. A CSS variable in between would only add indirection.

Add a component layer later only if the components are extracted into a shared package, themed per brand, or exported to other platforms.

## Rules

1. **Components never use primitives.** No `var(--blue-400)` in TSX, and Tailwind does not expose primitives, so `bg-blue-400` does not exist.
2. **No hard-coded colors in TS/TSX.** Use a Tailwind class, or `readColorToken()` / `readHexToken()` for APIs that take a color string (Google Maps).
3. **Accent means interactive.** `--color-accent` is for buttons, links, focus and selection. Data values, headings and icons use neutral foreground colors.
4. **Status colors carry meaning.** success = nominal, warning = needs attention, danger = critical or destructive, info = neutral notice. Each has `solid`, `on-solid`, `text`, `subtle` and `border`; use `text` for colored text on a surface.
5. **Numbers use tabular figures.** Live values get `tabular-nums` so digits do not shift as they update.
6. **Sizes and spacing use Tailwind's scale** (`text-xs`, `p-3`). They are not duplicated as tokens.

`npm run lint:tokens` enforces rules 1 and 2.

## Recipes

Copy these when building new UI. Every class below resolves to a semantic token.

### Which color class do I use?

| I want to color... | Use |
|---|---|
| Page background | `bg-background` |
| A card, panel or section | `<Panel>` (or `bg-card border-border`) |
| A dialog, popover, dropdown | `bg-popover shadow-overlay` |
| An inset area inside a panel (list item, input) | `bg-surface-sunken` |
| A selected row | `bg-surface-selected text-interactive-text` |
| Hover on a neutral row or ghost button | `hover:bg-accent` |
| Body text | `text-foreground` |
| Labels, secondary text | `text-muted-foreground` |
| Units, timestamps, placeholders | `text-subtle-foreground` |
| A link | `text-interactive-text` |
| A divider inside a panel | `border-border-subtle` |
| Normal / warning / critical text | `text-success-text` / `text-warning-text` / `text-destructive-text` |
| A status fill (dot, bar) | `bg-success` / `bg-warning` / `bg-destructive` |
| A tinted status box | `bg-<status>-subtle border-<status>-border text-<status>-text` |

### A new sidebar section

```tsx
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function GeofenceList() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>禁航區</PanelTitle>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
          <Plus className="h-3 w-3" />
          新增
        </Button>
      </PanelHeader>
      <ul className="space-y-1 p-2">
        <li className="rounded-md px-2 py-1.5 text-xs hover:bg-accent">松山機場周邊</li>
      </ul>
    </Panel>
  );
}
```

`PanelTitle` renders an `h3` by default; pass `as="h2"` or `as="span"` when the heading level differs.

### Form fields

```tsx
import { Input, NativeSelect } from "@/components/ui/input";

<label className="text-xs text-muted-foreground">任務名稱</label>
<Input size="sm" placeholder="例如：上午巡邏" />

<NativeSelect size="sm" value={droneId} onChange={(e) => setDroneId(e.target.value)}>
  <option value="">選擇無人機</option>
</NativeSelect>

{error && <p className="text-xs text-destructive-text">{error}</p>}
```

Sizes: `default` (36px) and `sm` (28px). Layout classes (`flex-1`, `w-16`, `mt-1`) go in `className`; colors and borders come from the component.

### Buttons by intent

| Intent | Variant |
|---|---|
| The one main action in a form or dialog | `default` |
| Secondary action (pause, resume, cancel) | `secondary` or `outline` |
| Low-emphasis action in a list or toolbar | `ghost` |
| Destructive action that is the main action (confirm delete) | `destructive` |
| Destructive action sitting next to other actions | `destructive-outline` |
| Inline text action | `link` |

Keep one `default` button per area so the main action stays obvious.

### A status badge (new component with cva)

When several screens need the same status styling, make a component instead of repeating classes:

```tsx
// src/components/ui/status-badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info-border bg-info-subtle text-info-text",
        success: "border-success-border bg-success-subtle text-success-text",
        warning: "border-warning-border bg-warning-subtle text-warning-text",
        danger: "border-destructive-border bg-destructive-subtle text-destructive-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const dotColor = {
  neutral: "bg-border-strong",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

type Tone = keyof typeof dotColor;

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: VariantProps<typeof statusBadgeVariants> & { className?: string; children: React.ReactNode }) {
  const key: Tone = tone ?? "neutral";
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[key])} />
      {children}
    </span>
  );
}
```

Map domain states to tones in one place:

```tsx
const TASK_TONE: Record<TaskStatus, Tone> = {
  pending: "neutral",
  starting: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "neutral",
  failed: "danger",
};

<StatusBadge tone={TASK_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</StatusBadge>
```

This is where component-level decisions live in this project: in the component's `cva` variants, not in CSS variables.

### Live numbers

```tsx
<span className="text-xs font-medium text-muted-foreground">電量</span>
<span className="text-2xl font-semibold tabular-nums text-foreground">{battery.toFixed(1)}%</span>
<span className="text-xs text-subtle-foreground">m/min</span>

<span className="font-mono text-xs text-subtle-foreground">25.0330, 121.5654</span>
```

Always add `tabular-nums` to values that update; use `font-mono` only for coordinates, IDs and timestamps.

### Threshold colors

```tsx
type Level = "nominal" | "warning" | "critical";

const level: Level = battery > 60 ? "nominal" : battery > 25 ? "warning" : "critical";

const textClass = { nominal: "text-foreground", warning: "text-warning-text", critical: "text-destructive-text" }[level];
const fillClass = { nominal: "bg-success", warning: "bg-warning", critical: "bg-destructive" }[level];
```

A nominal value stays neutral; color only appears when something needs attention.

### Colors in JavaScript (Google Maps)

```ts
import { readColorToken, readHexToken } from "@/lib/tokens";
import { useTheme } from "@/contexts/use-theme";

const { theme } = useTheme();

polyline.setOptions({ strokeColor: readColorToken("color-map-route-active", theme) }); // "hsl(...)"
const fill = readHexToken("color-map-waypoint", theme); // "#rrggbb", for SVG data URLs and map styles
```

Pass the theme explicitly and include `theme` in the effect's dependency array so colors update on toggle. Tokens are read from a hidden element with that theme's class, because child effects run before `ThemeProvider` updates `<html>`.

### Do and don't

| Don't | Do | Why |
|---|---|---|
| `text-[#ef4444]`, `style={{ color: "#ef4444" }}` | `text-destructive-text` | Hard-coded colors ignore the theme |
| `var(--red-500)` in a component | `text-destructive-text` | Primitives skip the theme layer |
| `text-primary` on a heading or number | `text-foreground` | Accent is reserved for interaction |
| `text-destructive` for red text | `text-destructive-text` | `destructive` is a fill color and fails contrast as text in dark mode |
| `bg-destructive/10` | `bg-destructive-subtle` | Opacity tints look different on each surface |
| A new `.my-card` class in `index.css` | A component with Tailwind classes or `cva` | Keeps styling next to the markup, like `components/ui` |
| A new CSS variable for one component | Classes in that component | Tokens are for shared meaning |

## Tailwind name mapping

The shadcn/ui names are kept so `src/components/ui` matches upstream shadcn components.

| Tailwind color | Token |
|---|---|
| `background` | `--color-bg-canvas` |
| `foreground` | `--color-fg-default` |
| `card` | `--color-bg-surface` |
| `popover` | `--color-bg-surface-raised` |
| `primary` (+ `primary-hover`) | `--color-accent` (+ `--color-accent-hover`) |
| `secondary` | `--color-bg-muted` |
| `muted` / `muted-foreground` | `--color-bg-muted` / `--color-fg-muted` |
| `accent` | `--color-bg-hover` (neutral hover, not the brand color) |
| `input`, `border` | `--color-border-default` |
| `ring` | `--color-focus-ring` |
| `destructive`, `success`, `warning`, `info` | `--color-<status>-solid`, plus `-text`, `-subtle`, `-border`, `-foreground` |
| `surface`, `surface-raised`, `surface-sunken`, `surface-selected` | `--color-bg-*` |
| `subtle-foreground`, `disabled-foreground` | `--color-fg-subtle`, `--color-fg-disabled` |
| `interactive`, `interactive-text`, `interactive-subtle` | `--color-accent*` |
| `border-subtle`, `border-strong` | `--color-border-*` |

## Adding a token

First decide which case you are in:

- **A one-off style for a single component**: write it in the component with Tailwind classes. Do not add a token.
- **A new raw value** (a new gray step, a new radius): add a primitive.
- **A new meaning shared across the app** (a new surface, a new status): add a semantic token.

### Example: a "restricted airspace" color

1. If the palette lacks the hue, add primitives in `primitives.css`:

   ```css
   --purple-300: 270 85% 76%;
   --purple-600: 270 60% 48%;
   --purple-700: 270 60% 40%;
   ```

2. Add the role to **both** theme blocks in `semantic.css`:

   ```css
   :root, .dark {
     --color-restricted: var(--purple-300);
   }
   .light {
     --color-restricted: var(--purple-700);
   }
   ```

3. Map it in `tailwind.config.ts` under `theme.extend.colors`:

   ```ts
   restricted: token("color-restricted"),
   ```

4. Use it: `text-restricted`, `border-restricted`, `bg-restricted/10`, or `readColorToken("color-restricted", theme)` for the map.

5. Check contrast for any text use (4.5:1 against `--color-bg-surface` in both themes) and run `npm run lint:tokens`.

### Example: changing the brand color

Only `semantic.css` changes. Point the accent roles at a different primitive scale in both blocks:

```css
:root, .dark {
  --color-accent: var(--green-400);
  --color-accent-hover: var(--green-300);
  --color-accent-text: var(--green-300);
  --color-accent-subtle: var(--green-950);
  --color-focus-ring: var(--green-400);
}
```

Buttons, links, focus rings, selected rows and the active map route all follow, because none of them reference a color directly.

## Contrast

Text pairs meet WCAG AA (4.5:1) in both themes: default, muted and status text on surfaces, text on accent and danger buttons, accent text on selected rows. `--color-fg-subtle` (about 4:1) is for secondary details such as units and placeholders, not body text.
