# Story: Build SQL Chatbot v0

Role: Scrum Master  
Owner: BMad Orchestrator → SM  
Status: Planned → In Progress  
Definition of Done: All acceptance criteria in PRD met; Architecture implemented; tests green; run command works end-to-end.

1) Scope and Objectives

- Build a minimal full‑stack “SQL Chatbot” v0 that converts NL → SAFE, parameterized SQL (read‑only), executes against local DB, and returns an English answer with the SQL used.
- Tech baseline:
  - Backend: Node.js + TypeScript (strict) + Express
  - DB: Knex with SQLite (default db.sqlite); Postgres via `KNEX_CLIENT=pg` + `DATABASE_URL`
  - LLM: OpenAI Responses API, `model=gpt-5-mini`, provider via env
  - Frontend: Vite + React SPA
  - Observability: pino logs; JSONL audit of prompt/SQL decisions
  - Tooling: ESLint + Prettier, Vitest, Supertest
- Must run: `npm i && npm run migrate && npm run seed && npm run dev`

2) Commands (Single-line, copy/paste friendly)

- Initial setup
  - npm i
  - npm run migrate
  - npm run seed
  - npm run dev
- Tests
  - npm test

3) File/Directory Plan

Backend (root)
- package.json (workspaces: ["web"]; scripts: dev, build, start, migrate, seed, test)
- tsconfig.json (strict)
- .eslintrc.cjs, .prettierrc
- .env.example (OPENAI_API_KEY, PROVIDER, OPENAI_MODEL, KNEX_CLIENT, DATABASE_URL, PORT, LOG_LEVEL)
- knexfile.cjs
