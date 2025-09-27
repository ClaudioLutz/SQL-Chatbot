import { DatabaseSchema } from './schema';

export type BuildPromptArgs = {
  question: string;
  schema: DatabaseSchema;
};

export function buildPrompt({ question, schema }: BuildPromptArgs): string {
  const schemaText = renderSchema(schema);

  return [
    'You are a SQL generator for a known database schema.',
    'Your task: translate a natural-language question into a single, safe, read-only SQL statement and a brief English answer.',
    '',
    'Hard constraints (must follow exactly):',
    '- SELECT-only. Absolutely forbid DDL/DML of any kind (CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE/REPLACE).',
    '- No temp tables; no data-modifying CTEs.',
    '- Only reference the allow-listed tables and columns below.',
    '- Parameterize all user-provided values. Do NOT concatenate untrusted input.',
    '- Always include a LIMIT 100 unless the user explicitly asks for fewer.',
    '- Use a portable subset of SQL that runs on SQLite and Postgres.',
    '- Time semantics: UTC; calendar quarters (Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec).',
    '- Relative periods (e.g., last quarter) are computed relative to current server UTC date.',
    '',
    'Output format (JSON, no commentary, no code fences):',
    '{',
    '  "sql": "SELECT ... LIMIT 100",',
    '  "parameters": [/* ordered parameter values to bind */],',
    '  "answer_short": "A one-sentence English answer to the question based on the query result."',
    '}',
    '',
    'Allowed schema:',
    schemaText,
    '',
    'Question:',
    question.trim(),
  ].join('\n');
}

function renderSchema(schema: DatabaseSchema): string {
  const lines: string[] = [];
  for (const t of schema.tables) {
    lines.push(`- ${t.name}(${t.columns.join(', ')})`);
  }
  return lines.join('\n');
}
