import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';
import chatRouter from './routes/chat';

const PORT = Number(process.env.PORT ?? 3000);
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const httpLogger = pinoHttp({
  logger,
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

// API routes
app.use('/api', chatRouter);

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
