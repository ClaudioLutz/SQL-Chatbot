import React, { useState } from 'react';

type ChatResponse = {
  answer: string;
  sql: string;
  rowsCount: number;
  elapsedMs: number;
  rows?: Record<string, any>[];
  error?: string;
};

export function Chat() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ChatResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResp(null);
    const q = question.trim();
    if (!q) {
      setErr('Please enter a question.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = (await r.json()) as ChatResponse;
      if (!r.ok) {
        setErr(data?.error || `Request failed with status ${r.status}`);
      } else {
        setResp(data);
      }
    } catch (e: any) {
      setErr(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>SQL Chatbot v0</h1>
      <form onSubmit={onSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="text"
          placeholder='Ask a question, e.g., "Top 5 cities by total order revenue last quarter"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Asking...' : 'Ask'}
        </button>
      </form>

      {err && <div style={styles.error}>Error: {err}</div>}

      {resp && (
        <div style={styles.panel}>
          <div style={styles.row}>
            <div style={styles.label}>Answer</div>
            <div>{resp.answer}</div>
          </div>
          <div style={styles.row}>
            <div style={styles.label}>SQL</div>
            <pre style={styles.pre}>{resp.sql || '(none)'}</pre>
          </div>
          <div style={styles.row}>
            <div style={styles.label}>Rows</div>
            <div>
              {resp.rowsCount} row(s) in {resp.elapsedMs} ms
            </div>
          </div>
          {Array.isArray(resp.rows) && resp.rows.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <TablePreview rows={resp.rows} />
            </div>
          )}
        </div>
      )}

      <div style={styles.hint}>
        Examples:
        <ul>
          <li>Top 5 cities by total order revenue last quarter</li>
          <li>Products in "Accessories" with avg order qty {'>'} 2</li>
          <li>How many orders did Alice place in 2024?</li>
          <li>10 most expensive products and their average quantity per order</li>
        </ul>
      </div>
    </div>
  );
}

function TablePreview({ rows }: { rows: Record<string, any>[] }) {
  const cols = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={styles.th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} style={styles.td}>
                  {formatCell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && <div style={styles.note}>Showing first 20 rows.</div>}
    </div>
  );
}

function formatCell(v: any) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: '40px auto',
    padding: '0 16px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  h1: { fontSize: 28, marginBottom: 16 },
  form: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    padding: '10px 12px',
    fontSize: 16,
    border: '1px solid #ccc',
    borderRadius: 6,
  },
  button: {
    padding: '10px 14px',
    fontSize: 16,
    borderRadius: 6,
    border: '1px solid #444',
    background: '#222',
    color: 'white',
    cursor: 'pointer',
  },
  error: {
    color: '#b00020',
    background: '#fde7e9',
    padding: '8px 10px',
    borderRadius: 6,
    marginTop: 8,
  },
  panel: {
    border: '1px solid #eee',
    borderRadius: 8,
    padding: 12,
    background: '#fafafa',
  },
  row: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 10 },
  label: { fontWeight: 600, color: '#444' },
  pre: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#fff',
    padding: 10,
    border: '1px solid #eee',
    borderRadius: 6,
  },
  table: { borderCollapse: 'collapse', width: '100%' },
  th: { textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px' },
  td: { borderBottom: '1px solid #eee', padding: '6px 8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  note: { fontSize: 12, color: '#666', marginTop: 6 },
  hint: { marginTop: 20, color: '#666' },
};
