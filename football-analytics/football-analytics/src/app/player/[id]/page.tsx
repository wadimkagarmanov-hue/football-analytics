import { notFound } from 'next/navigation';
import SortableTable from '@/components/SortableTable';
import { Kpi, Section, TeamLink } from '@/components/ui';
import { getAbsences, getPlayer, getPlayerAppearances, getTeamIndex } from '@/lib/data';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const POS = { GK: 'Вратарь', DF: 'Защитник', MF: 'Полузащитник', FW: 'Нападающий' } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = (await getPlayer(id).catch(() => null))?.data;
  return { title: p?.name ?? 'Игрок' };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = (await getPlayer(id).catch(() => null))?.data;
  if (!player) notFound();

  const [teams, apps, absences] = await Promise.all([
    getTeamIndex(),
    getPlayerAppearances(id, 5).catch(() => null),
    getAbsences(player.teamId).catch(() => null),
  ]);
  const team = teams.get(player.teamId);
  const absence = absences?.data.find((a) => a.playerId === id);
  const s = player.stats;
  const per90 = (v: number) => (s.minutes ? ((v / s.minutes) * 90).toFixed(2) : '—');

  return (
    <div className="space-y-4">
      <section className="card p-3 sm:p-4">
        <h1 className="text-xl font-bold sm:text-2xl">{player.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {POS[player.position]} · №{player.number} · {player.age} лет · {player.nationality}
          {team && (
            <>
              {' · '}
              <TeamLink id={team.id} name={team.name} />
            </>
          )}
        </p>
        <p className="mt-3 text-sm">
          Статус:{' '}
          {absence ? (
            <span className="chip bg-down/15 text-down">
              {absence.reason === 'injury' ? 'Травма' : 'Дисквалификация'} · {absence.detail}
            </span>
          ) : (
            <span className="chip bg-up/15 text-up">В строю</span>
          )}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Матчи" value={s.apps} />
        <Kpi label="Минуты" value={s.minutes} />
        <Kpi label="Голы" value={s.goals} sub={`${per90(s.goals)} за 90`} />
        <Kpi label="Передачи" value={s.assists} sub={`${per90(s.assists)} за 90`} />
        <Kpi label="Жёлтые" value={s.yellow} />
        <Kpi label="Красные" value={s.red} />
      </div>

      <Section title="Последние матчи">
        <SortableTable
          initialSort={{ key: 'date', dir: 'desc' }}
          empty="Данных о последних матчах нет."
          cols={[
            { key: 'date', label: 'Дата' },
            { key: 'opp', label: 'Соперник' },
            { key: 'min', label: 'Минуты', align: 'right' },
            { key: 'goals', label: 'Голы', align: 'right' },
            { key: 'assists', label: 'Пасы', align: 'right' },
            { key: 'rating', label: 'Оценка', align: 'right' },
          ]}
          rows={(apps?.data ?? []).map((a) => ({
            id: a.matchId,
            cells: {
              date: { text: fmtDateTime(a.kickoff), sort: a.kickoff, tone: 'muted' as const },
              opp: { text: `${a.isHome ? 'Дома' : 'В гостях'} · ${teams.get(a.opponentId)?.name ?? ''}`, href: `/match/${a.matchId}` },
              min: { text: String(a.minutes), sort: a.minutes },
              goals: { text: String(a.goals), sort: a.goals },
              assists: { text: String(a.assists), sort: a.assists },
              rating: { text: a.rating?.toFixed(1) ?? '—', sort: a.rating ?? 0 },
            },
          }))}
        />
      </Section>
    </div>
  );
}
