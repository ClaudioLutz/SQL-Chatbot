# SQL Chatbot v0 — Product Requirements Document (PRD)

Version: v0  
Owner: BMad Orchestrator → Product Manager (John)  
Status: Draft for review (target ≥90 score)

1. Overview

A minimal full‑stack “SQL Chatbot” that:
- Accepts a natural language question
- Translates it into SAFE, parameterized SQL
- Executes it against a local DB (SQLite by default; Postgres optional)
- Replies with an English answer plus the SQL used

Primary objective: Deliver a safe and auditable NL→SQL interface over a known schema with guardrails, observability, and tests.

2. Goals and Non‑Goals

2.1 Goals
- Convert NL questions to read‑only SQL using OpenAI Responses API (gpt-5-mini), with minimal reasoning effort (reasoning_effort: "minimal").
- Enforce strict safety:
  - SELECT‑only; forbid DDL/DML (CREATE/ALTER/DROP/INSERT/UPDATE/DELETE), temp tables, and data‑modifying CTEs
  - Parameterize inputs
  - Default LIMIT 100 if none specified (user can request fewer)
  - One automatic revision attempt on failed validation; otherwise return “Cannot safely answer.”
- Schema‑aware generation (tables/columns allow‑list).
- Server returns: { answer, sql, rowsCount, elapsedMs }.
- Observability: pino logs; append JSONL audits containing prompt, generated SQL, final decision.
- Full developer workflow with TypeScript strict mode, ESLint, Prettier, and tests (unit for guard; one e2e hitting /api/chat).
- Simple single‑page web UI (Vite + React) with a chat box, showing the English answer, SQL used, and results.

2.2 Non‑Goals (v0)
- No user authentication or role‑based access control.
- No schema discovery at runtime; schema is known and allow‑listed up front.
- No write operations or admin features.
- No advanced caching or vector retrieval; no semantic search over docs.
- No multi‑turn conversational memory beyond one request; stateless API.
- No PII redaction beyond a note for future; v0 may store question + SQL in audit logs.

3. Users and Use Cases

3.1 Primary Users
- Data‑curious stakeholders (PMs, Ops) who need quick insights without writing SQL.
- Developers validating natural language queries for known datasets.

3.2 Representative Use Cases
- “Top 5 cities by total order revenue last quarter”
- “Products in ‘Accessories’ with avg order qty > 2”
- “How many orders did Alice place in 2024?”
- “10 most expensive products and their average quantity per order”

4. Requirements

4.1 Functional Requirements
- FR1: API endpoint POST /api/chat accepts JSON: { question: string }.
- FR2: Backend constructs a schema‑aware prompt and calls OpenAI Responses API (model=gpt-5-mini) to obtain SQL and a short English answer.
- FR3: Guard validates SQL:
  - SELECT‑only; allow CTEs, window functions, subqueries if read‑only
  - Only allow‑listed tables/columns
  - No DDL/DML or data‑modifying CTEs
  - Append LIMIT 100 if none (unless user asks for fewer)
  - Parameterize user inputs
- FR4: On first failed validation, auto‑revise once via the LLM with explicit validator feedback; if still invalid, return a safe fallback payload with “Cannot safely answer”.
- FR5: Execute against SQLite using Knex; support Postgres via KNEX_CLIENT=pg + DATABASE_URL at runtime.
- FR6: Respond with JSON: { answer: string, sql: string, rowsCount: number, elapsedMs: number, rows?: any[] }.
- FR7: Web UI provides a single chat input; on submit, POSTs to /api/chat, then displays English answer, SQL used, row count, and a small tabular preview of rows (up to ~20 rows client‑side).
- FR8: Observability:
  - Pino logs at info level by default
  - JSONL audit file: audits/log.jsonl with entries { ts, question, sql, validation, revised, outcome, rowsCount, elapsedMs }.
- FR9: Tests:
  - Unit test coverage for the guard (happy paths and malicious attempts)
  - One e2e test for /api/chat with a known seed question

4.2 Non‑Functional Requirements
- NFR1: TypeScript strict; ESLint + Prettier configured; project builds and runs with npm scripts.
- NFR2: Default to UTC time semantics on server.
- NFR3: Performance: Typical query completes < 2s given local SQLite and small dataset.
- NFR4: Security: Zero write privileges in SQL path; strictly validated SQL; parameterization mandatory.
- NFR5: Auditability: Every request recorded with question + generated SQL and validation decision.

