# InsightAero for Claude Code

@AGENTS.md

## Subagents

| When the diff touches | Use |
| --- | --- |
| The live telemetry path: `use-telemetry-connection.ts`, `telemetry-store.ts`, `live-map-view.tsx`, `google-map-view.tsx`, `telemetry-hud.tsx`, the dashboard route, or any component reading `useTelemetryStore` | `realtime-perf-reviewer` |
| `backend/app/schemas/`, `backend/app/api/`, packets in `services/simulator.py`, `frontend/src/types/`, or any `*.api.ts` | `api-contract-checker` |

Pass them the changed files (`git diff --name-only origin/main...HEAD`); they can't run commands.

Skip them when the change is a few lines in one or two files; review it yourself. Use them for wider changes, and before opening a PR that touches either area.
