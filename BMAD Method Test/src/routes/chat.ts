import { Router, Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { env, requireOpenAI } from '../config/env';
import { runQuery } from '../db/knex';
import { dbSchema } from '../nl2sql/schema';
import { buildPrompt } from '../nl2sql/prompt';
import { translateQuestion, reviseWithFeedback, TranslationResult } from '../nl2sql/translator';
import { validateSql } from '../nl2sql/guard';
import { appendAudit } from '../observability/audit';

const router = Router();

/**
 * POST /api/chat
 * Body: { question: string }
 * Response: { answer, sql, rowsCount, elapsedMs, rows? }
 */
router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  const started = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || nanoid();

  try {
    const { question } = req.body ?? {};
    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'question is required' });
    }

    // Build prompt context (schema + safety rules)
    const prompt = buildPrompt({
      question,
      schema: dbSchema,
    });
    const mockFlag = !!env.MOCK_TRANSLATOR || (env.PROVIDER === 'openai' && !env.OPENAI_API_KEY);

    // Translate to SQL (use MOCK if set, otherwise OpenAI)
    if (!mockFlag) {
      if (env.PROVIDER === 'openai') {
        requireOpenAI();
      }
    }

    let tr: TranslationResult = await translateQuestion({
      question,
      prompt,
      provider: env.PROVIDER,
      model: env.OPENAI_MODEL,
      mock: mockFlag,
    });

    // Validate candidate SQL
    let validation = validateSql(tr.sql, dbSchema);
    let revised = false;

    if (!validation.valid) {
      // One auto-revise attempt
      const feedback = validation.issues.join('; ');
      const tr2 = await reviseWithFeedback({
        question,
        lastSql: tr.sql,
        feedback,
        provider: env.PROVIDER,
        model: env.OPENAI_MODEL,
        mock: mockFlag,
      });
      revised = true;
      tr = tr2;
      validation = validateSql(tr.sql, dbSchema);
    }

    if (!validation.valid) {
      const elapsedMs = Date.now() - started;
      await appendAudit({
        ts: new Date().toISOString(),
        requestId,
        question,
        sql: tr.sql,
        validation,
        revised,
        outcome: 'unsafe',
        rowsCount: 0,
        elapsedMs,
      });
      return res.status(200).json({
        answer: 'Cannot safely answer.',
        sql: '',
        rowsCount: 0,
        elapsedMs,
      });
    }

    // Execute safely with parameter binding
    const { rows, count } = await runQuery(tr.sql, tr.parameters ?? []);
    const elapsedMs = Date.now() - started;

    await appendAudit({
      ts: new Date().toISOString(),
      requestId,
      question,
      sql: tr.sql,
      validation,
      revised,
      outcome: 'answered',
      rowsCount: count,
      elapsedMs,
    });

    return res.status(200).json({
      answer: tr.answer_short,
      sql: tr.sql,
      parameters: tr.parameters ?? [],
      rowsCount: count,
      elapsedMs,
      rows: Array.isArray(rows) ? rows.slice(0, 20) : [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
