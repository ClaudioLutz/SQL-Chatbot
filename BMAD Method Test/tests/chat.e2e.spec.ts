import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server';

// Ensure MOCK translator is enabled for the test run (no real LLM calls)
beforeAll(() => {
  process.env.MOCK_TRANSLATOR = '1';
  process.env.PROVIDER = process.env.PROVIDER || 'openai';
  process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
});

describe('POST /api/chat (e2e)', () => {
  it('answers a question and returns SQL + rows', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ question: 'How many orders did Alice place in 2024?' })
      .expect(200);

    // Basic shape
    expect(res.body).toBeTruthy();
    expect(typeof res.body.answer).toBe('string');
    expect(typeof res.body.sql).toBe('string');
    expect(typeof res.body.rowsCount).toBe('number');
    expect(typeof res.body.elapsedMs).toBe('number');

    // Should be SELECT-only SQL
    expect(res.body.sql.toUpperCase()).toContain('SELECT');

    // In MOCK mode for this question, we expect a single row with a 'cnt' column
    if (Array.isArray(res.body.rows) && res.body.rows.length > 0) {
      const row0 = res.body.rows[0];
      // SQLite typically returns numbers as numbers; ensure presence
      expect(row0).toHaveProperty('cnt');
    }
  });

  it('returns safe fallback when question is empty', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ question: '' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });
});
