'use client';

import { useMemo, useState } from 'react';
import { calcFromOdds } from '@/lib/odds';
import { fmtPct } from '@/lib/format';

// Калькулятор: коэффициент → подразумеваемая вероятность; набор исходов → маржа и «честные» вероятности.

const parse = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 1 ? n : null;
};

export default function Calculator({ initial }: { initial?: { '1': number; X: number; '2': number } }) {
  const [single, setSingle] = useState('2.00');
  const [set, setSet] = useState<string[]>(
    initial ? [initial['1'], initial.X, initial['2']].map((x) => x.toFixed(2)) : ['2.10', '3.40', '3.60'],
  );
  const labels = ['П1', 'Х', 'П2'];

  const s = parse(single);
  const parsed = set.map(parse);
  const full = parsed.every((x) => x != null) ? calcFromOdds(parsed as number[]) : null;

  const fairOdds = useMemo(() => (full ? full.fairOdds : null), [full]);

  return (
    <div className="grid gap-4 p-3 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Один коэффициент</h3>
        <label className="flex items-center gap-2 text-sm">
          Коэффициент
          <input className="input w-24 tabular-nums" inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} aria-label="Коэффициент" />
        </label>
        <p className="mt-3 text-xs text-muted">Подразумеваемая вероятность (с учётом маржи)</p>
        <p className="kpi mt-1">{s ? fmtPct(1 / s) : '—'}</p>
        {!s && <p className="mt-1 text-xs text-muted">Введите число больше 1.</p>}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Все исходы события (1X2)</h3>
        <div className="flex flex-wrap gap-2">
          {labels.map((l, i) => (
            <label key={l} className="text-sm">
              <span className="mb-0.5 block text-xs text-muted">{l}</span>
              <input
                className="input w-20 tabular-nums"
                inputMode="decimal"
                value={set[i]}
                onChange={(e) => setSet((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                aria-label={`Коэффициент ${l}`}
              />
            </label>
          ))}
        </div>
        {full ? (
          <>
            <p className="mt-3 text-xs text-muted">Маржа букмекера</p>
            <p className="kpi mt-1">{fmtPct(full.margin, 2)}</p>
            <table className="tbl mt-3">
              <thead>
                <tr>
                  <th />
                  {labels.map((l) => (
                    <th key={l} className="text-right">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Подразумеваемая</td>
                  {full.implied.map((v, i) => (
                    <td key={i} className="text-right">
                      {fmtPct(v)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Без маржи</td>
                  {full.fair.map((v, i) => (
                    <td key={i} className="text-right font-semibold">
                      {fmtPct(v)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>«Честный» коэфф.</td>
                  {fairOdds!.map((v, i) => (
                    <td key={i} className="text-right">
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="mt-3 text-xs text-muted">Введите три коэффициента больше 1.</p>
        )}
        <p className="mt-3 text-xs text-muted">Расчёт справочный: вероятности рынка не являются прогнозом результата.</p>
      </div>
    </div>
  );
}
