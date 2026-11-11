import { getAbsences, getLineups, getOdds, getTeamIndex } from './data';
import type { LiveData } from '@/components/MatchLive';
import type { Match } from './types';

/** Собирает «живые» данные матча (коэффициенты, составы, отсутствующие). Ошибки частей не роняют остальное. */
export async function buildLive(match: Match): Promise<LiveData> {
  const teams = await getTeamIndex();
  const [odds, lineups, absH, absA] = await Promise.allSettled([
    getOdds(match, teams),
    getLineups(match.id),
    getAbsences(match.homeId),
    getAbsences(match.awayId),
  ]);
  return {
    odds:
      odds.status === 'fulfilled'
        ? { quotes: odds.value.data, fetchedAt: odds.value.fetchedAt, stale: odds.value.stale, source: odds.value.source }
        : null,
    oddsError: odds.status === 'rejected' ? String((odds.reason as Error)?.message ?? odds.reason) : undefined,
    lineups:
      lineups.status === 'fulfilled'
        ? { ...lineups.value.data, fetchedAt: lineups.value.fetchedAt, stale: lineups.value.stale }
        : null,
    absences: {
      home: absH.status === 'fulfilled' ? absH.value.data : [],
      away: absA.status === 'fulfilled' ? absA.value.data : [],
    },
  };
}
