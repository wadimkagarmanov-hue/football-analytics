import type { Match, MatchStats, StandingRow } from './types';

export type Res = 'W' | 'D' | 'L';
export type Venue = 'home' | 'away';

export const isDone = (m: Match) => m.status === 'finished' && !!m.score;

export function resultFor(m: Match, teamId: string): Res {
  const s = m.score!;
  const own = m.homeId === teamId ? s.home : s.away;
  const opp = m.homeId === teamId ? s.away : s.home;
  return own > opp ? 'W' : own < opp ? 'L' : 'D';
}

/** Последние n сыгранных матчей команды (новые первыми), опционально только дома/в гостях. */
export function lastN(ms: Match[], teamId: string, n: number, venue?: Venue): Match[] {
  return ms
    .filter((m) => {
      if (!isDone(m)) return false;
      if (venue === 'home') return m.homeId === teamId;
      if (venue === 'away') return m.awayId === teamId;
      return m.homeId === teamId || m.awayId === teamId;
    })
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, n);
}

export interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export function record(ms: Match[], teamId: string, venue?: Venue): TeamRecord {
  const r: TeamRecord = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
  for (const m of ms) {
    if (!isDone(m)) continue;
    const isHome = m.homeId === teamId;
    if (!isHome && m.awayId !== teamId) continue;
    if (venue === 'home' && !isHome) continue;
    if (venue === 'away' && isHome) continue;
    r.played++;
    r.gf += isHome ? m.score!.home : m.score!.away;
    r.ga += isHome ? m.score!.away : m.score!.home;
    const res = resultFor(m, teamId);
    if (res === 'W') (r.won++, (r.points += 3));
    else if (res === 'D') (r.drawn++, (r.points += 1));
    else r.lost++;
  }
  return r;
}

/** Личные встречи двух команд, новые первыми. */
export function h2h(ms: Match[], a: string, b: string): Match[] {
  return ms
    .filter((m) => isDone(m) && ((m.homeId === a && m.awayId === b) || (m.homeId === b && m.awayId === a)))
    .sort((x, y) => y.kickoff.localeCompare(x.kickoff));
}

export function computeStandings(teamIds: string[], ms: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]),
  );
  for (const m of ms) {
    if (!isDone(m)) continue;
    const h = rows.get(m.homeId);
    const a = rows.get(m.awayId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += m.score!.home;
    h.ga += m.score!.away;
    a.gf += m.score!.away;
    a.ga += m.score!.home;
    if (m.score!.home > m.score!.away) (h.won++, a.lost++, (h.points += 3));
    else if (m.score!.home < m.score!.away) (a.won++, h.lost++, (a.points += 3));
    else (h.drawn++, a.drawn++, (h.points += 1), (a.points += 1));
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

// ── Условия фильтра матчей ────────────────────────────────────────────────

export type Condition = 'home_unbeaten_home' | 'away_winless_away' | 'both_over25';

export const CONDITION_LABEL: Record<Condition, string> = {
  home_unbeaten_home: 'Хозяева не проигрывали дома N матчей подряд',
  away_winless_away: 'Гости не выигрывали в гостях N матчей подряд',
  both_over25: 'У обеих команд тотал больше 2.5 в каждом из последних N матчей',
};

export function checkCondition(
  cond: Condition,
  n: number,
  home: { id: string; matches: Match[] },
  away: { id: string; matches: Match[] },
): boolean {
  switch (cond) {
    case 'home_unbeaten_home': {
      const l = lastN(home.matches, home.id, n, 'home');
      return l.length >= n && l.every((m) => resultFor(m, home.id) !== 'L');
    }
    case 'away_winless_away': {
      const l = lastN(away.matches, away.id, n, 'away');
      return l.length >= n && l.every((m) => resultFor(m, away.id) !== 'W');
    }
    case 'both_over25': {
      const ok = (t: { id: string; matches: Match[] }) => {
        const l = lastN(t.matches, t.id, n);
        return l.length >= n && l.every((m) => m.score!.home + m.score!.away > 2.5);
      };
      return ok(home) && ok(away);
    }
  }
}

// ── Средние показатели по статистике матчей ───────────────────────────────

export interface Averages {
  n: number;
  gf: number;
  ga: number;
  xg: number | null;
  xga: number | null;
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  yellow: number | null;
  red: number | null;
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

export function averages(items: { match: Match; stats: MatchStats | null }[], teamId: string): Averages {
  const own = (i: { match: Match; stats: MatchStats | null }) => (i.match.homeId === teamId ? i.stats?.home : i.stats?.away);
  const opp = (i: { match: Match; stats: MatchStats | null }) => (i.match.homeId === teamId ? i.stats?.away : i.stats?.home);
  const goals = items.map((i) => ({
    gf: i.match.homeId === teamId ? i.match.score!.home : i.match.score!.away,
    ga: i.match.homeId === teamId ? i.match.score!.away : i.match.score!.home,
  }));
  return {
    n: items.length,
    gf: mean(goals.map((g) => g.gf)) ?? 0,
    ga: mean(goals.map((g) => g.ga)) ?? 0,
    xg: mean(items.map((i) => own(i)?.xg ?? null)),
    xga: mean(items.map((i) => opp(i)?.xg ?? null)),
    possession: mean(items.map((i) => own(i)?.possession ?? null)),
    shots: mean(items.map((i) => own(i)?.shots ?? null)),
    shotsOnTarget: mean(items.map((i) => own(i)?.shotsOnTarget ?? null)),
    corners: mean(items.map((i) => own(i)?.corners ?? null)),
    yellow: mean(items.map((i) => own(i)?.yellow ?? null)),
    red: mean(items.map((i) => own(i)?.red ?? null)),
  };
}
