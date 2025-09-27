# SQL Chatbot v0 — Architecture

Version: v0  
Owner: BMad Orchestrator → Architect  
Status: Draft for review (target ≥90 score)

1. Architecture Overview

Goal: Safely translate natural language to read‑only SQL, execute against a local database, and return an English answer with the SQL used. The system prioritizes safety, observability, and portability (SQLite by default; Postgres optional).

- Frontend: Vite + React SPA (web/)
- Backend: Node.js + TypeScript (strict) + Express
- DB: Knex with SQLite (default db.sqlite) and Postgres via env switch
- LLM: OpenAI Responses API (model=gpt-5-mini), env‑driven provider/model
- Observability: pino logs; JSONL audits
- Tests: unit (guard), e2e (/api/chat)

2. Module Structure

Backend (src/)
- server.ts: Application bootstrap (Express), pino logger, middleware, error handling
- routes/chat.ts: POST /api/chat — orchestrates NL→SQL flow
- nl2sql/
  - prompt.ts: Builds system+user prompt from schema, safety rules, and question
  - translator.ts: Calls OpenAI Responses API; returns structured { sql, parameters, answer_short }
  - guard.ts: Validates candidate SQL; enforces read‑only allow‑list; applies LIMIT; parameterization policy; single auto‑revise path
