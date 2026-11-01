# InsightAero for Claude Code

@AGENTS.md

## Subagents

Project subagents live in `.claude/agents/`. Use them as below; when a change fits several rows, run the matching agents in parallel. The reviewers only report findings, so act on what they return. They have no shell, so pass them the list of changed files (from `git diff --name-only origin/main...HEAD`) and run the lint, type and test scripts yourself.

| When | Use | What it does |
| --- | --- | --- |
| Changing anything on the live telemetry path: `hooks/use-telemetry-connection.ts`, `stores/telemetry-store.ts`, `live-map-view.tsx`, `google-map-view.tsx`, `telemetry-hud.tsx`, the dashboard route, or any component that reads `useTelemetryStore` | `realtime-perf-reviewer` | Checks selectors, re-renders per packet, map object reuse, WebSocket reconnect and cleanup |
| Changing `backend/app/schemas/`, `backend/app/api/`, the packets built in `services/simulator.py`, `frontend/src/types/`, or any `*.api.ts` file | `api-contract-checker` | Compares backend and frontend fields, types, nullability and status enums |
| Adding or changing code in `backend/app/services/` or `backend/app/api/`, or asked to add tests | `backend-test-writer` | Writes and runs pytest tests in the existing style |

Before opening a PR, run each reviewer whose row matches the diff, fix what they report as must-fix, and mention anything left in the PR's Notes section.

For structure, design tokens and UI text there is no subagent: follow the rule READMEs listed in `AGENTS.md` and run the scripts. Add a subagent only when a real need shows up.

Don't use a subagent for checks that already have a script (`lint:tokens`, `lint:filenames`, `tsc`, `pytest`); run the script.

## Safety settings

`.claude/settings.json` applies to the main session and every subagent: it denies reading or editing real `.env` files and blocks destructive git and `rm -rf` commands, and a `PreToolUse` hook (`.claude/hooks/block-env.mjs`) stops shell commands that touch `.env` files. `.env.example` stays readable.
