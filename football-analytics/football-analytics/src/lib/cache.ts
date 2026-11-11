import { db } from './db';
import { limiter, RateLimitError } from './ratelimit';

export interface Provenance<T> {
  data: T;
  fetchedAt: string; // когда данные получены от провайдера
  source: string; // имя провайдера
  stale?: boolean; // true — отдан устаревший кэш (лимит исчерпан или провайдер недоступен)
}

interface Entry {
  value: unknown;
  at: number;
}

const g = globalThis as unknown as { __mem?: Map<string, Entry>; __inflight?: Map<string, Promise<unknown>> };
const mem: Map<string, Entry> = (g.__mem ??= new Map());
const inflight: Map<string, Promise<unknown>> = (g.__inflight ??= new Map());

const wrap = <T>(e: Entry, source: string, stale = false): Provenance<T> => ({
  data: e.value as T,
  fetchedAt: new Date(e.at).toISOString(),
  source,
  ...(stale ? { stale: true } : {}),
});

/**
 * Кэш с TTL: память процесса → таблица api_cache (если есть БД) → провайдер.
 * - одинаковые одновременные запросы схлопываются в один;
 * - перед обращением к провайдеру занимается слот лимитера;
 * - при ошибке или исчерпанном лимите отдаётся устаревший кэш с пометкой stale.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  source: string,
  fn: () => Promise<T>,
  opts: { force?: boolean } = {},
): Promise<Provenance<T>> {
  let hit = mem.get(key);

  if (!hit) {
    const pool = db();
    if (pool) {
      try {
        const r = await pool.query('select value, fetched_at from api_cache where key = $1', [key]);
        if (r.rows[0]) {
          hit = { value: r.rows[0].value, at: new Date(r.rows[0].fetched_at).getTime() };
          mem.set(key, hit);
        }
      } catch {
        /* БД недоступна — работаем без неё */
      }
    }
  }

  if (hit && !opts.force && Date.now() - hit.at < ttlMs) return wrap<T>(hit, source);

  const running = inflight.get(key) as Promise<Provenance<T>> | undefined;
  if (running) return running;

  const staleHit = hit;
  const p = (async (): Promise<Provenance<T>> => {
    try {
      if (!limiter.take(source)) throw new RateLimitError(source);
      const value = await fn();
      const entry: Entry = { value, at: Date.now() };
      mem.set(key, entry);
      const pool = db();
      if (pool) {
        pool
          .query(
            `insert into api_cache (key, value, fetched_at) values ($1, $2, now())
             on conflict (key) do update set value = excluded.value, fetched_at = now()`,
            [key, JSON.stringify(value ?? null)],
          )
          .catch(() => {});
      }
      return wrap<T>(entry, source);
    } catch (err) {
      if (staleHit) return wrap<T>(staleHit, source, true);
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
