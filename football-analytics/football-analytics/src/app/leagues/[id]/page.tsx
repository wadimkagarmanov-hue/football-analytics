import Link from 'next/link';
import { notFound } from 'next/navigation';
import SortableTable from '@/components/SortableTable';
import { CsvButton, Section, UpdatedAt } from '@/components/ui';
import { getLeagues, getMatches, getStandings, getTeamIndex, oldest } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LeaguePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ round?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const leagues = await getLeagues();
  const league = leagues.data.find((l) => l.id === id);
  if (!league) notFound();

  const [standings, matches, teams] = await Promise.all([getStandings(id), getMatches({ leagueId: id }), getTeamIndex()]);
  const rounds = [...new Set(matches.data.map((m) => m.round))].sort((a, b) => a - b);
  // по умолчанию — ближайший тур с несыгранными матчами
  const nextRound = matches.data.find((m) => m.status !== 'finished')?.round ?? rounds[rounds.length - 1];
  const round = rounds.includes(Number(sp.round)) ? Number(sp.round) : nextRound;
  const inRound = matches.data.filter((m) => m.round === round);
  const name = (tid: string) => teams.get(tid)?.name ?? tid;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{league.name}</h1>
          <p className="text-sm text-muted">
            {league.country} · сезон {league.season}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UpdatedAt at={oldest(standings, matches)} source={standings.source} stale={standings.stale || matches.stale} />
          <CsvButton href={`/api/export?kind=standings&league=${id}`} label="Таблица CSV" />
        </div>
      </div>

      <Section title="Турнирная таблица">
        <SortableTable
          initialSort={{ key: 'pos', dir: 'asc' }}
          cols={[
            { key: 'pos', label: '#', align: 'center' },
            { key: 'team', label: 'Команда' },
            { key: 'p', label: 'И', align: 'right' },
            { key: 'w', label: 'В', align: 'right' },
            { key: 'd', label: 'Н', align: 'right' },
            { key: 'l', label: 'П', align: 'right' },
            { key: 'gf', label: 'ЗМ', align: 'right' },
            { key: 'ga', label: 'ПМ', align: 'right' },
            { key: 'gd', label: 'РМ', align: 'right' },
            { key: 'pts', label: 'О', align: 'right' },
          ]}
          rows={standings.data.map((r, i) => ({
            id: r.teamId,
            cells: {
              pos: { text: String(i + 1), sort: i + 1, tone: 'muted' as const },
              team: { text: name(r.teamId), href: `/team/${r.teamId}`, tone: 'strong' as const },
              p: { text: String(r.played), sort: r.played },
              w: { text: String(r.won), sort: r.won },
              d: { text: String(r.drawn), sort: r.drawn },
              l: { text: String(r.lost), sort: r.lost },
              gf: { text: String(r.gf), sort: r.gf },
              ga: { text: String(r.ga), sort: r.ga },
              gd: { text: String(r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga), sort: r.gf - r.ga, tone: r.gf - r.ga > 0 ? ('up' as const) : r.gf - r.ga < 0 ? ('down' as const) : undefined },
              pts: { text: String(r.points), sort: r.points, tone: 'strong' as const },
            },
          }))}
        />
      </Section>

      <Section
        title={`Расписание: ${round} тур`}
        right={
          <span className="flex flex-wrap gap-1 text-xs">
            {rounds.map((r) => (
              <Link key={r} href={`/leagues/${id}?round=${r}`} className={`rounded px-1.5 py-0.5 ${r === round ? 'bg-accent text-white' : 'hover:bg-panel2'}`}>
                {r}
              </Link>
            ))}
          </span>
        }
      >
        <SortableTable
          initialSort={{ key: 'date', dir: 'asc' }}
          cols={[
            { key: 'date', label: 'Дата' },
            { key: 'match', label: 'Матч' },
            { key: 'score', label: 'Счёт', align: 'center' },
          ]}
          rows={inRound.map((m) => ({
            id: m.id,
            cells: {
              date: { text: fmtDateTime(m.kickoff), sort: m.kickoff, tone: 'muted' as const },
              match: { text: `${name(m.homeId)} — ${name(m.awayId)}`, href: `/match/${m.id}` },
              score: { text: m.score ? `${m.score.home}:${m.score.away}` : '—', tone: m.status === 'live' ? ('up' as const) : ('strong' as const) },
            },
          }))}
        />
      </Section>
    </div>
  );
}
