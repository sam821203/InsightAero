# Features

Code is grouped by feature, following
[bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md).
A feature owns everything only it uses; anything shared lives in the
top-level folders (`components/`, `api/`, `hooks/`, `lib/`, `stores/`, `types/`).

```
features/<name>/
  api/         requests and their hooks (see "API files" below)
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
  missions and the map, so reading them (`api/drones.api.ts` + `api/drones.queries.ts`)
  is shared, while drone writes live in `features/fleet/api/`. The mission list
  works the same way: `api/tasks.api.ts` + `api/tasks.queries.ts` are shared
  (missions tab, map, AI navigator), mission actions and details live in
  `features/missions/api/`. Query keys stay in `api/query-keys.ts`
  so any feature can invalidate them.
- **Import files directly**, not through `index.ts` barrels (barrels hurt Vite's
  tree shaking and create import cycles).

## API files

Each feature's `api/` folder has two files, named after the feature:

| File | Contains | Must not import |
| --- | --- | --- |
| `<feature>.api.ts` | Request functions (path, method, body) and response types | React, TanStack Query |
| `<feature>.queries.ts` | Query options, `useQuery` / `useMutation` hooks, cache invalidation and other logic around the data | — |

```
features/flight-history/api/
  flight-history.api.ts        getFlightSessions(), getSessionTelemetry(), FlightSessionItem
  flight-history.queries.ts    flightSessionsQueryOptions(), useFlightSessions(), useLoadFlightPath()
```

Request files stay plain async functions, so they can be called from tests,
loaders or scripts without React. The `.queries.ts` name follows the TanStack
Query "query options" style; it holds a feature's mutations too, so each
feature has exactly one place for its data hooks.

The shared `src/api/` folder uses the same pair, named after the resource
(`drones.api.ts` + `drones.queries.ts`), since it isn't owned by one feature.

## Naming

All files and folders are kebab-case, as in bulletproof-react
(`fleet-list.tsx`, `use-user-location.ts`). What a file exports keeps its
normal casing (`export default function FleetList`, `export function useDrones`).
`npm run lint:filenames` checks this.

## Where state lives

Ask in order; the first "yes" decides.

| Question | Use | Examples here |
| --- | --- | --- |
| Does the data come from the backend? | **TanStack Query**. Don't copy it anywhere else; derive with `select` or `useMemo`. | missions, drones, flight history, mission detail and report |
| Can it be computed from state that already exists? | **Don't store it.** Compute it. | "mission in flight" (`useMissionInFlight` selects it from the mission list) |
| Is it used by one component or a small subtree? | **`useState`**, lifted only as far as needed. | dialog open state and selected mission (`MissionsPanel`), sidebar width (`ResizableSidebar`), current tab (dashboard) |
| Is it rarely changing and needed app-wide? | **Context.** | theme (language is handled by i18next) |
| Is it shared widely, updated often, or produced outside React? | **Zustand** with selectors. | live telemetry from the WebSocket (`stores/telemetry-store.ts`) |

## Status

| Feature | Folder |
| --- | --- |
| Fleet | `features/fleet` |
| Flight history | `features/flight-history` |
| Missions | `features/missions` |
| Telemetry | not moved yet |
| Map | not moved yet |
| AI navigator | not moved yet |
