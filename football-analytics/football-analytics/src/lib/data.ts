// Сервисный слой: единственная точка доступа страниц к данным.
// Оборачивает провайдеров в кэш + лимитер и добавляет вычисления. Не зависит от Next.js.

import { averages, checkCondition, type Averages, type Condition, type Venue, isDone, lastN } from './analytics';
import { cached, type Provenance } from './cache';
import { TTL } from './config';
import { db } from './db';
import { footballProvider, oddsProvider } from './providers';
import type { Match, MatchStats, OddsQuote, Team } from './types';

type Opt = { force?: boolean };
const F = () => footballProvider();
const O = () => oddsProvider();

export const getLeagues = (o?: Opt) => cached('f:leagues', TTL.static, F().name, () => F().listLeagues(), o);
export const getTeams = (leagueId: string, o?: Opt) =>
  cached(`f:teams:${leagueId}`, TTL.static, F().name, async () => {
    const teams = await F().listTeams(leagueId);
    return teams;
  }, o);

export async function getTeamIndex(): Promise<Map<string, Team>> {
  const leagues = (await getLeagues()).data;
  const lists = await Promise.all(leagues.map((l) => getTeams(l.id)));
  const map = new Map<string, Team>();
  for (const l of lists) for (const t of l.data) map.set(t.id, t);
  return map;
}

export const getMatches = (q: { from?: string; to?: string; leagueId?: string }, o?: Opt) =>
  cached(`f:matches:${q.leagueId ?? '*'}:${q.from ?? ''}:${q.to ?? ''}`, TTL.matches, F().name, () => F().listMatches(q), o);

export const getMatch = (id: string, o?: Opt) => cached(`f:match:${id}`, TTL.matchLive, F().name, () => F().getMatch(id), o);

export const getTeamMatches = (teamId: string, o?: Opt) =>
  cached(`f:teammatches:${teamId}`, TTL.matches, F().name, () => F().listMatches({ teamId }), o);

export const getSquad = (teamId: string, o?: Opt) => cached(`f:squad:${teamId}`, TTL.squad, F().name, () => F().getSquad(teamId), o);

export const getPlayer = (id: string, o?: Opt) => cached(`f:player:${id}`, TTL.squad, F().name, () => F().getPlayer(id), o);

export const getPlayerAppearances = (id: string, limit = 5, o?: Opt) =>
  cached(`f:appearances:${id}:${limit}`, TTL.squad, F().name, () => F().getPlayerAppearances(id, limit), o);

export const getStandings = (leagueId: string, o?: Opt) =>
  cached(`f:standings:${leagueId}`, TTL.standings, F().name, () => F().getStandings(leagueId), o);

export const getLineups = (matchId: string, o?: Opt) =>
  cached(`f:lineups:${matchId}`, TTL.lineups, F().name, () => F().getLineups(matchId), o);

export const getAbsences = (teamId: string, o?: Opt) =>
  cached(`f:absences:${teamId}`, TTL.absences, F().name, () => F().getAbsences(teamId), o);

export const getCoach = async (team: Team): Promise<string> => {
  if (team.coach && team.coach !== '—') return team.coach;
  const fp = F();
  if (!fp.getCoach) return '—';
  try {
    const c = await cached(`f:coach:${team.id}`, TTL.static, fp.name, () => fp.getCoach!(team.id));
    return c.data ?? '—';
  } catch {
    return '—';
  }
};

export const getMatchStats = (matchId: string, finished: boolean, o?: Opt) =>
  cached<MatchStats | null>(`f:stats:${matchId}`, finished ? TTL.finishedStats : TTL.matches, F().name, () => F().getMatchStats(matchId), o);

// ── Коэффициенты ─────────────────────────────────────────────────────────

const quoteKey = (q: Pick<OddsQuote, 'bookmaker' | 'market' | 'line' | 'selection'>) =>
  `${q.bookmaker}|${q.market}|${q.line ?? ''}|${q.selection}`;

/** Дополняет котировки историей из БД (если у провайдера её нет). */
async function attachHistory(matchId: string, quotes: OddsQuote[]): Promise<OddsQuote[]> {
  const needs = quotes.some((q) => q.history.length < 2);
  const pool = db();
  let byKey = new Map<string, { t: string; p: number }[]>();
  if (needs && pool) {
    try {
      const r = await pool.query(
        `select bookmaker, market, line, selection, price, captured_at
           from odds_snapshots where match_id = $1 order by captured_at`,
        [matchId],
      );
      for (const row of r.rows) {
        const k = quoteKey({ bookmaker: row.bookmaker, market: row.market, line: row.line == null ? undefined : Number(row.line), selection: row.selection });
        const arr = byKey.get(k) ?? [];
        arr.push({ t: new Date(row.captured_at).toISOString(), p: Number(row.price) });
        byKey.set(k, arr);
      }
    } catch {
      byKey = new Map();
    }
  }
  return quotes.map((q) => {
    if (q.history.length >= 2) return q;
    const h = byKey.get(quoteKey(q));
    return { ...q, history: h && h.length ? h : [{ t: q.updatedAt, p: q.price }] };
  });
}

export async function getOdds(match: Match, teams?: Map<string, Team>, o?: Opt): Promise<Provenance<OddsQuote[]>> {
  const idx = teams ?? (await getTeamIndex());
  const home = idx.get(match.homeId);
  const away = idx.get(match.awayId);
  if (!home || !away) throw new Error(`Unknown teams for match ${match.id}`);
  const res = await cached(`o:${match.id}`, TTL.odds, O().name, () => O().getOdds(match, home, away), o);
  return { ...res, data: await attachHistory(match.id, res.data) };
}

// ── Составные запросы ────────────────────────────────────────────────────

export async function getTeamAverages(teamId: string, venue?: Venue, n = 10): Promise<Averages> {
  const matches = (await getTeamMatches(teamId)).data;
  const last = lastN(matches, teamId, n, venue);
  const items = await Promise.all(
    last.map(async (match) => {
      try {
        return { match, stats: (await getMatchStats(match.id, true)).data };
      } catch {
        return { match, stats: null };
      }
    }),
  );
  return averages(items, teamId);
}

export async function matchPassesCondition(m: Match, cond: Condition, n: number): Promise<boolean> {
  const [h, a] = await Promise.all([getTeamMatches(m.homeId), getTeamMatches(m.awayId)]);
  return checkCondition(cond, n, { id: m.homeId, matches: h.data }, { id: m.awayId, matches: a.data });
}

/** Самое старое время обновления из набора ответов — «данные не старше». */
export const oldest = (...ps: Provenance<unknown>[]): string =>
  ps.reduce((min, p) => (p.fetchedAt < min ? p.fetchedAt : min), ps[0].fetchedAt);
export const anyStale = (...ps: Provenance<unknown>[]) => ps.some((p) => p.stale);
export { isDone };
