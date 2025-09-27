import { describe, it, expect } from 'vitest';
import { validateSql } from '../src/nl2sql/guard';
import { dbSchema } from '../src/nl2sql/schema';

describe('SQL Guard', () => {
  it('accepts a valid read-only SELECT with LIMIT', () => {
    const sql = `
      WITH revenue_by_city AS (
        SELECT c.city AS city, SUM(o.total) AS revenue
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        GROUP BY c.city
      )
      SELECT city, revenue
      FROM revenue_by_city
      ORDER BY revenue DESC
      LIMIT 5;
    `;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('rejects DDL/DML like DROP', () => {
    const sql = `DROP TABLE customers;`;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => /Forbidden keyword/i.test(i))).toBe(true);
  });

  it('enforces LIMIT presence', () => {
    const sql = `SELECT * FROM customers;`;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => /Missing LIMIT/i.test(i))).toBe(true);
  });

  it('clamps excessive LIMITs', () => {
    const sql = `SELECT * FROM customers LIMIT 1000;`;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => /LIMIT exceeds 100/i.test(i))).toBe(true);
  });

  it('rejects tables not in allow-list', () => {
    const sql = `SELECT * FROM hackers LIMIT 1;`;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => /Table not in allow-list/i.test(i))).toBe(true);
  });

  it('rejects data-modifying CTEs', () => {
    const sql = `
      WITH t AS (
        INSERT INTO orders(id) VALUES (1)
        RETURNING id
      )
      SELECT * FROM customers LIMIT 1;
    `;
    const res = validateSql(sql, dbSchema);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => /Data-modifying CTEs/i.test(i))).toBe(true);
  });
});
