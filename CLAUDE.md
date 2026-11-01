# InsightAero for Claude Code

@AGENTS.md

## Subagents

Project subagents live in `.claude/agents/`. Use them as below; when a change fits several rows, run the matching agents in parallel. The reviewers only report findings, so act on what they return.

| When | Use | What it does |
| --- | --- | --- |
| Changing anything on the live telemetry path: `hooks/use-telemetry-connection.ts`, `stores/telemetry-store.ts`, `live-map-view.tsx`, `google-map-view.tsx`, `telemetry-hud.tsx`, the dashboard route, or any component that reads `useTelemetryStore` | `realtime-perf-reviewer` | Checks selectors, re-renders per packet, map object reuse, WebSocket reconnect and cleanup |
| Changing `backend/app/schemas/`, `backend/app/api/`, the packets built in `services/simulator.py`, `frontend/src/types/`, or any `*.api.ts` file | `api-contract-checker` | Compares backend and frontend fields, types, nullability and status enums |
| Adding or restyling components, or touching `components/ui/`, `styles/tokens/`, `tailwind.config.ts` | `ui-consistency-reviewer` | Checks token use, reuse of `components/ui` primitives, light and dark themes, Radix accessibility |
| Adding, moving or renaming frontend files, creating a feature, or adding a new store, context or query | `feature-boundary-guard` | Checks folder placement, import direction, API file pairs and state placement |
| Changing the AI diagnosis, AI navigator or mission report flow: `diagnosis_service.py`, `env_diagnosis.py`, `env_tools.py`, `ai_report.py`, `task_report.py`, `prompts/`, `ai-diagnostic-panel.tsx`, `ai-floating-navigator.tsx`, `task-detail-dialog.tsx` | `ai-output-handler-reviewer` | Checks timeouts, fallbacks, loading and error states, stale results, safe rendering |
| Adding or changing code in `backend/app/services/` or `backend/app/api/`, or asked to add tests | `backend-test-writer` | Writes and runs pytest tests in the existing style |
| Adding or changing user-facing text, or asked to translate | `i18n-translator` | Moves literals into `en.ts` and writes the zh-TW copy |

Before opening a PR, run each reviewer whose row matches the diff, fix what they report as must-fix, and mention anything left in the PR's Notes section.

Don't use a subagent for checks that already have a script (`lint:tokens`, `lint:filenames`, `tsc`, `pytest`); run the script.
