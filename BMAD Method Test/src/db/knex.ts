import knex, { Knex } from 'knex';
import { env } from '../config/env';

let knexInstance: Knex | null = null;

function createConfig(): Knex.Config {
  const client = env.KNEX_CLIENT; // 'sqlite3' | 'pg'
  if (client === 'sqlite3') {
    return {
      client: 'sqlite3',
      connection: {
        filename: './db.sqlite',
      },
      useNullAsDefault: true,
      pool: { min: 0, max: 1 },
    };
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when KNEX_CLIENT=pg');
  }
  return {
    client: 'pg',
    connection: env.DATABASE_URL,
    pool: { min: 0, max: 5 },
  };
}

export function getDb(): Knex {
  if (!knexInstance) {
    knexInstance = knex(createConfig());
  }
  return knexInstance;
}

// Helper to run a raw SQL with parameters safely
export async function runQuery<T = any>(sql: string, bindings: readonly any[] = []): Promise<{ rows: T[]; count: number; }> {
  const db = getDb();
  if (env.KNEX_CLIENT === 'pg') {
    const result = await db.raw(sql, bindings);
    // pg returns { rows: [...] }
    const rows = (result as any).rows ?? [];
    return { rows, count: rows.length };
  }
  // sqlite:
  // knex for sqlite3 returns { rows: [...] } via better-sqlite3 dialect or array in result
  const result = await db.raw(sql, bindings);
  const rows = (result as any)?.[0] ?? (result as any).rows ?? result ?? [];
  const normalized = Array.isArray(rows) ? rows : [];
  return { rows: normalized, count: normalized.length };
}

// Close DB (for tests)
export async function closeDb(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}