5. Architecture Summary (High‑Level)

- Frontend (Vite + React) single page:
  - Chat.tsx: input field, submit, result panel (answer, SQL, table).
  - Dev proxy to /api to eliminate CORS during dev.
- Backend (Node.js + Express or Fastify; Express preferred for ubiquity):
  - server.ts: bootstraps HTTP server, logging, routes, error handler.
  - routes/chat.ts: POST /api/chat handler orchestrates translator, guard, executor, auditing.
  - nl2sql:
    - prompt.ts: builds system and user prompts including schema & rules.
    - translator.ts: calls OpenAI Responses API (model=gpt-5-mini) with env‑driven provider/model; parses structured result.
    - guard.ts: validates candidate SQL; enforces read‑only allow‑list and parameterization policy; applies LIMIT 100 if needed; can trigger single revision via translator.
  - db/knex.ts: Knex configuration supporting SQLite default and Postgres via env.
  - db/migrations/* and db/seeds/* for provided schema and synthetic data.
- Observability:
  - pino logger configured via env LOG_LEVEL.
  - Audit writer appends JSON lines to audits/log.jsonl.
- Configuration via .env:
  - PROVIDER=openai
  - OPENAI_MODEL=gpt-5-mini
  - OPENAI_API_KEY=...
  - KNEX_CLIENT=sqlite3|pg
  - DATABASE_URL (for pg)
  - NODE_ENV, PORT, LOG_LEVEL
- Ports:
  - API: http://localhost:3000
  - UI: http://localhost:5173 (proxy /api → :3000 in dev)

6. Data Model and Seed

6.1 Tables (allow‑listed)
- customers(id, name, city)
- products(id, name, category, price)
- orders(id, customer_id, order_date, total)
- order_items(id, order_id, product_id, quantity, unit_price)

6.2 Seed Data
- ~50 customers (include “Alice”; diverse 8–12 US/EU cities)
- ~50 products across categories: Accessories, Electronics, Apparel, Home
- ~200 orders and matching order_items (quantities 1–5; prices $5–$500; order_date from 2023‑01‑01 to 2025‑09‑01)
- Ensure integrity and joins produce meaningful aggregations.

7. Time & Semantics

- All server‑side time calculations use UTC.
- “Quarter” means standard calendar quarters (Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec).
- If a year is omitted (e.g., “last quarter”), compute relative to current server UTC date.

8. Prompting & Model Settings

- Provider: OpenAI
- API: Responses API
- Model: gpt-5-mini
- Defaults (unless overridden by env):
  - reasoning_effort: minimal
  - temperature: 0.2
  - top_p: 1.0
  - max_output_tokens: 2048
- Prompt strategy:
  - System: role and constraints; SQL safety policy; allowed tables/columns; time semantics; LIMIT policy.
  - User: natural language question.
  - Tooling: request a structured output JSON with fields { sql, parameters, answer_short }.
  - On guard fail: send validator feedback and request a revised SQL strictly matching constraints (single attempt).

9. Safety Policy (Enforced)

- SELECT‑only SQL; forbid DDL/DML and temp tables.
- Forbid data‑modifying CTEs.
- Only allow references to allow‑listed tables and columns.
- Parameterize all user inputs; never concatenate.
- Append LIMIT 100 if none (unless user asks for fewer).
- One auto‑revise attempt; otherwise return “Cannot safely answer.”

10. API Contract

Request
POST /api/chat
Content‑Type: application/json
{
  "question": "Top 5 cities by total order revenue last quarter"
}

Response (200 OK on success; 422/400 for invalid; 200 with safe fallback message on unsafely answerable)
{
  "answer": "The top 5 cities by revenue last quarter were ...",
  "sql": "SELECT city, SUM(...) AS revenue ... LIMIT 100;",
  "rowsCount": 5,
  "elapsedMs": 231,
  "rows": [
    { "city": "San Francisco", "revenue": 12345.67 },
    ...
  ]
}

11. Observability

- Logging: pino at info; include requestId, elapsedMs, guard decisions.
- Audit JSONL file audits/log.jsonl with entries:
  {
    "ts": "2025-09-27T11:00:00Z",
    "question": "...",
    "sql": "...",
    "validation": { "valid": true, "issues": [] },
    "revised": false,
    "outcome": "answered|unsafe|validation_error",
    "rowsCount": 5,
    "elapsedMs": 231
  }
- v0 Note: acceptable to store full question and SQL; future versions may redact/mask.

12. Tooling and Dev Workflow

- TypeScript strict
- ESLint + Prettier
- NPM scripts:
  - dev: concurrently run API and Vite proxy UI
  - build: tsc build (and Vite build for web)
  - start: node dist/server.js
  - migrate: knex migrate:latest
  - seed: knex seed:run
  - test: vitest (or jest) for unit; supertest for e2e
- .env and .env.example with:
  - PROVIDER=openai
  - OPENAI_MODEL=gpt-5-mini
  - OPENAI_API_KEY=
  - KNEX_CLIENT=sqlite3 (default) | pg
  - DATABASE_URL= (for pg)
  - PORT=3000
  - LOG_LEVEL=info

13. Acceptance Criteria

Minimum acceptance (functional)
- AC1: Endpoint /api/chat accepts a question and returns JSON with answer, sql, rowsCount, elapsedMs (and rows preview).
- AC2: Guard prevents DDL/DML and unallow‑listed fields; parameterization enforced; default LIMIT 100.
- AC3: One auto‑revise attempt on failed validation; otherwise safe message.
- AC4: SQLite works out‑of‑the‑box; Postgres works by setting KNEX_CLIENT=pg and DATABASE_URL.
- AC5: UI shows question, answer, SQL, and a table preview.

Acceptance tests (examples)
- AT1: “Top 5 cities by total order revenue last quarter”
- AT2: “Products in ‘Accessories’ with avg order qty > 2”
- AT3: “How many orders did Alice place in 2024?”
- AT4: “10 most expensive products and their average quantity per order”

Quality & observability
- AC6: pino logs appear for each request
- AC7: audits/log.jsonl appends an entry per request

Tooling & tests
- AC8: npm i && npm run migrate && npm run seed && npm run dev works
- AC9: guard unit tests pass
- AC10: e2e test for /api/chat passes

14. Risks and Mitigations

- R1: LLM produces unsafe SQL (Mitigation: strict validator + allow‑list + auto‑revise + safe fallback)
- R2: SQL dialect differences (Mitigation: generate portable subset; runtime pg switch via Knex; avoid dialect‑specific features unless guarded)
- R3: Seed data not rich enough (Mitigation: generate diversified data to satisfy acceptance questions)
- R4: Latency (Mitigation: minimal reasoning effort, concise prompts, small dataset)
- R5: Audit privacy (Mitigation: v0 stores question/SQL; add redaction in v1)

15. Release Plan

- v0 (this PRD): Full scope as above
- v0.1: Add basic prompt templates for common aggregations; redact PII from audits
- v1: Authn/authz; table‑level permissions; query templates; pagination for large results

16. Open Questions (Resolved)

- SQL features: allow read‑only CTEs, window functions, subqueries — Yes
- Time semantics: UTC, standard calendar quarters; relative to server now if year omitted — Yes
- Safety policy: SELECT‑only, parameterization, default LIMIT 100 — Yes
- Seed specifics: include Alice; realistic cities; categories incl. Accessories; prices $5–$500; dates 2023‑01‑01..2025‑09‑01 — Yes
- Ports & audit: API 3000, UI 5173, audit to audits/log.jsonl — Yes (note about potential future redaction)

17. Success Metrics

- >95% of random user questions derived from acceptance theme produce valid SQL or safe fallback within 2s
- 100% blocking of write operations
- Tests: guard unit tests ≥90% branch coverage on validator; e2e happy path green
- Developer ergonomics: npm i && migrate && seed && dev runs with no manual steps

Appendix A — Example Prompt (Sketch)

System (summary):
“You are a SQL generator for a known schema. Output read‑only SQL that adheres to constraints: SELECT‑only, allow‑list tables/columns, no temp tables, no data‑modifying CTEs, parameterize inputs, default LIMIT 100 if absent. Use a portable subset compatible with SQLite and Postgres. Time semantics: UTC; calendar quarters.”

User:
“Top 5 cities by total order revenue last quarter.”

Desired model output (structured JSON):
{
  "sql": "...",
  "parameters": [...],
  "answer_short": "The top 5 cities by revenue last quarter are ..."
}
