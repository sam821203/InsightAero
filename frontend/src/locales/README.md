# Translations

The UI supports English (`en`, default) and Traditional Chinese (`zh-TW`), using [react-i18next](https://react.i18next.com/).

```
src/i18n/index.ts        i18next setup, supported languages, persistence
src/i18n/i18next.d.ts    makes t() keys type-checked against en.ts
src/locales/en.ts        source of truth
src/locales/zh-TW.ts     must match en.ts key for key (enforced by the Messages type)
src/lib/format.ts        locale-aware date and time formatting
```

## Adding a string

1. Add the key to `en.ts` under the feature it belongs to:

   ```ts
   tasks: {
     duplicate: "Duplicate",
   },
   ```

2. Add the same key to `zh-TW.ts`. TypeScript reports an error until you do.

3. Use it in a component:

   ```tsx
   import { useTranslation } from "react-i18next";

   const { t } = useTranslation();
   <Button>{t("tasks.duplicate")}</Button>
   ```

A misspelled key is a type error, so typos don't reach the screen.

## Patterns

**Variables** use `{{name}}`:

```ts
untitled: "Mission #{{id}}",
```

```tsx
t("tasks.untitled", { id: task.id });
```

**Values from the API** (task status, drone status) map to keys with a template literal. The literal type keeps it type-checked:

```tsx
t(`status.task.${task.status}`);
```

**Dates and times** go through `src/lib/format.ts`, never `toLocaleString()` without a language:

```tsx
const { i18n } = useTranslation();
formatDateTime(task.created_at, i18n.language);
```

**Store keys, not translated text.** Anything kept in state (like the AI log) should store the key and params and translate when rendering, so switching languages updates it.

**Outside React** (Google Maps info windows built as HTML strings), import the instance: `import i18n from "@/i18n"` and call `i18n.t(...)`.

## Not translated

- The product name "InsightAero".
- Language names in the switcher, which are shown in their own language (EN, 繁中).
- Text that comes from the backend: AI diagnosis, mission reports and API error messages. These are still Chinese and will be handled in a separate change.
- Data entered by users, such as mission and drone names.

## Writing English copy

English is the default language, so write it first and write it well: sentence case ("New mission", not "New Mission"), short labels, and plain wording a drone operator would use.
