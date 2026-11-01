# InsightAero

Instructions for AI coding agents (Claude Code, Cursor, Codex, Copilot and others) and for people. Tool-specific files (`CLAUDE.md`, `.cursor/rules/`) point here instead of repeating it.

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

## Where enforcement lives

The scripts above are the real check, whichever tool wrote the code. Run them before every commit; if a rule here and a script disagree, fix the script or this file, not just the code.

## Tool-specific extras

- Claude Code: `CLAUDE.md` (imports this file) and project subagents in `.claude/agents/`.
- Cursor: `.cursor/rules/` (points to this file and the rule READMEs).
