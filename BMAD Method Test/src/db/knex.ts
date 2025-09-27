import knex, { Knex } from 'knex';
import { env } from '../config/env';

let knexInstance: Knex | null = null;

function createConfig(): Knex.Config {
  const client = env.KNEX_CLIENT; // 'sqlite3' | 'pg'
  const baseConfig = {
    debug: true, // Enable SQL query logging
    log: {
      warn: (message: any) => console.warn('Knex Warning:', message),
      error: (message: any) => console.error('Knex Error:', message),
      debug: (message: any) => {
        if (message.sql) {
          console.log('SQL:', message.sql);
          if (message.bindings && message.bindings.length > 0) {
            console.log('Params:', message.bindings);
          }
        } else {
          console.log('Knex Debug:', message);
        }
      },
    },
  };

  if (client === 'sqlite3') {
    return {
      ...baseConfig,
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
    ...baseConfig,
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
  // knex for sqlite3 returns the rows array directly
  const result = await db.raw(sql, bindings);
  const rows = Array.isArray(result) ? result : [];
  return { rows, count: rows.length };
}

// Close DB (for tests)
export async function closeDb(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}
