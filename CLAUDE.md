# InsightAero

Environment-aware drone mission monitoring: live telemetry over WebSocket, wind-aware speed and battery planning, and AI diagnosis and mission reports. See `README.md` for the full API reference and data models.

- `frontend/`: React 18, TypeScript, Vite, Tailwind, Google Maps, TanStack Query, Zustand, Radix UI, react-i18next (en, zh-TW).
- `backend/`: FastAPI, async SQLAlchemy 2 on PostgreSQL, LangChain + OpenAI, OpenWeather, Google Elevation.

## Commands

```bash
./dev.sh                                              # backend + frontend (needs backend/.venv and frontend/node_modules)

cd backend && uvicorn app.main:app --reload --port 8000   # backend only; needs backend/.env (DATABASE_URL)
cd backend && python -m pytest -q                         # backend tests

cd frontend && npm run dev                            # http://localhost:5173, proxies /api and /ws to :8000
cd frontend && npm run build                          # production build
cd frontend && npx tsc -p tsconfig.app.json           # type check (also checks en/zh-TW keys match)
cd frontend && npm run lint:tokens                    # design-token rules
cd frontend && npm run lint:filenames                 # kebab-case file names
```

Run the frontend checks before committing frontend changes, and pytest before committing backend changes.

## Rules to read before editing

These files are the source of truth. Read the relevant one before changing code in its area.

| Area | File |
| --- | --- |
| Frontend structure, import direction, API file pairs, where state lives, naming | `frontend/src/features/README.md` |
| Colors, tokens, theming | `frontend/src/styles/tokens/README.md` |
| Translations and UI copy | `frontend/src/locales/README.md` |
| PR format | `.github/pull_request_template.md` |

Short version:
- Imports flow shared → features → app. Features never import each other. No `index.ts` barrels.
- Server data lives in TanStack Query; live telemetry lives in the Zustand store, read with selectors.
- No hard-coded colors or primitive tokens in TS/TSX; use semantic Tailwind classes.
- Every UI string goes through `t()` and exists in both `en.ts` and `zh-TW.ts`.
- Files and folders are kebab-case.
- PR titles use `<type>: <summary>` (feat, fix, refactor, style, docs, chore, perf, test).

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
