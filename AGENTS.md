# InsightAero

Instructions for AI coding agents. Drone mission monitoring: FastAPI backend in `backend/`, React + Vite frontend in `frontend/`, live telemetry over the `/ws/telemetry` WebSocket.

## Commands

```bash
./dev.sh                                      # backend + frontend; start the backend first if running them separately
cd backend && python -m pytest -q             # backend tests
cd frontend && npx tsc -p tsconfig.app.json   # type check (no npm script for it); also checks en/zh-TW keys match
cd frontend && npm run lint:tokens            # design-token rules
cd frontend && npm run lint:filenames         # kebab-case file names
```

Run the frontend checks before committing frontend changes, and pytest before committing backend changes.

## Rules

Read the matching file before changing code in its area. They are the source of truth.

| Area | File |
| --- | --- |
| Frontend structure, import direction, API file pairs, where state lives | `frontend/src/features/README.md` |
| Colors, tokens, theming | `frontend/src/styles/tokens/README.md` |
| Translations and UI copy | `frontend/src/locales/README.md` |
| PR format | `.github/pull_request_template.md` |

Not caught by any script, and fixed by hand before (PRs #9 to #13):
- Imports flow shared → features → app. Features never import each other.
- Server data stays in TanStack Query; don't copy it into `useState`, Zustand or context.
