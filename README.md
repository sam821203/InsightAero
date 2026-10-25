# InsightAero

**Environment-aware drone mission monitoring platform**: real-time telemetry over WebSocket, OpenWeather integration, effective speed correction, and AI-powered mission navigation with closing reports.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Physical Structure](#physical-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Dependency Graph](#dependency-graph)

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Google Maps JavaScript API, TanStack Query, Zustand, Radix UI, Lucide, react-i18next (English / Traditional Chinese) |
| **Backend** | FastAPI, SQLAlchemy 2 (async), PostgreSQL (e.g. Neon), Uvicorn |
| **Realtime** | WebSocket (`/ws/telemetry`) for live telemetry push |
| **External** | OpenWeather API (wind), LangChain + OpenAI (reports & diagnosis), Google Maps Elevation API (optional) |

---

## Physical Structure

```
InsightAero/
├── README.md
├── dev.sh                    # One-shot script to run backend + frontend
├── .vscode/
│   └── settings.json
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── .env.example
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── drone-marker.svg
│   │   └── map-marker-flag-icon.svg
│   └── src/
│       ├── main.tsx          # entry: fonts, i18n, global CSS, <App />
│       ├── index.css
│       ├── app/              # application layer: composes everything below
│       │   ├── index.tsx     # <App />
│       │   ├── provider.tsx  # Theme, React Query, Tooltip, Toaster
│       │   ├── router.tsx    # route table
│       │   └── routes/       # dashboard.tsx, not-found.tsx
│       ├── config/           # env.ts (all VITE_* settings), paths.ts
│       ├── api/              # fetch client, request functions, query keys
│       ├── components/       # app components; ui/ holds shadcn-style primitives
│       ├── contexts/         # theme context
│       ├── hooks/            # data hooks (useTasks, useDrones, useFlightSessions) and telemetry connection
│       ├── i18n/ locales/    # react-i18next setup, en + zh-TW messages
│       ├── lib/              # react-query config, map style, tokens bridge, formatting
│       ├── stores/           # Zustand: telemetryStore, uiStore
│       ├── styles/tokens/    # two-layer design tokens (primitives → semantic)
│       ├── types/
│       └── utils/
└── backend/
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── .env.example
    └── app/
        ├── main.py
        ├── config.py
        ├── database.py
        ├── models.py
        ├── monitoring.py
        ├── api/
        │   ├── __init__.py
        │   ├── drones.py
        │   ├── tasks.py
        │   ├── simulation.py
        │   ├── flight_sessions.py
        │   ├── diagnose.py
        │   └── websocket.py
        ├── schemas/
        │   ├── __init__.py
        │   ├── common.py
        │   ├── drone.py
        │   ├── task.py
        │   ├── simulation.py
        │   └── diagnose.py
        ├── services/
        │   ├── simulator.py
        │   ├── ws_manager.py
        │   ├── telemetry_writer.py
        │   ├── task_handlers.py
        │   ├── diagnosis_service.py
        │   ├── env_diagnosis.py
        │   ├── env_tools.py
        │   ├── ai_report.py
        │   ├── battery_planning.py
        │   ├── wind_compensation.py
        │   ├── task_report.py
        │   └── (elevation, weather, run_state)
        └── prompts/
            ├── __init__.py
            └── diagnosis.txt
```

---

## Local Development

Start the **backend first**, then the frontend. The frontend uses Vite’s proxy to `/api` and `/ws` so requests go to the backend on port 8000.

### 1. Backend (start first)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set DATABASE_URL (PostgreSQL; use postgresql+asyncpg://... for async),
#            OPENWEATHER_API_KEY, OPENAI_API_KEY (optional)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_GOOGLE_MAPS_API_KEY (required for map display)
npm run dev
```

Open **http://localhost:5173**. Use “Start mission” to connect to the backend WebSocket and see live trajectory and weather.

If you see `[vite] http proxy error` or `ECONNREFUSED`, the backend is not running on port 8000.

### One-shot run (optional)

From the project root (after `backend/.venv` and `frontend/node_modules` are set up):

```bash
./dev.sh
```

This starts the backend in the background and the frontend in the foreground; Ctrl+C stops both.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (e.g. Neon). Use `postgresql+asyncpg://user:password@host/dbname?sslmode=require` for async. |
| `OPENWEATHER_API_KEY` | No | OpenWeather API key for wind speed/direction. |
| `OPENAI_API_KEY` | No | Used by LangChain for mission diagnosis and closing reports. |
| `GOOGLE_MAPS_API_KEY` | No | Backend env diagnosis (Elevation API); enable in Cloud Console if used. |
| `CORS_ORIGINS` | No | Comma-separated origins (e.g. `http://localhost:5173`). Empty ⇒ `*` and no credentials. |
| `DB_USE_SSL` | No | `true` / `false`; use `true` for Neon, `false` for local Postgres. |
| `SIM_LAT`, `SIM_LNG` | No | Simulation origin (default: Taipei). |

### Frontend (`frontend/.env.local` or build-time env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | **Yes** | Google Maps JavaScript API key (map won’t load without it). |
| `VITE_API_URL` | No | Backend base URL; dev defaults to Vite proxy. **Set for production** so API calls hit the correct host. |
| `VITE_WS_BASE_URL` | No | WebSocket URL; derived from `VITE_API_URL` if unset. |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. |
| **Simulation** | | |
| POST | `/api/simulation/start` | Start simulation and begin telemetry push. |
| POST | `/api/simulation/stop` | Stop simulation. |
| POST | `/api/simulation/pause` | Pause simulation. |
| POST | `/api/simulation/resume` | Resume simulation. |
| **WebSocket** | | |
| WS | `/ws/telemetry` | Real-time telemetry stream. |
| **Drones** | | |
| GET | `/api/drones` | List drones. |
| POST | `/api/drones` | Create drone. |
| DELETE | `/api/drones/{drone_id}` | Delete drone. |
| **Tasks** | | |
| GET | `/api/tasks` | List tasks. |
| POST | `/api/tasks` | Create task. |
| GET | `/api/tasks/{task_id}` | Get task. |
| GET | `/api/tasks/{task_id}/report` | Get task report. |
| POST | `/api/tasks/{task_id}/start` | Start task. |
| POST | `/api/tasks/{task_id}/pause` | Pause task. |
| POST | `/api/tasks/{task_id}/resume` | Resume task. |
| POST | `/api/tasks/{task_id}/cancel` | Cancel task. |
| DELETE | `/api/tasks/{task_id}` | Delete task. |
| **Flight sessions** | | |
| GET | `/api/flight-sessions` | List flight sessions. |
| GET | `/api/flight-sessions/{session_id}/telemetry` | Get session telemetry. |
| POST | `/api/flight-sessions/{session_id}/report` | Generate session report. |
| POST | `/api/flight-sessions/{session_id}/diagnose` | Run diagnosis for session. |
| **AI / diagnosis** | | |
| POST | `/api/plan-mission` | Plan mission (battery/path analysis). |
| POST | `/api/diagnose` | Diagnose from telemetry payload. |

---

## Data Models

- **Drone**: `id`, `name`, `base_speed_m_min`, `status`, `last_lat`, `last_lng`
- **FlightSession**: `start_time`, `end_time`, `weather_snapshot`, linked to `Drone`
- **Task**: `name`, `status`, with **TaskAssignment** (drone, route, status) and optional **TaskReport**
- **Telemetry**: `lat`, `lng`, `alt`, `speed`, `heading`, `battery`, `wind_speed`, `wind_deg`, `effective_speed_m_min`

---

## Dependency Graph

### High-level: Frontend ↔ Backend

```mermaid
flowchart LR
  subgraph Frontend["Frontend (Vite :5173)"]
    UI[Pages & Components]
    API[api/client + modules]
    WS[WebSocket /ws/telemetry]
  end
  subgraph Backend["Backend (FastAPI :8000)"]
    Routes[API Routes]
    DB[(PostgreSQL)]
    Sim[Simulator]
    Ext[OpenWeather / OpenAI / Elevation]
  end
  UI --> API
  UI --> WS
  API --> Routes
  WS --> Routes
  Routes --> DB
  Routes --> Sim
  Routes --> Ext
```

### Frontend dependency flow

```mermaid
flowchart TB
  subgraph Entry
    main[main.tsx]
    App[app/index.tsx]
  end
  subgraph Providers
    Theme[ThemeContext]
    Query[QueryClient]
    Router[BrowserRouter]
    Tooltip[TooltipProvider]
  end
  subgraph Routes["app/routes"]
    Index[dashboard]
    NotFound[not-found]
  end
  subgraph Features
    Map[GoogleMapView]
    HUD[TelemetryHUD]
    AI[AIDiagnosticPanel]
    Tasks[TaskList / TaskCreateForm]
    Drones[MyDronesList]
    Sessions[FlightSessionsList]
  end
  subgraph Data
    hooks[useDrones, useTasks, useTelemetry, useDroneMap]
    stores[telemetryStore, uiStore]
    api[drones, tasks, simulation, flightSessions, diagnose]
  end
  main --> App
  App --> Theme
  App --> Query
  App --> Router
  App --> Tooltip
  Router --> Index
  Index --> Map
  Index --> HUD
  Index --> AI
  Index --> Tasks
  Index --> Drones
  Index --> Sessions
  Features --> hooks
  Features --> stores
  hooks --> api
  api --> client[api/client]
```

### Backend dependency flow

```mermaid
flowchart TB
  main[main.py]
  main --> CORS[CORSMiddleware]
  main --> drones_router[drones]
  main --> tasks_router[tasks]
  main --> sim_router[simulation]
  main --> fs_router[flight_sessions]
  main --> diag_router[diagnose]
  main --> ws_router[websocket]

  drones_router --> get_db[database]
  drones_router --> models[models]
  tasks_router --> get_db
  tasks_router --> models
  tasks_router --> task_handlers[task_handlers]
  tasks_router --> simulator[simulator]
  sim_router --> get_db
  sim_router --> simulator
  sim_router --> task_handlers
  fs_router --> get_db
  fs_router --> ai_report[ai_report]
  fs_router --> env_diagnosis[env_diagnosis]
  diag_router --> battery_planning[battery_planning]
  diag_router --> env_diagnosis
  diag_router --> weather[weather]
  diag_router --> elevation[elevation]
  ws_router --> simulator
  ws_router --> ws_manager[ws_manager]

  get_db --> DB[(PostgreSQL)]
  simulator --> telemetry_writer[telemetry_writer]
  simulator --> wind_compensation[wind_compensation]
  env_diagnosis --> diagnosis_service[diagnosis_service]
  env_diagnosis --> OpenWeather[OpenWeather API]
  diagnosis_service --> LangChain[LangChain / OpenAI]
  ai_report --> LangChain
  elevation --> GoogleElevation[Google Elevation API]
```

### Package dependencies (summary)

| Frontend (npm) | Purpose |
|----------------|--------|
| react, react-dom | UI |
| react-router-dom | Routing |
| @tanstack/react-query | Server state & caching |
| zustand | Client state (telemetry, UI) |
| i18next, react-i18next | UI translations (en, zh-TW); see `frontend/src/locales/README.md` |
| @googlemaps/js-api-loader | Map |
| @radix-ui/* | Accessible primitives |
| tailwindcss, tailwind-merge, clsx, cva | Styling |
| lucide-react | Icons |

| Backend (pip) | Purpose |
|---------------|--------|
| fastapi, uvicorn | API server |
| sqlalchemy, asyncpg | Async PostgreSQL |
| python-dotenv | Config |
| httpx | HTTP client (e.g. OpenWeather) |
| websockets | WebSocket support |
| langchain-openai, openai | AI reports & diagnosis |

---

## UI & Theming

The UI uses a dark theme with **Orbitron** / **JetBrains Mono** fonts, cyan accents, and a grid background, aligned with the reference aerosim-dashboard layout: map, HUD, weather controls, and AI diagnostic panel.
