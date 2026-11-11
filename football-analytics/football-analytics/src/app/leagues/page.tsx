import Link from 'next/link';
import { UpdatedAt } from '@/components/ui';
import { getLeagues } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Лиги' };

export default async function LeaguesPage() {
  const res = await getLeagues();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-bold">Лиги</h1>
        <UpdatedAt at={res.fetchedAt} source={res.source} stale={res.stale} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {res.data.map((l) => (
          <Link key={l.id} href={`/leagues/${l.id}`} className="card block p-4 hover:bg-panel2">
            <p className="text-base font-semibold">{l.name}</p>
            <p className="mt-1 text-sm text-muted">
              {l.country} · сезон {l.season}
            </p>
            <p className="mt-3 text-xs text-accent">Таблица и расписание →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
