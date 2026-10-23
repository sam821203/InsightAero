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

## Using tokens

```tsx
<Panel>
  <PanelHeader>
    <PanelTitle>任務列表</PanelTitle>
  </PanelHeader>
</Panel>

<Input size="sm" />
<Button variant="destructive-outline">終止</Button>
<span className="text-destructive-text">     {/* --color-danger-text */}
<div className="bg-surface-sunken border-border-subtle">
```

JavaScript (Google Maps overlays):

```ts
import { readColorToken } from "@/lib/tokens";

polyline.setOptions({ strokeColor: readColorToken("color-map-route-active", theme) });
```

Pass the theme explicitly. Tokens are read from a hidden element with that theme's class, because child effects run before `ThemeProvider` updates `<html>` on a theme toggle.

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

- New raw value (a new gray step, a new radius): add a primitive.
- New meaning (a new surface, a new status): add a semantic token in **both** the dark and the light block, then map it in `tailwind.config.ts`.
- A one-off style for a single component: write it in the component with Tailwind classes; do not add a token.

## Contrast

Text pairs meet WCAG AA (4.5:1) in both themes: default, muted and status text on surfaces, text on accent and danger buttons, accent text on selected rows. `--color-fg-subtle` (about 4:1) is for secondary details such as units and placeholders, not body text.
