import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PROVIDER: z.string().default('openai'),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  OPENAI_API_KEY: z.string().optional(),
  KNEX_CLIENT: z.enum(['sqlite3', 'pg']).default('sqlite3'),
  DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.string().optional(),
  MOCK_TRANSLATOR: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .transform((v) => (v === '1' || v === 1 || v === true ? '1' : undefined)),
});

export const env = EnvSchema.parse(process.env);

export function requireOpenAI() {
  if (env.PROVIDER !== 'openai') {
    throw new Error(`Unsupported PROVIDER=${env.PROVIDER}. Only 'openai' is supported in v0.`);
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for OpenAI provider.');
  }
}

export type AppEnv = typeof env;
