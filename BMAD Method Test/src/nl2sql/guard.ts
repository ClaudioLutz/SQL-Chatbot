import { DatabaseSchema } from './schema';

export type ValidationResult = {
  valid: boolean;
  issues: string[];
};

const WRITE_KEYWORDS = [
  'CREATE',
  'ALTER',
  'DROP',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REPLACE',
  'MERGE',
  'VACUUM',
];

const TEMP_TABLE_PATTERNS = [
  /\bCREATE\s+TEMP\b/i,
  /\bCREATE\s+TEMPORARY\b/i,
  /\bINTO\s+TEMP\b/i,
  /\bINTO\s+TEMPORARY\b/i,
  /\bGLOBAL\s+TEMPORARY\b/i,
];

const DATA_MODIFYING_CTE_PAT = /\bWITH\s+[\s\S]*?\b(INSERT|UPDATE|DELETE|MERGE)\b/si;

export function validateSql(sql: string, schema: DatabaseSchema): ValidationResult {
  const issues: string[] = [];
  const normalized = sql.trim();

  if (normalized.length === 0) {
    return { valid: false, issues: ['Empty SQL.'] };
  }

  // Forbid multi-statement attempts by semicolon chaining (allow single trailing ;)
  const semicolons = (normalized.match(/;/g) || []).length;
  if (semicolons > 1 || (semicolons === 1 && !normalized.endsWith(';'))) {
    issues.push('Multiple SQL statements detected; only a single SELECT is allowed.');
  }

  // Allow WITH ... SELECT ... or plain SELECT ...
  const upper = normalized.toUpperCase();
  if (!(upper.startsWith('SELECT') || upper.startsWith('WITH'))) {
    issues.push('Only SELECT statements are allowed (SELECT or WITH ... SELECT).');
  }

  // Forbid write/DDL/DML keywords anywhere
  for (const kw of WRITE_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(normalized)) {
      issues.push(`Forbidden keyword detected: ${kw}`);
    }
  }

  // Forbid temp tables
  if (TEMP_TABLE_PATTERNS.some((r) => r.test(normalized))) {
    issues.push('Temporary tables are not allowed.');
  }

  // Forbid data-modifying CTEs
  if (DATA_MODIFYING_CTE_PAT.test(normalized)) {
    issues.push('Data-modifying CTEs are not allowed.');
  }

  // Enforce LIMIT <= 100 (default LIMIT 100 if absent is required by prompt; guard enforces cap)
  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)/i);
  if (!limitMatch) {
    issues.push('Missing LIMIT. Include LIMIT 100 (or fewer if requested).');
  } else {
    const n = Number(limitMatch[1]);
    if (!Number.isFinite(n)) {
      issues.push('Non-numeric LIMIT detected.');
    } else if (n > 100) {
      issues.push('LIMIT exceeds 100. Clamp to 100.');
    } else if (n <= 0) {
      issues.push('LIMIT must be positive.');
    }
  }

  // Table allow-list: FROM/JOIN targets must be in schema
  const usedTables = extractTableIdentifiers(normalized);
  for (const t of usedTables) {
    if (!schema.tables.some((s) => s.name === t)) {
      issues.push(`Table not in allow-list: ${t}`);
    }
  }

  // Column allow-list (best-effort): validate dotted identifiers table.column
  const dottedCols = extractDottedColumns(normalized);
  for (const { table, column } of dottedCols) {
    const tableDef = schema.tables.find((t) => t.name === table);
    if (!tableDef) {
      // Already flagged as table not in allow-list
      continue;
    }
    if (!tableDef.columns.includes(column)) {
      issues.push(`Column not in allow-list: ${table}.${column}`);
    }
  }

  // Basic sanity: SQL must include SELECT word somewhere
  if (!/\bSELECT\b/i.test(normalized)) {
    issues.push('No SELECT clause found.');
  }

  return { valid: issues.length === 0, issues };
}

function extractTableIdentifiers(sql: string): string[] {
  // Very simple SQL tokenization for FROM and JOIN clauses, ignoring subqueries/aliases complexity.
  // This is best-effort and not a full parser.
  const tables = new Set<string>();
  const cteNames = new Set<string>();
  
  // First, extract CTE names from WITH clauses
  const cteRegex = /\bWITH\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  let cteMatch: RegExpExecArray | null;
  while ((cteMatch = cteRegex.exec(sql)) !== null) {
    const cteName = ((cteMatch[1] as string) || '').trim();
    if (cteName) cteNames.add(cteName);
  }
  
  // Then extract table names from FROM and JOIN clauses
  const fromJoinRegex = /\b(FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*|\s+[a-zA-Z_][a-zA-Z0-9_]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = fromJoinRegex.exec(sql)) !== null) {
    const name = ((m[2] as string) || '').trim();
    // Only add to tables if it's not a CTE name
    if (name && !cteNames.has(name)) {
      tables.add(name);
    }
  }
  return Array.from(tables);
}

function extractDottedColumns(sql: string): { table: string; column: string }[] {
  const pairs: { table: string; column: string }[] = [];
  const re = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1] as string;
    const column = m[2] as string;
    pairs.push({ table, column });
  }
  return pairs;
}
