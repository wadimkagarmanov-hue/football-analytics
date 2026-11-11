import Link from 'next/link';
import SortableTable, { type Row } from '@/components/SortableTable';
import { UpdatedAt } from '@/components/ui';
import { CONDITION_LABEL, type Condition } from '@/lib/analytics';
import { getLeagues, getMatches, getOdds, getTeamIndex, matchPassesCondition, oldest } from '@/lib/data';
import { fmtDateTime, fmtOdd, isDateStr, startOfDayMs, todayStr } from '@/lib/format';
import { bestBySelection } from '@/lib/odds';
import type { Match } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | undefined>;
const DAY = 864e5;
const MAX_ODDS_ROWS = 40; // лимит запросов коэффициентов на одну загрузку главной

export default async function HomePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const date = isDateStr(sp.date) ? sp.date : todayStr();
  const days = [1, 3, 7].includes(Number(sp.days)) ? Number(sp.days) : 3;
  const from = startOfDayMs(date);
  const to = from + days * DAY - 1;
  const cond = (['home_unbeaten_home', 'away_winless_away', 'both_over25'] as const).includes(sp.cond as Condition) ? (sp.cond as Condition) : '';
  const n = Math.min(10, Math.max(1, Number(sp.n) || 5));
  const q = (sp.q ?? '').trim().toLowerCase();

  const [leaguesRes, teams, matchesRes] = await Promise.all([
    getLeagues(),
    getTeamIndex(),
    getMatches({ from: new Date(from).toISOString(), to: new Date(to).toISOString() }),
  ]);
  const leagues = leaguesRes.data;
  const leagueById = new Map(leagues.map((l) => [l.id, l]));
  const countries = [...new Set(leagues.map((l) => l.country))].sort();

  let list: Match[] = matchesRes.data.filter((m) => {
    const lg = leagueById.get(m.leagueId);
    if (sp.league && m.leagueId !== sp.league) return false;
    if (sp.country && lg?.country !== sp.country) return false;
    if (q) {
      const h = teams.get(m.homeId)?.name.toLowerCase() ?? '';
      const a = teams.get(m.awayId)?.name.toLowerCase() ?? '';
      if (!h.includes(q) && !a.includes(q)) return false;
    }
    return true;
  });

  let condNote = '';
  if (cond) {
    const checks = await Promise.allSettled(list.map((m) => matchPassesCondition(m, cond, n)));
    list = list.filter((_, i) => checks[i].status === 'fulfilled' && (checks[i] as PromiseFulfilledResult<boolean>).value);
    condNote = `${CONDITION_LABEL[cond].replace('N', String(n))}`;
  }

  // лучшие коэффициенты для первых матчей списка (остальные — по ссылке на страницу матча)
  const shown = list.slice(0, 200);
  const oddsFor = await Promise.allSettled(shown.slice(0, MAX_ODDS_ROWS).map((m) => getOdds(m, teams)));

  const rows: Row[] = shown.map((m, i) => {
    const home = teams.get(m.homeId);
    const away = teams.get(m.awayId);
    const o = i < MAX_ODDS_ROWS && oddsFor[i].status === 'fulfilled' ? (oddsFor[i] as PromiseFulfilledResult<Awaited<ReturnType<typeof getOdds>>>).value.data : null;
    const x12 = o ? bestBySelection(o.filter((x) => x.market === '1X2')) : null;
    const tot = o ? bestBySelection(o.filter((x) => x.market === 'TOTAL' && x.line === 2.5)) : null;
    const btts = o ? bestBySelection(o.filter((x) => x.market === 'BTTS')) : null;
    const price = (v?: number) => ({ text: fmtOdd(v), sort: v ?? 0 });
    return {
      id: m.id,
      cells: {
        fav: { text: '', fav: { kind: 'match' as const, id: m.id } },
        time: { text: fmtDateTime(m.kickoff), sort: m.kickoff },
        league: { text: leagueById.get(m.leagueId)?.name ?? '', tone: 'muted' as const },
        match: { text: `${home?.name ?? m.homeId} — ${away?.name ?? m.awayId}`, href: `/match/${m.id}`, tone: 'strong' as const },
        score: { text: m.score ? `${m.score.home}:${m.score.away}${m.status === 'live' ? ' •' : ''}` : '', sort: m.score ? m.score.home + m.score.away : -1, tone: m.status === 'live' ? ('up' as const) : undefined },
        h: price(x12?.['1']),
        d: price(x12?.X),
        a: price(x12?.['2']),
        over: price(tot?.Over),
        btts: price(btts?.Yes),
      },
    };
  });

  const updated = oldest(matchesRes, leaguesRes);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Матчи</h1>
          <p className="text-sm text-muted">Лучшие коэффициенты среди букмекеров. Нажмите на матч, чтобы увидеть полный разбор.</p>
        </div>
        <UpdatedAt at={updated} source={matchesRes.source} stale={matchesRes.stale} />
      </div>

      <form method="get" className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6" aria-label="Фильтры матчей">
        <label className="text-xs text-muted lg:col-span-2">
          Поиск по командам
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Например, Мирамар" className="input mt-1 w-full text-fg" />
        </label>
        <label className="text-xs text-muted">
          Лига
          <select name="league" defaultValue={sp.league ?? ''} className="input mt-1 w-full text-fg">
            <option value="">Все</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Страна
          <select name="country" defaultValue={sp.country ?? ''} className="input mt-1 w-full text-fg">
            <option value="">Все</option>
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          С даты
          <input type="date" name="date" defaultValue={date} className="input mt-1 w-full text-fg" />
        </label>
        <label className="text-xs text-muted">
          Период
          <select name="days" defaultValue={String(days)} className="input mt-1 w-full text-fg">
            <option value="1">1 день</option>
            <option value="3">3 дня</option>
            <option value="7">7 дней</option>
          </select>
        </label>
        <label className="text-xs text-muted sm:col-span-2 lg:col-span-4">
          Условие по форме команд
          <select name="cond" defaultValue={cond} className="input mt-1 w-full text-fg">
            <option value="">Без условия</option>
            {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          N матчей
          <input type="number" min={1} max={10} name="n" defaultValue={n} className="input mt-1 w-full text-fg" />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit">
            Применить
          </button>
          <Link href="/" className="btn">
            Сбросить
          </Link>
        </div>
      </form>

      {condNote && <p className="text-sm text-muted">Фильтр: {condNote}. Найдено матчей: {list.length}.</p>}

      <section className="card overflow-hidden">
        <SortableTable
          initialSort={{ key: 'time', dir: 'asc' }}
          empty="Матчей по выбранным условиям нет."
          cols={[
            { key: 'fav', label: '★', sortable: false },
            { key: 'time', label: 'Время' },
            { key: 'league', label: 'Лига' },
            { key: 'match', label: 'Матч' },
            { key: 'score', label: 'Счёт', align: 'center' },
            { key: 'h', label: 'П1', align: 'right' },
            { key: 'd', label: 'Х', align: 'right' },
            { key: 'a', label: 'П2', align: 'right' },
            { key: 'over', label: 'ТБ 2.5', align: 'right' },
            { key: 'btts', label: 'ОЗ да', align: 'right' },
          ]}
          rows={rows}
        />
        <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
          В таблице — лучшие из доступных коэффициентов по {Math.min(MAX_ODDS_ROWS, rows.length)} первым матчам списка (чтобы беречь лимиты провайдера);
          полное сравнение — на странице матча. «—» — коэффициенты недоступны.
        </p>
      </section>
    </div>
  );
}
