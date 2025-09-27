import { promises as fs } from 'fs';
import path from 'path';

export type AuditValidation = {
  valid: boolean;
  issues: string[];
};

export type AuditEntry = {
  ts: string; // ISO timestamp
  requestId: string;
  question: string;
  sql: string;
  validation: AuditValidation;
  revised: boolean;
  outcome: 'answered' | 'unsafe' | 'validation_error';
  rowsCount: number;
  elapsedMs: number;
};

const AUDIT_DIR = path.resolve('.', 'audits');
const AUDIT_PATH = path.join(AUDIT_DIR, 'log.jsonl');

export async function appendAudit(entry: AuditEntry): Promise<void> {
  const line = JSON.stringify(entry) + '\n';
  await ensureDir(AUDIT_DIR);
  await fs.appendFile(AUDIT_PATH, line, 'utf8');
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}
