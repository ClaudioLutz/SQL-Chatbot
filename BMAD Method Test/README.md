# SQL Chatbot v0

Minimal full‑stack app that:
- Accepts a natural language question
- Translates it into SAFE, parameterized SQL (SELECT‑only)
- Executes against a local DB (SQLite by default; Postgres optional)
- Returns an English answer plus the SQL used

Provider/Model (env‑switchable):
- PROVIDER=openai
- OPENAI_MODEL=gpt-5-mini
- Uses OpenAI Responses API. In v0, mock mode is available to run without an API key.

Tech
- Backend: Node.js + TypeScript (strict) + Express
- DB: Knex with SQLite (db.sqlite), Postgres via env
- NL→SQL: schema‑aware prompt + validator guard
- Frontend: Vite + React SPA (web/)
- Observability: pino logs + JSONL audit (audits/log.jsonl)
- Tests: vitest unit (guard) + supertest e2e (/api/chat)

Prerequisites
- Node.js >= 18.18

Quickstart (SQLite + Mock Mode)
1) Clone/cd into project folder (this directory).
2) Copy env:
   cp .env.example .env
   - Default .env values are fine for SQLite + Mock Mode.
   - Mock Mode engages automatically if OPENAI_API_KEY is not set (or set MOCK_TRANSLATOR=1).
3) Install deps, migrate, seed, and start dev servers:
   npm i
   npm run migrate
   npm run seed
   npm run dev
   - API at http://localhost:3000
   - Web at http://localhost:5173 (proxied to /api)

Example requests (curl)
- 1) Alice orders in 2024 (acceptance case; works in Mock Mode)
  curl -s -X POST http://localhost:3000/api/chat ^
    -H "Content-Type: application/json" ^
    -d "{\"question\":\"How many orders did Alice place in 2024?\"}" | jq

- 2) Top 5 cities by total order revenue last quarter
  curl -s -X POST http://localhost:3000/api/chat ^
    -H "Content-Type: application/json" ^
    -d "{\"question\":\"Top 5 cities by total order revenue last quarter\"}" | jq

Environment configuration
- .env keys:
  - PROVIDER=openai
  - OPENAI_MODEL=gpt-5-mini
  - OPENAI_API_KEY=  (set to use real OpenAI Responses API)
  - KNEX_CLIENT=sqlite3 | pg   (default sqlite3)
  - DATABASE_URL=postgres://USER:PASS@localhost:5432/sql_chatbot   (when KNEX_CLIENT=pg)
  - PORT=3000
  - LOG_LEVEL=info
  - MOCK_TRANSLATOR=1   (optional; forces Mock Mode)
- Model knobs (via code defaults / prompt):
  - temperature=0.2, top_p=1.0, max_output_tokens=2048

Switch to Postgres
- In .env:
  KNEX_CLIENT=pg
  DATABASE_URL=postgres://USER:PASS@localhost:5432/sql_chatbot
- Then:
  npm run migrate
  npm run seed

Project scripts
- npm run dev        # tsx watch backend + Vite frontend (with /api proxy)
- npm run build      # tsc build + Vite build
- npm start          # run compiled server (dist/server.js)
- npm run migrate    # knex migrate:latest
- npm run seed       # knex seed:run
- npm test           # vitest --run (unit + e2e)

Repository layout
- src/server.ts                      # Express app bootstrap (pino, routes, error handler)
- src/routes/chat.ts                 # POST /api/chat → translator → guard → db → audit
- src/config/env.ts                  # zod‑validated env loader
- src/db/knex.ts                     # Knex config (SQLite default, PG via env)
- src/db/migrations/0001_init.js     # customers, products, orders, order_items
- src/db/seeds/0001_seed_core.js     # ~50 customers (incl. Alice), ~50 products
- src/db/seeds/0002_seed_orders.js   # ~200 orders + items (2023‑01‑01..2025‑09‑01)
- src/nl2sql/schema.ts               # allow‑listed schema
- src/nl2sql/prompt.ts               # prompt builder (policy + schema + question)
- src/nl2sql/translator.ts           # OpenAI Responses API (Mock Mode supported)
- src/nl2sql/guard.ts                # SQL validator (SELECT‑only, LIMIT 100 cap, allow‑list)
- src/observability/audit.ts         # JSONL audit writer (audits/log.jsonl)
- web/                               # Vite + React SPA
  - index.html
  - vite.config.ts                   # dev proxy to http://localhost:3000
  - src/main.tsx                     # bootstrap
  - src/Chat.tsx                     # UI: question input, result (answer, SQL, table)
- tests/guard.spec.ts                # guard unit tests (vitest)
- tests/chat.e2e.spec.ts             # e2e for /api/chat (supertest; Mock Mode)

Safety guard summary
- Enforced by src/nl2sql/guard.ts:
  - SELECT‑only; forbid DDL/DML (CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE/REPLACE/MERGE)
  - Forbid temp tables, data‑modifying CTEs
  - Allow read‑only CTEs, window functions, subqueries
  - Only allow‑listed tables/columns (customers, products, orders, order_items)
  - Require LIMIT ≤ 100; append LIMIT 100 if omitted (the generator is instructed, guard enforces)
  - Parameterization required for user values (translator returns ordered parameters)

Observability
- Pino logs to console (LOG_LEVEL=info by default)
- JSONL audit: audits/log.jsonl
  Each line:
  {
    "ts": "2025-09-27T11:00:00Z",
    "requestId": "...",
    "question": "...",
    "sql": "...",
    "validation": { "valid": true, "issues": [] },
    "revised": false,
    "outcome": "answered|unsafe|validation_error",
    "rowsCount": 5,
    "elapsedMs": 231
  }

Testing
- Unit (guard):
  npm test
- E2E (/api/chat):
  - Ensures Mock Mode is on for deterministic SQL (no API key needed)
  Notes:
    If you see a TypeScript error about supertest types, install:
      npm i -D @types/supertest

Notes & Limits (v0)
- No auth; local development only
- No redaction; question + SQL are stored in audits/log.jsonl (acceptable in v0)
- Stateless requests; no multi‑turn memory
- SQL portability: we generate a portable subset OK for SQLite and Postgres
- Time semantics: UTC; calendar quarters; “last quarter” relative to server current UTC date

Run summary
- Run commands:
  npm i
  npm run migrate
  npm run seed
  npm run dev
- Local URLs:
  - API: http://localhost:3000
  - UI:  http://localhost:5173
- Example curl:
  - curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"question\":\"How many orders did Alice place in 2024?\"}"
  - curl -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"question\":\"Top 5 cities by total order revenue last quarter\"}"
