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

  it('handles "last quarter" time queries and returns results', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ question: 'Top 5 cities by total order revenue last quarter' })
      .expect(200);

    // Basic shape validation
    expect(res.body).toBeTruthy();
    expect(typeof res.body.answer).toBe('string');
    expect(typeof res.body.sql).toBe('string');
    expect(typeof res.body.rowsCount).toBe('number');
    expect(typeof res.body.elapsedMs).toBe('number');

    // Should be SELECT-only SQL
    expect(res.body.sql.toUpperCase()).toContain('SELECT');
    
    // Should contain time filtering with parameters
    expect(res.body.sql).toContain('o.order_date >= ?');
    expect(res.body.sql).toContain('o.order_date <= ?');
    
    // Should have parameters for time bounds
    expect(Array.isArray(res.body.parameters)).toBe(true);
    expect(res.body.parameters.length).toBe(2);
    
    // Parameters should be date strings (YYYY-MM-DD format)
    expect(res.body.parameters[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.parameters[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Should have proper response structure (rows might be 0 if no cities have data)
    expect(typeof res.body.rowsCount).toBe('number');
    expect(Array.isArray(res.body.rows)).toBe(true);
    
    // If we have rows, validate their structure
    if (res.body.rows.length > 0) {
      const row0 = res.body.rows[0];
      expect(row0).toHaveProperty('city');
      expect(row0).toHaveProperty('revenue');
      expect(typeof row0.revenue).toBe('number');
    }
  });
});
