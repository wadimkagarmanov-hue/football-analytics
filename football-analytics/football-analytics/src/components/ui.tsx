import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtTimeSec } from '@/lib/format';
import type { Res } from '@/lib/analytics';

export function Section({ title, right, children, id }: { title: string; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card overflow-hidden">
      <div className="card-title">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="card px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`kpi mt-1 ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** «Обновлено» + источник; подсвечивает устаревшие данные. */
export function UpdatedAt({ at, source, stale }: { at: string; source?: string; stale?: boolean }) {
  return (
    <span className={`text-xs ${stale ? 'text-down' : 'text-muted'}`}>
      Обновлено {fmtTimeSec(at)}
      {source ? ` · ${source}` : ''}
      {stale ? ' · данные устарели (лимит провайдера или ошибка)' : ''}
    </span>
  );
}

const RES_STYLE: Record<Res, string> = { W: 'bg-up text-white', D: 'bg-muted text-white', L: 'bg-down text-white' };
const RES_LABEL: Record<Res, string> = { W: 'В', D: 'Н', L: 'П' };

export function FormStrip({ form }: { form: Res[] }) {
  if (!form.length) return <span className="text-xs text-muted">нет матчей</span>;
  return (
    <span className="inline-flex gap-0.5" aria-label={`Форма: ${form.map((r) => RES_LABEL[r]).join(' ')}`}>
      {form.map((r, i) => (
        <span key={i} className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${RES_STYLE[r]}`}>
          {RES_LABEL[r]}
        </span>
      ))}
    </span>
  );
}

/** Сравнение двух значений полосой. */
export function StatBar({
  label,
  home,
  away,
  digits = 1,
  suffix = '',
  lowerIsBetter = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  digits?: number;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const hw = (h / total) * 100;
  const better = home == null || away == null || h === a ? 0 : (h > a) !== lowerIsBetter ? 1 : 2;
  const f = (v: number | null) => (v == null ? '—' : v.toFixed(digits) + suffix);
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between text-sm tabular-nums">
        <span className={better === 1 ? 'font-bold' : 'text-muted'}>{f(home)}</span>
        <span className="text-xs text-muted">{label}</span>
        <span className={better === 2 ? 'font-bold' : 'text-muted'}>{f(away)}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-panel2">
        <div className="bg-accent" style={{ width: `${hw}%` }} />
        <div className="bg-muted/60" style={{ width: `${100 - hw}%` }} />
      </div>
    </div>
  );
}

export function TeamLink({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  return (
    <Link href={`/team/${id}`} className={`hover:text-accent hover:underline ${className}`}>
      {name}
    </Link>
  );
}

export function CsvButton({ href, label = 'CSV' }: { href: string; label?: string }) {
  return (
    <a href={href} className="btn" download>
      ⬇ {label}
    </a>
  );
}
