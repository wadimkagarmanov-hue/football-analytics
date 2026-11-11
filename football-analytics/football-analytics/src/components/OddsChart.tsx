'use client';

import { useMemo, useState } from 'react';
import { fmtDateTime } from '@/lib/format';
import type { OddsQuote } from '@/lib/types';

// Цвета линий различимы в светлой и тёмной теме; различие дублируется подписью в легенде.
const COLORS = ['#2563eb', '#d97706', '#16a34a', '#db2777', '#7c3aed', '#0891b2', '#65a30d', '#dc2626'];
const W = 720;
const H = 260;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

export default function OddsChart({ quotes }: { quotes: OddsQuote[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const model = useMemo(() => {
    const pts = quotes.flatMap((q) => q.history.map((h) => ({ t: Date.parse(h.t), p: h.p })));
    if (!pts.length) return null;
    const t0 = Math.min(...pts.map((p) => p.t));
    const t1 = Math.max(...pts.map((p) => p.t));
    let lo = Math.min(...pts.map((p) => p.p));
    let hi = Math.max(...pts.map((p) => p.p));
    if (hi - lo < 0.1) {
      lo -= 0.05;
      hi += 0.05;
    }
    const padY = (hi - lo) * 0.1;
    lo -= padY;
    hi += padY;
    const x = (t: number) => PAD.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (p: number) => PAD.t + (1 - (p - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const series = quotes.map((q, i) => ({
      name: q.bookmaker,
      color: COLORS[i % COLORS.length],
      path: q.history.map((h, k) => `${k ? 'L' : 'M'}${x(Date.parse(h.t)).toFixed(1)},${y(h.p).toFixed(1)}`).join(' '),
      last: q.history[q.history.length - 1],
      first: q.history[0],
    }));
    const yTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    const xTicks = Array.from({ length: 4 }, (_, i) => t0 + ((t1 - t0) * i) / 3);
    return { series, x, y, yTicks, xTicks, t0, t1 };
  }, [quotes]);

  if (!model) return <p className="px-3 py-6 text-center text-sm text-muted">Нет истории коэффициентов.</p>;
  const single = quotes.every((q) => q.history.length < 2);

  return (
    <div className="p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="График движения коэффициентов по времени">
        {model.yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={model.y(v)} y2={model.y(v)} stroke="rgb(var(--line))" strokeWidth="1" />
            <text x={PAD.l - 6} y={model.y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {model.xTicks.map((t) => (
          <text key={t} x={model.x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">
            {fmtDateTime(new Date(t).toISOString())}
          </text>
        ))}
        {model.series.map((s) => (
          <g key={s.name} opacity={hover && hover !== s.name ? 0.2 : 1}>
            <path d={s.path} fill="none" stroke={s.color} strokeWidth={hover === s.name ? 3 : 2} strokeLinejoin="round" />
            <circle cx={model.x(Date.parse(s.last.t))} cy={model.y(s.last.p)} r="3.5" fill={s.color}>
              <title>{`${s.name}: ${s.last.p.toFixed(2)} (было ${s.first.p.toFixed(2)})`}</title>
            </circle>
          </g>
        ))}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {model.series.map((s) => {
          const d = Math.round((s.last.p - s.first.p) * 100) / 100;
          return (
            <li key={s.name}>
              <button
                type="button"
                className="inline-flex items-center gap-1.5"
                onMouseEnter={() => setHover(s.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.name)}
                onBlur={() => setHover(null)}
              >
                <span className="inline-block h-0.5 w-4" style={{ background: s.color, height: 3 }} />
                {s.name}: <b className="tabular-nums">{s.last.p.toFixed(2)}</b>
                <span className={d > 0 ? 'text-up' : d < 0 ? 'text-down' : 'text-muted'}>
                  {d > 0 ? ' ▲' : d < 0 ? ' ▼' : ' •'}
                  {d !== 0 ? Math.abs(d).toFixed(2) : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {single && <p className="mt-2 text-xs text-muted">История копится по мере обновлений (её записывает фоновый воркер) — пока доступна одна точка.</p>}
    </div>
  );
}
