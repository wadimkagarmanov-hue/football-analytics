'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_POLL_MS } from '@/lib/config';
import { fmtOdd, fmtTimeSec } from '@/lib/format';
import {
  MARKET_LABEL,
  SELECTIONS,
  SELECTION_LABEL,
  bestBySelection,
  groupByMarket,
  marginForBookmaker,
  movement,
} from '@/lib/odds';
import type { Absence, Lineup, Market, OddsQuote } from '@/lib/types';
import OddsChart from './OddsChart';
import Lineups from './Lineups';

export interface LiveData {
  odds: { quotes: OddsQuote[]; fetchedAt: string; stale?: boolean; source: string } | null;
  lineups: { home: Lineup | null; away: Lineup | null; fetchedAt: string; stale?: boolean } | null;
  absences: { home: Absence[]; away: Absence[] };
  oddsError?: string;
}

const MARKETS: Market[] = ['1X2', 'TOTAL', 'BTTS', 'HANDICAP'];

export default function MatchLive({
  matchId,
  homeName,
  awayName,
  initial,
  finished,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  initial: LiveData;
  finished: boolean;
}) {
  const [data, setData] = useState<LiveData>(initial);
  const [market, setMarket] = useState<Market>('1X2');
  const [lineKey, setLineKey] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string>('1');
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Опрос обновлений. Пауза, когда вкладка скрыта; для завершённых матчей не опрашиваем.
  useEffect(() => {
    if (finished) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/matches/${encodeURIComponent(matchId)}/live`, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        setData(await r.json());
        setFailed(false);
      } catch {
        setFailed(true);
      }
    };
    timer.current = setInterval(tick, LIVE_POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [matchId, finished]);

  const quotes = data.odds?.quotes ?? [];
  const groups = useMemo(() => groupByMarket(quotes), [quotes]);

  // линии выбранного рынка (тотал/форы)
  const lines = useMemo(() => {
    const ls = [...groups.keys()].filter((k) => k.startsWith(`${market}|`)).map((k) => k.split('|')[1]);
    return ls.sort((a, b) => Number(a) - Number(b));
  }, [groups, market]);
  const line = lineKey[market] && lines.includes(lineKey[market]) ? lineKey[market] : lines.includes('2.5') ? '2.5' : lines[0] ?? '';
  const group = groups.get(`${market}|${line}`) ?? [];
  const sels = SELECTIONS[market];
  const selActive = sels.includes(selection) ? selection : sels[0];
  const books = [...new Set(group.map((q) => q.bookmaker))];
  const best = bestBySelection(group);

  const selLabel = (s: string) => (market === 'HANDICAP' && s === 'Home' ? homeName : market === 'HANDICAP' && s === 'Away' ? awayName : SELECTION_LABEL[s]);
  const lineLabel = (l: string) => (market === 'HANDICAP' ? (Number(l) > 0 ? `+${l}` : l) : l);

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="card-title flex-wrap">
          <h2>Коэффициенты букмекеров</h2>
          <span className="text-xs font-normal text-muted">
            {data.odds ? (
              <span className={data.odds.stale || failed ? 'text-down' : ''}>
                Обновлено {fmtTimeSec(data.odds.fetchedAt)} · {data.odds.source}
                {data.odds.stale ? ' · данные устарели' : ''}
                {failed ? ' · нет связи, показаны последние данные' : ''}
                {!finished && !failed && !data.odds.stale ? ` · авто-обновление каждые ${Math.round(LIVE_POLL_MS / 1000)} с` : ''}
              </span>
            ) : (
              'нет данных'
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <div role="tablist" aria-label="Рынок" className="flex gap-1">
            {MARKETS.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={market === m}
                onClick={() => setMarket(m)}
                className={`rounded-md px-2.5 py-1 text-sm ${market === m ? 'bg-accent text-white' : 'hover:bg-panel2'}`}
              >
                {MARKET_LABEL[m]}
              </button>
            ))}
          </div>
          {(market === 'TOTAL' || market === 'HANDICAP') && lines.length > 0 && (
            <label className="flex items-center gap-1 text-sm">
              <span className="text-muted">{market === 'TOTAL' ? 'Линия' : 'Фора хозяев'}</span>
              <select className="input py-1" value={line} onChange={(e) => setLineKey((p) => ({ ...p, [market]: e.target.value }))}>
                {lines.map((l) => (
                  <option key={l} value={l}>
                    {lineLabel(l)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {data.oddsError && !quotes.length ? (
          <p className="px-3 py-6 text-center text-sm text-muted">Коэффициенты временно недоступны: {data.oddsError}</p>
        ) : !group.length ? (
          <p className="px-3 py-6 text-center text-sm text-muted">По этому рынку нет коэффициентов.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Букмекер</th>
                  {sels.map((s) => (
                    <th key={s} className="text-right">
                      {selLabel(s)}
                    </th>
                  ))}
                  <th className="text-right" title="Маржа = сумма (1/коэффициент) − 1">
                    Маржа
                  </th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => {
                  const mg = marginForBookmaker(group, b, market);
                  return (
                    <tr key={b}>
                      <td className="font-medium">{b}</td>
                      {sels.map((s) => {
                        const q = group.find((x) => x.bookmaker === b && x.selection === s);
                        if (!q) return <td key={s} className="text-right text-muted">—</td>;
                        const mv = movement(q);
                        const isBest = q.price === best[s];
                        return (
                          <td key={s} className={`text-right ${isBest ? 'bg-best/25' : ''}`} title={isBest ? 'Лучший коэффициент' : undefined}>
                            <span className={`text-base tabular-nums ${isBest ? 'font-bold' : ''}`}>{fmtOdd(q.price)}</span>
                            <span className={`ml-1 text-xs ${mv.dir === 'up' ? 'text-up' : mv.dir === 'down' ? 'text-down' : 'text-muted'}`}>
                              {mv.dir === 'up' ? '▲' : mv.dir === 'down' ? '▼' : '•'}
                              {mv.dir !== 'flat' ? Math.abs(mv.delta).toFixed(2) : ''}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-right text-muted">{mg == null ? '—' : `${(mg * 100).toFixed(1)}%`}</td>
                    </tr>
                  );
                })}
                <tr className="bg-panel2/60">
                  <td className="text-xs font-semibold uppercase text-muted">Лучший</td>
                  {sels.map((s) => (
                    <td key={s} className="text-right text-base font-bold tabular-nums">
                      {fmtOdd(best[s])}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-xs text-muted">
              Стрелки — изменение относительно начала отслеживаемой истории (▲ рост, ▼ падение). Жёлтым выделен лучший коэффициент.
            </p>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="card-title flex-wrap">
          <h2>Движение коэффициентов</h2>
          <div className="flex gap-1">
            {sels.map((s) => (
              <button
                key={s}
                onClick={() => setSelection(s)}
                aria-pressed={selActive === s}
                className={`rounded-md px-2 py-0.5 text-xs ${selActive === s ? 'bg-accent text-white' : 'hover:bg-panel2'}`}
              >
                {selLabel(s)}
              </button>
            ))}
          </div>
        </div>
        <OddsChart quotes={group.filter((q) => q.selection === selActive)} />
      </section>

      <section className="card overflow-hidden">
        <div className="card-title flex-wrap">
          <h2>Составы, травмы и дисквалификации</h2>
          <span className="text-xs font-normal text-muted">
            {data.lineups ? `Обновлено ${fmtTimeSec(data.lineups.fetchedAt)}${data.lineups.stale ? ' · данные устарели' : ''}` : ''}
          </span>
        </div>
        <Lineups
          home={{ name: homeName, lineup: data.lineups?.home ?? null, absences: data.absences.home }}
          away={{ name: awayName, lineup: data.lineups?.away ?? null, absences: data.absences.away }}
        />
      </section>
    </div>
  );
}

