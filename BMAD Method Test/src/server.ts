import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';
import chatRouter from './routes/chat';
import { getDb, runQuery } from './db/knex';

const PORT = Number(process.env.PORT ?? 3001);
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const httpLogger = pinoHttp({
  logger: logger as any,
  genReqId: (req) => (req.headers['x-request-id'] as string) || nanoid(),
  serializers: {
    req(req) {
      return { method: req.method, url: req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(httpLogger);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Database health check
app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.raw('SELECT 1 as test');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    res.status(503).json({ ok: false, database: 'disconnected', error: 'Database connection failed' });
  }
});

// Debug counts endpoint
app.get('/debug/counts', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const [customers, products, orders, orderItems] = await Promise.all([
      db('customers').count('* as count').first(),
      db('products').count('* as count').first(),
      db('orders').count('* as count').first(),
      db('order_items').count('* as count').first(),
    ]);

    // Get date range for orders
    const dateRange = await db('orders')
      .select(db.raw('MIN(order_date) as earliest, MAX(order_date) as latest'))
      .first();

    // Get last quarter bounds (UTC)
    const now = new Date();
    const month = now.getUTCMonth();
    const year = now.getUTCFullYear();
    const currentQuarter = Math.floor(month / 3) + 1;
    let q = currentQuarter - 1;
    let y = year;
    if (q < 1) {
      q = 4;
      y = year - 1;
    }
    const startMonth = (q - 1) * 3;
    const qStart = new Date(Date.UTC(y, startMonth, 1));
    const qEnd = new Date(Date.UTC(y, startMonth + 3, 1) - 1);
    
    const startDate = qStart.toISOString().split('T')[0];
    const endDate = qEnd.toISOString().split('T')[0];
    
    const lastQuarterOrders = await db.raw(
      'SELECT COUNT(*) as count FROM orders WHERE order_date >= ? AND order_date <= ?',
      [startDate, endDate]
    );
    
    const lastQuarterCount = db.client.config.client === 'pg' 
      ? lastQuarterOrders.rows[0]?.count || 0
      : lastQuarterOrders[0]?.count || 0;

    res.json({
      counts: {
        customers: customers?.count || 0,
        products: products?.count || 0,
        orders: orders?.count || 0,
        order_items: orderItems?.count || 0
      },
      dateRange,
      lastQuarter: {
        period: `${y} Q${q}`,
        start: qStart.toISOString().split('T')[0],
        end: qEnd.toISOString().split('T')[0],
        orderCount: lastQuarterCount
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get DB counts');
    res.status(500).json({ error: 'Failed to get DB counts' });
  }
});

// Debug SQL endpoint (dev-only, requires safety assertion)
app.post('/debug/sql', async (req: Request, res: Response) => {
  try {
    // Safety check - only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Debug SQL endpoint disabled in production' });
    }

    const { sql, params = [], assertSafe = false } = req.body;
    
    if (!assertSafe) {
      return res.status(400).json({ error: 'Must set assertSafe=true to acknowledge this is a development-only endpoint' });
    }
    
    if (typeof sql !== 'string' || sql.trim().length === 0) {
      return res.status(400).json({ error: 'sql parameter is required' });
    }

    const started = Date.now();
    const { rows, count } = await runQuery(sql, params);
    const elapsedMs = Date.now() - started;
    
    res.json({
      sql,
      params,
      rowsCount: count,
      elapsedMs,
      rows: Array.isArray(rows) ? rows.slice(0, 100) : rows || []
    });
  } catch (error) {
    logger.error({ error }, 'Debug SQL execution failed');
    res.status(500).json({ error: 'SQL execution failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Serve static files from web/dist (built frontend)
const webDistPath = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDistPath));

// API routes
app.use('/api', chatRouter);

// Catch-all handler: serve index.html for client-side routing
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(webDistPath, 'index.html'));
});

// Error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server listening');
  });
}

export default app;
// reload: apply new .env (OPENAI_API_KEY) without manual restart
