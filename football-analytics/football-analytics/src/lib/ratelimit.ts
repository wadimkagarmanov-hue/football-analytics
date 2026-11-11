// Ограничитель запросов к провайдерам: скользящие окна «в минуту» и «в сутки».
// Лимиты задаются переменными RATE_LIMIT_PER_MIN_<ИМЯ> и RATE_LIMIT_PER_DAY_<ИМЯ>.

export class RateLimitError extends Error {
  constructor(source: string) {
    super(`Rate limit reached for provider "${source}"`);
  }
}

const g = globalThis as unknown as { __hits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__hits ??= new Map());

function limitsFor(source: string) {
  const k = source.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (k === 'MOCK') return { min: Infinity, day: Infinity };
  return {
    min: Number(process.env[`RATE_LIMIT_PER_MIN_${k}`] || 30),
    day: Number(process.env[`RATE_LIMIT_PER_DAY_${k}`] || 1000),
  };
}

export const limiter = {
  /** Пытается занять слот. false — лимит исчерпан, запрос делать нельзя. */
  take(source: string): boolean {
    const now = Date.now();
    const { min, day } = limitsFor(source);
    const arr = (hits.get(source) ?? []).filter((t) => now - t < 24 * 3600e3);
    const lastMinute = arr.filter((t) => now - t < 60e3).length;
    if (lastMinute >= min || arr.length >= day) {
      hits.set(source, arr);
      return false;
    }
    arr.push(now);
    hits.set(source, arr);
    return true;
  },
  usage(source: string) {
    const now = Date.now();
    const arr = hits.get(source) ?? [];
    return { lastMinute: arr.filter((t) => now - t < 60e3).length, lastDay: arr.filter((t) => now - t < 24 * 3600e3).length };
  },
};
