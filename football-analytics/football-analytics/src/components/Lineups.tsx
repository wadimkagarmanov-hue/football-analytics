import Link from 'next/link';
import type { Absence, Lineup, LineupPlayer, Position } from '@/lib/types';

const ORDER: Position[] = ['GK', 'DF', 'MF', 'FW'];
const POS_LABEL: Record<Position, string> = { GK: 'Вратари', DF: 'Защитники', MF: 'Полузащитники', FW: 'Нападающие' };

function PlayerLine({ p }: { p: LineupPlayer }) {
  return (
    <li className="flex gap-2 py-0.5">
      <span className="w-6 text-right tabular-nums text-muted">{p.number ?? ''}</span>
      <Link href={`/player/${p.id}`} className="hover:text-accent hover:underline">
        {p.name}
      </Link>
    </li>
  );
}

function Side({ name, lineup, absences }: { name: string; lineup: Lineup | null; absences: Absence[] }) {
  return (
    <div className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{name}</h3>
        {lineup && (
          <>
            <span className="chip bg-panel2 text-muted">{lineup.formation}</span>
            <span className={`chip ${lineup.confirmed ? 'bg-up/15 text-up' : 'bg-best/20'}`}>
              {lineup.confirmed ? 'Подтверждённый состав' : 'Вероятный состав'}
            </span>
          </>
        )}
      </div>

      {lineup ? (
        <>
          {ORDER.map((pos) => {
            const list = lineup.startXI.filter((p) => (p.pos ?? 'MF') === pos);
            return list.length ? (
              <div key={pos} className="mb-1.5">
                <p className="text-xs uppercase tracking-wide text-muted">{POS_LABEL[pos]}</p>
                <ul>{list.map((p) => <PlayerLine key={p.id} p={p} />)}</ul>
              </div>
            ) : null;
          })}
          {lineup.bench.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-muted">Запас ({lineup.bench.length})</summary>
              <ul className="mt-1">{lineup.bench.map((p) => <PlayerLine key={p.id} p={p} />)}</ul>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Состав пока не опубликован.</p>
      )}

      <div className="mt-3 border-t border-line pt-2">
        <p className="mb-1 text-xs uppercase tracking-wide text-muted">Не сыграют</p>
        {absences.length ? (
          <ul className="space-y-1 text-sm">
            {absences.map((a) => (
              <li key={a.playerId} className="flex flex-wrap items-center gap-2">
                <span className={`chip ${a.reason === 'injury' ? 'bg-down/15 text-down' : 'bg-best/25'}`}>
                  {a.reason === 'injury' ? 'Травма' : 'Дисквалификация'}
                </span>
                <Link href={`/player/${a.playerId}`} className="hover:text-accent hover:underline">
                  {a.playerName}
                </Link>
                <span className="text-xs text-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Нет данных о травмах и дисквалификациях.</p>
        )}
      </div>
    </div>
  );
}

export default function Lineups({
  home,
  away,
}: {
  home: { name: string; lineup: Lineup | null; absences: Absence[] };
  away: { name: string; lineup: Lineup | null; absences: Absence[] };
}) {
  return (
    <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
      <Side {...home} />
      <Side {...away} />
    </div>
  );
}
