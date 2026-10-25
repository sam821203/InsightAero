# Features

Code is grouped by feature, following
[bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md).
A feature owns everything only it uses; anything shared lives in the
top-level folders (`components/`, `api/`, `hooks/`, `lib/`, `stores/`, `types/`).

```
features/<name>/
  api/         one file per request: the request function + its query/mutation hook
  components/  UI used only by this feature
  hooks/       hooks used only by this feature
  stores/      state used only by this feature
  types/       types used only by this feature
```

Only add the folders a feature needs.

## Rules

- **Code flows one way: shared → features → app.**
  Shared folders never import from `features/` or `app/`; features never import from `app/`.
- **Features don't import each other.** When two features need to work together,
  `app/` composes them (e.g. the dashboard passes the selected flight path from
  flight history to the map).
- **Data read by several features stays shared.** Drones are listed by fleet,
  missions and the map, so `api/drones.ts` (query) is shared, while drone
  writes live in `features/fleet/api/`. Query keys stay in `api/queryKeys.ts`
  so any feature can invalidate them.
- **Import files directly**, not through `index.ts` barrels (barrels hurt Vite's
  tree shaking and create import cycles).

## Naming

Components are `PascalCase.tsx`; everything else is `camelCase.ts`, matching
the rest of the project. API files are named after the request
(`getFlightSessions.ts`, `createDrone.ts`).

## Status

| Feature | Folder |
| --- | --- |
| Fleet | `features/fleet` |
| Flight history | `features/flight-history` |
| Missions | not moved yet (`components/Task*`, `hooks/useTasks.ts`) |
| Telemetry | not moved yet |
| Map | not moved yet |
| AI navigator | not moved yet |
