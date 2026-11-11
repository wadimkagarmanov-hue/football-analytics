import { NextResponse } from 'next/server';
import { getLeagues, getMatch, getTeamIndex } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Данные для страницы «Избранное»: id из localStorage → краткие карточки.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (k: string) => (url.searchParams.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
  const [teams, leagues] = await Promise.all([getTeamIndex(), getLeagues()]);
  const leagueName = new Map(leagues.data.map((l) => [l.id, l.name]));

  const matches = (
    await Promise.all(
      ids('matches').map(async (id) => {
        try {
          const m = (await getMatch(id)).data;
          if (!m) return null;
          return {
            id: m.id,
            league: leagueName.get(m.leagueId) ?? '',
            home: teams.get(m.homeId)?.name ?? m.homeId,
            away: teams.get(m.awayId)?.name ?? m.awayId,
            kickoff: m.kickoff,
            status: m.status,
            score: m.score ?? null,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const teamList = ids('teams')
    .map((id) => teams.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({ id: t.id, name: t.name, league: leagueName.get(t.leagueId) ?? '', country: t.country }));

  return NextResponse.json({ matches, teams: teamList });
}
