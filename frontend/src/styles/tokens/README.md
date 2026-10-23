# Design tokens

InsightAero uses three layers of tokens. Each layer may only read from the layer directly below it.

```
primitives.css   →   semantic.css   →   components.css
 (raw values)        (roles, themes)     (per-component decisions)
                            ↓                    ↓
                  tailwind.config.ts, index.css, src/lib/tokens.ts (JS)
```

| Layer | Answers | Example | Changes with theme? |
|---|---|---|---|
| Primitive | What values exist? | `--gray-900`, `--blue-400`, `--font-size-300` | No |
| Semantic | What is this value *for*? | `--color-bg-surface`, `--color-danger-text` | Yes, the only layer that does |
| Component | What does this component use? | `--button-primary-bg`, `--map-route-active` | Inherits from semantic |

## Rules

1. **Components never use primitives.** No `var(--blue-400)` in TSX or `components.css`. Tailwind does not expose primitives either, so `bg-blue-400` does not exist.
2. **No hard-coded colors in TS/TSX.** Use a Tailwind class backed by a token, or `readColorToken()` / `readHexToken()` for APIs that take a color string (Google Maps).
3. **Accent means interactive.** `--color-accent` is for buttons, links, focus and selection. Data values, headings and icons use the neutral foreground roles.
4. **Status colors carry meaning.** success = nominal, warning = needs attention, danger = critical or destructive, info = neutral notice. Each has `solid`, `on-solid`, `text`, `subtle` and `border` roles; use `text` for colored text on a normal surface, which is the variant checked for contrast.
5. **Numbers use tabular figures.** Telemetry and other live values use `.metric-value` or `tabular-nums` so digits do not shift as they update.

`npm run lint:tokens` enforces rules 1 and 2 and the layer order.

## Using tokens

Tailwind (most UI):

```tsx
<p className="text-muted-foreground">          {/* --color-fg-muted */}
<span className="text-destructive-text">        {/* --color-danger-text */}
<div className="bg-surface-sunken border-border-subtle">
<Button variant="destructive-outline">
```

Component classes in `index.css`: `.panel`, `.panel-header`, `.panel-title`, `.field-input`, `.metric-label`, `.metric-value`, `.metric-unit`, `.status-dot`.

JavaScript (Google Maps overlays):

```ts
import { readColorToken, readHexToken } from "@/lib/tokens";

polyline.setOptions({ strokeColor: readColorToken("map-route-active", theme) });
```

Pass the theme explicitly. Tokens are read from a hidden element with that theme's class, because child effects run before `ThemeProvider` updates `<html>` on a theme toggle.

## Tailwind name mapping

The shadcn/ui names are kept as aliases so `src/components/ui` works unchanged.

| Tailwind color | Token |
|---|---|
| `background` | `--color-bg-canvas` |
| `foreground` | `--color-fg-default` |
| `card` | `--color-bg-surface` |
| `popover` | `--overlay-bg` |
| `muted` / `muted-foreground` | `--color-bg-muted` / `--color-fg-muted` |
| `accent` | `--color-bg-hover` (neutral hover, not the brand color) |
| `primary` | `--button-primary-bg` |
| `secondary` | `--button-secondary-bg` |
| `destructive`, `success`, `warning`, `info` | `--color-<status>-solid`, plus `-text`, `-subtle`, `-border`, `-foreground` |
| `surface`, `surface-raised`, `surface-sunken`, `surface-selected` | `--color-bg-*` |
| `subtle-foreground`, `disabled-foreground` | `--color-fg-subtle`, `--color-fg-disabled` |
| `interactive`, `interactive-text`, `interactive-subtle` | `--color-accent*` |
| `border`, `border-subtle`, `border-strong` | `--color-border-*` |

## Adding a token

- New raw value (a new gray step, a new size): add a primitive.
- New meaning shared by several components: add a semantic token, defined in both the dark and the light block.
- A value only one component needs, or one read from JavaScript: add a component token pointing at a semantic token.

## Contrast

Text pairs meet WCAG AA (4.5:1) in both themes: default, muted and status text on surfaces, text on accent and danger buttons, accent text on selected rows. `--color-fg-subtle` (about 4:1) is for secondary details such as units and placeholders, not body text.
