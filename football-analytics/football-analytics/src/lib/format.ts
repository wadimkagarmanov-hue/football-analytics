import { TZ } from './config';

const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, ...o });

export const fmtDate = (iso: string) => dtf({ day: '2-digit', month: 'short', weekday: 'short' }).format(new Date(iso));
export const fmtTime = (iso: string) => dtf({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const fmtTimeSec = (iso: string) =>
  dtf({ hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  dtf({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const fmtOdd = (n?: number | null) => (n == null ? '—' : n.toFixed(2));
export const fmtPct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const fmtNum = (n: number | null | undefined, d = 2) => (n == null ? '—' : n.toFixed(d));

/** Смещение часового пояса в минутах на заданный момент */
export function tzOffsetMin(tz: string, at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part ?? '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Сегодняшняя дата YYYY-MM-DD в отображаемом часовом поясе */
export function todayStr(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Начало суток (UTC-миллисекунды) для даты YYYY-MM-DD в отображаемом поясе */
export function startOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return utc - tzOffsetMin(TZ, new Date(utc)) * 60000;
}

export const isDateStr = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