- db/
  - knex.ts: Knex initialization with env‑driven client and connection
  - migrations/*: DDL for customers, products, orders, order_items
  - seeds/*: Synthetic data generation aligning to acceptance tests
- observability/
  - logger.ts: pino configuration (JSON logs; requestId)
  - audit.ts: append‑only JSONL writer to audits/log.jsonl
- config/
  - env.ts: Typed config loader (dotenv) with PROVIDER, OPENAI_MODEL, OPENAI_API_KEY, KNEX_CLIENT, DATABASE_URL, PORT, LOG_LEVEL

Frontend (web/)
- src/Chat.tsx: Single page chat UI: input, submit, results (answer, SQL, table)
- vite.config.ts: dev proxy /api → 3000

3. Request Lifecycle

Sequence (POST /api/chat):
1) HTTP request enters Express route with body { question }
2) Validation: ensure non‑empty question; attach requestId; start timer
3) Build schema+policy prompt via prompt.ts (allow‑list + semantics)
4) translator.ts calls OpenAI Responses API:
   - provider=openai, model=gpt-5-mini
   - temperature=0.2, top_p=1.0, reasoning_effort="minimal", max_output_tokens=2048
   - Requests structured JSON { sql, parameters, answer_short }
5) guard.ts validates SQL:
   - SELECT‑only; no DDL/DML; no temp tables
   - allow‑listed tables/columns only
   - parameterized inputs
   - LIMIT 100 if absent or too large (cap to 100)
6) If guard fails:
   - One auto‑revise: send feedback to translator; re‑validate
   - If still failing → produce safe fallback: { answer: "Cannot safely answer.", sql: "", rowsCount: 0 }
7) Execute validated SQL via Knex (prepared/bound parameters)
8) Compute elapsedMs; form response { answer, sql, rowsCount, elapsedMs, rows? }
9) Audit append: { ts, question, sql, validation, revised, outcome, rowsCount, elapsedMs }
10) Respond 200 (or 422/400 on validation schema errors)

4. Safety Model

Constraints (enforced by guard.ts):
- SELECT‑only; forbid CREATE/ALTER/DROP/INSERT/UPDATE/DELETE
- Forbid data‑modifying CTEs and temp tables
- Allow CTEs, window functions, subqueries if read‑only
- Allow‑list tables: customers, products, orders, order_items
- Allow‑list columns: per schema; reject unlisted identifiers
- Parameterize values; no string concatenation of inputs
- Default LIMIT 100; if absent, append; if present >100, clamp to 100
- One revision attempt on failure; otherwise safe fallback message

Dialect strategy:
- Generate portable SQL subset compatible with SQLite and Postgres
- Runtime switch:
  - SQLite default (file db.sqlite)
  - Postgres: KNEX_CLIENT=pg + DATABASE_URL
- Avoid dialect‑specific functions unless guarded behind capability checks

5. Data Model

Tables:
- customers(id INTEGER PK, name TEXT, city TEXT)
- products(id INTEGER PK, name TEXT, category TEXT, price NUMERIC)
- orders(id INTEGER PK, customer_id INTEGER FK→customers, order_date DATE/TIMESTAMP, total NUMERIC)
- order_items(id INTEGER PK, order_id INTEGER FK→orders, product_id INTEGER FK→products, quantity INTEGER, unit_price NUMERIC)

Indexes:
- orders(customer_id), order_items(order_id), order_items(product_id)
- products(category), customers(city)

Seed characteristics:
- ~50 customers (include “Alice”)
- 8–12 diverse cities (US/EU)
- ~50 products across categories (Accessories, Electronics, Apparel, Home)
- ~200 orders with matching items (quantities 1–5; prices $5–$500; 2023‑01‑01..2025‑09‑01)

6. Time Semantics

- All server calculations use UTC
- Calendar quarters: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec
- Relative periods (e.g., “last quarter”) computed from server current UTC date

7. API Contract

POST /api/chat
- Request: { question: string }
- Response: { answer: string, sql: string, rowsCount: number, elapsedMs: number, rows?: any[] }
- Errors:
  - 400: invalid body (missing question)
  - 422: LLM/translation/validation error (with safe fallback when applicable)
  - 500: unexpected server error (no stack in response)

8. Observability

- pino logger (logger.ts), levels via LOG_LEVEL (default info)
- requestId per request, latency logged
- audit.ts appends JSON lines to audits/log.jsonl:
  { ts, requestId, question, sql, validation: { valid, issues[] }, revised, outcome, rowsCount, elapsedMs }
- v0 Privacy: log full question and SQL (documented caveat), move to redaction later

9. Configuration

.env keys:
- PROVIDER=openai
- OPENAI_MODEL=gpt-5-mini
- OPENAI_API_KEY=...
- KNEX_CLIENT=sqlite3|pg (default sqlite3)
- DATABASE_URL=... (required for pg)
- PORT=3000
- LOG_LEVEL=info

Code reads env via config/env.ts; no hard‑coded models; allow future swap by changing env only.

10. Error Handling

- Input validation errors → 400
- LLM API errors → 502 equivalent translated to 422 with diagnostic (no provider details leakage)
- Guard failures after revision → 200 with safe fallback on business constraint (or 422 when strictly invalid input)
- DB errors → 500 sanitized message; do not echo raw SQL exceptions to client

11. Build, Run, and Tooling

- TypeScript strict; tsc for build
- ESLint + Prettier with npm scripts
- NPM scripts:
  - dev: run server with nodemon/tsx and Vite with proxy
  - build: tsc and Vite build
  - start: node dist/server.js
  - migrate: knex migrate:latest
  - seed: knex seed:run
  - test: vitest/jest + supertest
- Must run: npm i && npm run migrate && npm run seed && npm run dev

12. Security Considerations

- No write statements executed; read‑only guard enforced pre‑execution
- Parameter binding for all dynamic values
- Fixed allow‑list of identifiers
- Minimal surface: one API route, strict schema validation
- Rate limiting (deferred; optional for v0)
- CORS disabled in dev via proxy; no public exposure assumed

13. Testing Strategy

- Unit tests (guard.spec.ts):
  - Accept: valid SELECT with joins/aggregations/CTEs/window functions (read‑only)
  - Reject: DDL/DML verbs, data‑modifying CTEs, temp tables
  - Enforce: LIMIT cap and parameterization detection
- E2E (chat.e2e.spec.ts):
  - Seed DB; POST /api/chat with “How many orders did Alice place in 2024?”
  - Expect rowsCount and answer to align with seed data
- Additional: translator contract parsing; prompt schema smoke test

14. Frontend

- Single React component (Chat.tsx) with:
  - Input for question; submit triggers POST /api/chat
  - Result panel: answer, SQL (monospace), rowsCount, table preview (first 20 rows)
- Vite dev server on 5173; proxy /api → 3000
- Minimal styling (CSS modules/Tailwind optional; default to simple CSS)

15. Deployment & Future Work

- Local dev only for v0
- Future:
  - Authn/authz and RBAC
  - Query pagination and CSV export
  - Prompt templates library; domain adapters
  - Redaction of audits; per‑table access controls
  - Caching layer and perf metrics

16. Text Diagram (High‑Level)

[React SPA] --HTTP--> [Express /api/chat]
      |                         |
      |                  [prompt.ts] ← schema + policy
      |                         |
      |                  [translator.ts] --HTTP--> OpenAI Responses API
      |                         |                     (gpt-5-mini)
      |                  [guard.ts] — validate/limit/allow‑list
      |                         |
      |                      [Knex] — SQLite/Postgres
      |                         |
      |                 [audit.ts + pino logs]
      |                         |
      <-- JSON ------------------

17. Risks & Mitigations

- Unsafe SQL from LLM → strict guard + single revise + safe fallback
- Dialect drift → portable subset; pg switch via env; avoid vendor functions
- Seed inadequacy → targeted generation to satisfy acceptance tests
- Latency → minimal reasoning, concise prompts, small dataset
- Logging privacy → caveat documented; plan redaction later

18. Acceptance Alignment

- Adheres to PRD functional and non‑functional requirements
- Explicit model/provider env configuration
- Ready for SM story with concrete file list, commands, and test plan
