import { notFound } from 'next/navigation';
import FavoriteButton from '@/components/FavoriteButton';
import SortableTable, { type Row } from '@/components/SortableTable';
import { CsvButton, FormStrip, Kpi, Section } from '@/components/ui';
import { lastN, record, resultFor } from '@/lib/analytics';
import { getAbsences, getCoach, getLeagues, getSquad, getStandings, getTeamAverages, getTeamIndex, getTeamMatches } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = (await getTeamIndex().catch(() => null))?.get(id);
  return { title: t?.name ?? 'Команда' };
}

const POS = { GK: 'Вратарь', DF: 'Защитник', MF: 'Полузащитник', FW: 'Нападающий' } as const;

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teams = await getTeamIndex();
  const team = teams.get(id);
  if (!team) notFound();

  const [leagues, matches, squad, absences, standings, avg] = await Promise.all([
    getLeagues(),
    getTeamMatches(id),
    getSquad(id),
    getAbsences(id).catch(() => null),
    getStandings(team.leagueId).catch(() => null),
    getTeamAverages(id, undefined, 10),
  ]);
  const coach = await getCoach(team);
  const league = leagues.data.find((l) => l.id === team.leagueId);
  const all = matches.data;
  const rec = record(all, id);
  const recH = record(all, id, 'home');
  const recA = record(all, id, 'away');
  const pos = standings ? standings.data.findIndex((r) => r.teamId === id) + 1 : 0;
  const form = lastN(all, id, 5).map((m) => resultFor(m, id)).reverse();
  const absent = new Map((absences?.data ?? []).map((a) => [a.playerId, a]));

  const mRow = (m: (typeof all)[number]): Row => {
    const isHome = m.homeId === id;
    const opp = teams.get(isHome ? m.awayId : m.homeId);
    const r = m.score ? resultFor(m, id) : null;
    return {
      id: m.id,
      cells: {
        date: { text: fmtDateTime(m.kickoff), sort: m.kickoff, tone: 'muted' },
        round: { text: String(m.round), sort: m.round, tone: 'muted' },
        venue: { text: isHome ? 'Дома' : 'В гостях', tone: 'muted' },
        opp: { text: opp?.name ?? '', href: `/match/${m.id}` },
        score: {
          text: m.score ? `${m.score.home}:${m.score.away}` : '—',
          tone: r === 'W' ? 'up' : r === 'L' ? 'down' : 'muted',
        },
      },
    };
  };
  const mCols = [
    { key: 'date', label: 'Дата' },
    { key: 'round', label: 'Тур', align: 'center' as const },
    { key: 'venue', label: 'Где' },
    { key: 'opp', label: 'Соперник' },
    { key: 'score', label: 'Счёт', align: 'center' as const },
  ];
  const results = all.filter((m) => m.status === 'finished').map(mRow);
  const fixtures = all.filter((m) => m.status !== 'finished').map(mRow);

  const squadRows: Row[] = squad.data.map((p) => {
    const a = absent.get(p.id);
    return {
      id: p.id,
      cells: {
        num: { text: String(p.number), sort: p.number, tone: 'muted' },
        name: { text: p.name, href: `/player/${p.id}`, tone: 'strong' },
        pos: { text: POS[p.position], sort: ['GK', 'DF', 'MF', 'FW'].indexOf(p.position) },
        age: { text: String(p.age), sort: p.age },
        apps: { text: String(p.stats.apps), sort: p.stats.apps },
        min: { text: String(p.stats.minutes), sort: p.stats.minutes },
        goals: { text: String(p.stats.goals), sort: p.stats.goals },
        assists: { text: String(p.stats.assists), sort: p.stats.assists },
        yc: { text: String(p.stats.yellow), sort: p.stats.yellow },
        rc: { text: String(p.stats.red), sort: p.stats.red },
        status: { text: a ? (a.reason === 'injury' ? 'Травма' : 'Дисквалификация') : 'В строю', tone: a ? 'down' : 'muted' },
      },
    };
  });

  return (
    <div className="space-y-4">
      <section className="card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{team.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {league?.name} · {team.country} · {team.stadium}
            </p>
            <p className="mt-1 text-sm">
              Тренер: <b>{coach}</b>
            </p>
          </div>
          <FavoriteButton kind="team" id={team.id} withLabel />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">Форма (последние 5):</span>
          <FormStrip form={form} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CsvButton href={`/api/export?kind=team-matches&team=${id}`} label="Матчи CSV" />
          <CsvButton href={`/api/export?kind=squad&team=${id}`} label="Состав CSV" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Место в лиге" value={pos || '—'} sub={`${rec.points} очк. в ${rec.played} матчах`} />
        <Kpi label="Голы за матч" value={rec.played ? (rec.gf / rec.played).toFixed(2) : '—'} sub={`забито ${rec.gf}`} tone="up" />
        <Kpi label="Пропущено за матч" value={rec.played ? (rec.ga / rec.played).toFixed(2) : '—'} sub={`пропущено ${rec.ga}`} tone="down" />
        <Kpi label="xG за матч (посл. 10)" value={avg.xg != null ? avg.xg.toFixed(2) : '—'} sub={avg.possession != null ? `владение ${avg.possession.toFixed(0)}%` : undefined} />
      </div>

      <Section title="Статистика сезона">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th />
                <th className="text-right">И</th>
                <th className="text-right">В</th>
                <th className="text-right">Н</th>
                <th className="text-right">П</th>
                <th className="text-right">Голы</th>
                <th className="text-right">Очки</th>
                <th className="text-right">Очки/матч</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Всего', rec],
                  ['Дома', recH],
                  ['В гостях', recA],
                ] as const
              ).map(([label, r]) => (
                <tr key={label}>
                  <td className="font-semibold">{label}</td>
                  <td className="text-right">{r.played}</td>
                  <td className="text-right">{r.won}</td>
                  <td className="text-right">{r.drawn}</td>
                  <td className="text-right">{r.lost}</td>
                  <td className="text-right">
                    {r.gf}:{r.ga}
                  </td>
                  <td className="text-right">{r.points}</td>
                  <td className="text-right">{r.played ? (r.points / r.played).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Календарь">
          <SortableTable cols={mCols} rows={fixtures} initialSort={{ key: 'date', dir: 'asc' }} empty="Предстоящих матчей нет" />
        </Section>
        <Section title="Результаты">
          <SortableTable cols={mCols} rows={results} initialSort={{ key: 'date', dir: 'desc' }} empty="Сыгранных матчей нет" />
        </Section>
      </div>

      <Section title="Текущий состав">
        <SortableTable
          initialSort={{ key: 'pos', dir: 'asc' }}
          cols={[
            { key: 'num', label: '№', align: 'center' },
            { key: 'name', label: 'Игрок' },
            { key: 'pos', label: 'Позиция' },
            { key: 'age', label: 'Возраст', align: 'right' },
            { key: 'apps', label: 'Матчи', align: 'right' },
            { key: 'min', label: 'Минуты', align: 'right' },
            { key: 'goals', label: 'Голы', align: 'right' },
            { key: 'assists', label: 'Пасы', align: 'right' },
            { key: 'yc', label: 'ЖК', align: 'right' },
            { key: 'rc', label: 'КК', align: 'right' },
            { key: 'status', label: 'Статус' },
          ]}
          rows={squadRows}
        />
      </Section>
    </div>
  );
}
