import { Pool } from 'pg';

const g = globalThis as unknown as { __pgPool?: Pool | null };

/** Пул соединений или null, если DATABASE_URL не задан (сайт тогда работает без БД). */
export function db(): Pool | null {
  if (g.__pgPool !== undefined) return g.__pgPool;
  if (!process.env.DATABASE_URL) {
    g.__pgPool = null;
    return null;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  pool.on('error', (e) => console.error('[pg]', e.message));
  g.__pgPool = pool;
  return pool;
}
