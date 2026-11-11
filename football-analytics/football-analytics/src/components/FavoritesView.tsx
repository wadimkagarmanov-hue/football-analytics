'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fmtDateTime } from '@/lib/format';
import FavoriteButton, { readFavs } from './FavoriteButton';

interface MatchCard {
  id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
  score: { home: number; away: number } | null;
}
interface TeamCard {
  id: string;
  name: string;
  league: string;
  country: string;
}

export default function FavoritesView() {
  const [data, setData] = useState<{ matches: MatchCard[]; teams: TeamCard[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      const m = readFavs('match');
      const t = readFavs('team');
      if (!m.length && !t.length) return setData({ matches: [], teams: [] });
      try {
        const r = await fetch(`/api/lookup?matches=${encodeURIComponent(m.join(','))}&teams=${encodeURIComponent(t.join(','))}`);
        if (!r.ok) throw new Error();
        const j = await r.json();
        // порядок и состав — по актуальному localStorage (убранные не показываем)
        setData({ matches: j.matches.filter((x: MatchCard) => readFavs('match').includes(x.id)), teams: j.teams.filter((x: TeamCard) => readFavs('team').includes(x.id)) });
        setError(false);
      } catch {
        setError(true);
      }
    };
    load();
    window.addEventListener('fav-change', load);
    return () => window.removeEventListener('fav-change', load);
  }, []);

  if (error) return <p className="text-sm text-down">Не удалось загрузить избранное. Попробуйте позже.</p>;
  if (!data) return <p className="text-sm text-muted">Загрузка…</p>;
  if (!data.matches.length && !data.teams.length)
    return (
      <p className="card p-4 text-sm text-muted">
        Здесь пока пусто. Отмечайте матчи и команды звёздочкой ☆ — список хранится в вашем браузере.
      </p>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card overflow-hidden">
        <h2 className="card-title">Матчи</h2>
        {data.matches.length ? (
          <ul className="divide-y divide-line">
            {data.matches
              .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
              .map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                  <FavoriteButton kind="match" id={m.id} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/match/${m.id}`} className="font-medium hover:text-accent hover:underline">
                      {m.home} — {m.away}
                    </Link>
                    <p className="text-xs text-muted">
                      {m.league} · {fmtDateTime(m.kickoff)}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold">{m.score ? `${m.score.home}:${m.score.away}` : ''}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-sm text-muted">Нет сохранённых матчей.</p>
        )}
      </section>
      <section className="card overflow-hidden">
        <h2 className="card-title">Команды</h2>
        {data.teams.length ? (
          <ul className="divide-y divide-line">
            {data.teams.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <FavoriteButton kind="team" id={t.id} />
                <div className="min-w-0 flex-1">
                  <Link href={`/team/${t.id}`} className="font-medium hover:text-accent hover:underline">
                    {t.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {t.league} · {t.country}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-sm text-muted">Нет сохранённых команд.</p>
        )}
      </section>
    </div>
  );
}
