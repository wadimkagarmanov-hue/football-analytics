import Link from 'next/link';
import { notFound } from 'next/navigation';
import AffiliateBlock from '@/components/AffiliateBlock';
import Calculator from '@/components/Calculator';
import FavoriteButton from '@/components/FavoriteButton';
import MatchLive from '@/components/MatchLive';
import SortableTable, { type Row } from '@/components/SortableTable';
import { CsvButton, FormStrip, Section, StatBar, TeamLink } from '@/components/ui';
import { h2h, lastN, record, resultFor } from '@/lib/analytics';
import { getLeagues, getMatch, getMatchStats, getStandings, getTeamAverages, getTeamIndex, getTeamMatches } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';
import { buildLive } from '@/lib/live';
import { bestBySelection } from '@/lib/odds';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const m = (await getMatch(id)).data;
    const teams = await getTeamIndex();
    if (m) return { title: `${teams.get(m.homeId)?.name} — ${teams.get(m.awayId)?.name}` };
  } catch {
    /* заголовок по умолчанию */
  }
  return { title: 'Матч' };
}

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const n = sp.n === '10' ? 10 : 5;

  const matchRes = await getMatch(id).catch(() => null);
  const match = matchRes?.data;
  if (!match) notFound();

  const [teams, leagues] = await Promise.all([getTeamIndex(), getLeagues()]);
  const home = teams.get(match.homeId);
  const away = teams.get(match.awayId);
  if (!home || !away) notFound();
  const league = leagues.data.find((l) => l.id === match.leagueId);
  const finished = match.status === 'finished';

  const [live, hm, am, standings, homeHome, awayAway, actual] = await Promise.all([
    buildLive(match),
    getTeamMatches(home.id),
    getTeamMatches(away.id),
    getStandings(match.leagueId).catch(() => null),
    getTeamAverages(home.id, 'home', n),
    getTeamAverages(away.id, 'away', n),
    getMatchStats(match.id, finished).catch(() => null),
  ]);

  const stats = actual?.data ?? null;

  // исключаем сам матч из «формы», чтобы страница завершённого матча не подсматривала в результат
  const before = (ms: typeof hm.data) => ms.filter((m) => m.kickoff < match.kickoff);
  const hAll = before(hm.data);
  const aAll = before(am.data);
  const hLast = lastN(hAll, home.id, n);
  const aLast = lastN(aAll, away.id, n);
  const h2hList = h2h(before([...hm.data, ...am.data].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)), home.id, away.id).slice(0, 10);
  const recH = record(hAll, home.id, 'home');
  const recA = record(aAll, away.id, 'away');
  const pos = (tid: string) => (standings ? standings.data.findIndex((r) => r.teamId === tid) + 1 : 0);

  const best1x2 = live.odds ? bestBySelection(live.odds.quotes.filter((q) => q.market === '1X2')) : null;

  const matchRows = (ms: typeof hLast, tid: string): Row[] =>
    ms.map((m) => {
      const opp = teams.get(m.homeId === tid ? m.awayId : m.homeId);
      const r = resultFor(m, tid);
      return {
        id: m.id,
        cells: {
          date: { text: fmtDateTime(m.kickoff), sort: m.kickoff, tone: 'muted' },
          venue: { text: m.homeId === tid ? 'Д' : 'Г', tone: 'muted' },
          opp: { text: opp?.name ?? '', href: `/match/${m.id}` },
          score: { text: `${m.score!.home}:${m.score!.away}`, tone: r === 'W' ? 'up' : r === 'L' ? 'down' : 'muted' },
        },
      };
    });
  const mCols = [
    { key: 'date', label: 'Дата' },
    { key: 'venue', label: 'Д/Г', align: 'center' as const },
    { key: 'opp', label: 'Соперник' },
    { key: 'score', label: 'Счёт', align: 'center' as const },
  ];

  const recRow = (label: string, r: ReturnType<typeof record>) => ({
    label,
    v: `${r.won}-${r.drawn}-${r.lost}`,
    gd: `${r.gf}:${r.ga}`,
    pts: r.points,
    played: r.played,
  });

  return (
    <div className="space-y-4">
      {/* Шапка матча */}
      <section className="card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {league?.name} · {league?.country} · {match.round} тур · {fmtDateTime(match.kickoff)}
          </span>
          <span className="flex items-center gap-2">
            <span className={`chip ${match.status === 'live' ? 'bg-up/15 text-up' : 'bg-panel2'}`}>
              {match.status === 'live' ? 'Идёт' : finished ? 'Завершён' : 'Не начался'}
            </span>
            <FavoriteButton kind="match" id={match.id} withLabel />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center sm:gap-4">
          <div>
            <TeamLink id={home.id} name={home.name} className="text-lg font-bold sm:text-2xl" />
            <p className="mt-1 text-xs text-muted">{pos(home.id) ? `${pos(home.id)}-е место` : ''}</p>
            <div className="mt-1.5">
              <FormStrip form={hLast.map((m) => resultFor(m, home.id)).reverse()} />
            </div>
          </div>
          <div className="min-w-16">
            {match.score ? <p className="kpi text-3xl sm:text-4xl">{match.score.home}:{match.score.away}</p> : <p className="text-2xl font-bold text-muted">vs</p>}
          </div>
          <div>
            <TeamLink id={away.id} name={away.name} className="text-lg font-bold sm:text-2xl" />
            <p className="mt-1 text-xs text-muted">{pos(away.id) ? `${pos(away.id)}-е место` : ''}</p>
            <div className="mt-1.5">
              <FormStrip form={aLast.map((m) => resultFor(m, away.id)).reverse()} />
            </div>
          </div>
        </div>
        {best1x2 && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {(['1', 'X', '2'] as const).map((s) => (
              <div key={s} className="rounded-md bg-panel2 py-2">
                <p className="text-xs text-muted">Лучший {s === '1' ? 'П1' : s === 'X' ? 'Х' : 'П2'}</p>
                <p className="kpi mt-1">{best1x2[s]?.toFixed(2) ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <CsvButton href={`/api/export?kind=odds&match=${match.id}`} label="Коэффициенты CSV" />
          <CsvButton href={`/api/export?kind=match-stats&match=${match.id}`} label="Статистика CSV" />
          <Link href={`/compare?a=${home.id}&b=${away.id}`} className="btn">
            Сравнить команды
          </Link>
        </div>
      </section>

      {/* Коэффициенты, график, составы (обновляются автоматически) */}
      <MatchLive matchId={match.id} homeName={home.name} awayName={away.name} initial={live} finished={finished} />

      <AffiliateBlock />

      {/* Форма */}
      <Section
        title={`Форма за последние ${n} матчей`}
        right={
          <span className="flex gap-1 text-xs">
            <Link href={`/match/${id}?n=5`} className={`rounded px-2 py-0.5 ${n === 5 ? 'bg-accent text-white' : 'hover:bg-panel2'}`}>5</Link>
            <Link href={`/match/${id}?n=10`} className={`rounded px-2 py-0.5 ${n === 10 ? 'bg-accent text-white' : 'hover:bg-panel2'}`}>10</Link>
          </span>
        }
      >
        <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <div>
            <p className="px-3 pt-2 text-sm font-semibold">{home.name}</p>
            <SortableTable cols={mCols} rows={matchRows(hLast, home.id)} initialSort={{ key: 'date', dir: 'desc' }} empty="Нет сыгранных матчей" />
          </div>
          <div>
            <p className="px-3 pt-2 text-sm font-semibold">{away.name}</p>
            <SortableTable cols={mCols} rows={matchRows(aLast, away.id)} initialSort={{ key: 'date', dir: 'desc' }} empty="Нет сыгранных матчей" />
          </div>
        </div>
      </Section>

      {/* Личные встречи */}
      <Section title="Личные встречи">
        <SortableTable
          initialSort={{ key: 'date', dir: 'desc' }}
          empty="Личных встреч в этом сезоне не было."
          cols={[
            { key: 'date', label: 'Дата' },
            { key: 'match', label: 'Матч' },
            { key: 'score', label: 'Счёт', align: 'center' },
          ]}
          rows={h2hList.map((m) => ({
            id: m.id,
            cells: {
              date: { text: fmtDateTime(m.kickoff), sort: m.kickoff, tone: 'muted' as const },
              match: { text: `${teams.get(m.homeId)?.name} — ${teams.get(m.awayId)?.name}`, href: `/match/${m.id}` },
              score: { text: `${m.score!.home}:${m.score!.away}`, tone: 'strong' as const },
            },
          }))}
        />
      </Section>

      {/* Дома / в гостях */}
      <Section title="Домашняя и выездная статистика сезона">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Команда</th>
                <th>Условие</th>
                <th className="text-right">И</th>
                <th className="text-right">В-Н-П</th>
                <th className="text-right">Голы</th>
                <th className="text-right">Очки</th>
                <th className="text-right">Очки/матч</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: home.name, ...recRow('Дома', recH) },
                { t: away.name, ...recRow('В гостях', recA) },
                { t: home.name, ...recRow('В гостях', record(hAll, home.id, 'away')) },
                { t: away.name, ...recRow('Дома', record(aAll, away.id, 'home')) },
              ].map((r, i) => (
                <tr key={i} className={i < 2 ? 'font-semibold' : 'text-muted'}>
                  <td>{r.t}</td>
                  <td>{r.label}</td>
                  <td className="text-right">{r.played}</td>
                  <td className="text-right">{r.v}</td>
                  <td className="text-right">{r.gd}</td>
                  <td className="text-right">{r.pts}</td>
                  <td className="text-right">{r.played ? (r.pts / r.played).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Статистика: xG, владение, удары, угловые, карточки */}
      <Section title={`Средние показатели: ${home.name} дома и ${away.name} в гостях (последние ${n})`}>
        <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <div>
            <StatBar label="Голы за матч" home={homeHome.gf} away={awayAway.gf} digits={2} />
            <StatBar label="Пропущено за матч" home={homeHome.ga} away={awayAway.ga} digits={2} lowerIsBetter />
            <StatBar label="xG" home={homeHome.xg} away={awayAway.xg} digits={2} />
            <StatBar label="xG соперников" home={homeHome.xga} away={awayAway.xga} digits={2} lowerIsBetter />
          </div>
          <div>
            <StatBar label="Владение" home={homeHome.possession} away={awayAway.possession} suffix="%" />
            <StatBar label="Удары" home={homeHome.shots} away={awayAway.shots} />
            <StatBar label="В створ" home={homeHome.shotsOnTarget} away={awayAway.shotsOnTarget} />
            <StatBar label="Угловые" home={homeHome.corners} away={awayAway.corners} />
            <StatBar label="Жёлтые карточки" home={homeHome.yellow} away={awayAway.yellow} digits={2} lowerIsBetter />
            <StatBar label="Красные карточки" home={homeHome.red} away={awayAway.red} digits={2} lowerIsBetter />
          </div>
        </div>
      </Section>

      {stats && (
        <Section title="Статистика матча">
          <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
            <div>
              <StatBar label="xG" home={stats.home.xg} away={stats.away.xg} digits={2} />
              <StatBar label="Владение" home={stats.home.possession} away={stats.away.possession} digits={0} suffix="%" />
              <StatBar label="Удары" home={stats.home.shots} away={stats.away.shots} digits={0} />
            </div>
            <div>
              <StatBar label="В створ" home={stats.home.shotsOnTarget} away={stats.away.shotsOnTarget} digits={0} />
              <StatBar label="Угловые" home={stats.home.corners} away={stats.away.corners} digits={0} />
              <StatBar label="Карточки (жёлтые / красные)" home={(stats.home.yellow ?? 0) + (stats.home.red ?? 0)} away={(stats.away.yellow ?? 0) + (stats.away.red ?? 0)} digits={0} lowerIsBetter />
            </div>
          </div>
        </Section>
      )}

      <Section title="Калькулятор: коэффициент → вероятность и маржа">
        <Calculator initial={best1x2 && best1x2['1'] && best1x2.X && best1x2['2'] ? { '1': best1x2['1'], X: best1x2.X, '2': best1x2['2'] } : undefined} />
      </Section>

      <p className="text-xs text-muted">
        Источник данных: {matchRes?.source}. Форма и личные встречи считаются по матчам до начала этой игры; средние показатели — по последним сыгранным матчам команд. Сайт не гарантирует результат.
      </p>
    </div>
  );
}

  

  
