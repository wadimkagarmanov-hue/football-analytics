// Адаптер API-Football (api-sports.io, v3). Преобразует ответы в доменные типы.
// ВАЖНО: написан по документации и НЕ проверялся на живом ключе — перед запуском в прод
// прогоните страницы на вашем тарифе и сверьте поля (см. README, раздел «Подключение провайдеров»).

import type {
  Absence,
  League,
  Lineup,
  LineupPlayer,
  Match,
  MatchStats,
  MatchStatus,
  Player,
  PlayerAppearance,
  Position,
  StandingRow,
  Team,
  TeamMatchStats,
} from '../types';
import type { FootballProvider, MatchQuery } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = () => process.env.APIFOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const leagueIds = () => (process.env.FOOTBALL_LEAGUE_IDS || '39,140,78').split(',').map((s) => s.trim()).filter(Boolean);
const season = () => {
  if (process.env.FOOTBALL_SEASON) return Number(process.env.FOOTBALL_SEASON);
  const d = new Date();
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
};

async function call(path: string, params: Record<string, string | number | undefined>): Promise<any[]> {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) throw new Error('APIFOOTBALL_KEY is not set');
  const url = new URL(BASE() + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'x-apisports-key': key }, cache: 'no-store' });
  if (!res.ok) throw new Error(`API-Football ${path}: HTTP ${res.status}`);
  const json = await res.json();
  const errs = json.errors;
  if (errs && (Array.isArray(errs) ? errs.length : Object.keys(errs).length)) {
    throw new Error(`API-Football ${path}: ${JSON.stringify(errs)}`);
  }
  return json.response ?? [];
}

const ymd = (iso: string) => iso.slice(0, 10);

const STATUS: Record<string, MatchStatus> = {
  TBD: 'scheduled', NS: 'scheduled', PST: 'scheduled',
  '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', BT: 'live', P: 'live', LIVE: 'live', INT: 'live',
  FT: 'finished', AET: 'finished', PEN: 'finished',
};

function mapPos(p?: string): Position {
  switch ((p || '').toLowerCase()) {
    case 'goalkeeper': case 'g': return 'GK';
    case 'defender': case 'd': return 'DF';
    case 'midfielder': case 'm': return 'MF';
    default: return 'FW';
  }
}

function mapFixture(x: any): Match {
  const status = STATUS[x.fixture?.status?.short] ?? 'scheduled';
  const round = Number(/(\d+)\s*$/.exec(x.league?.round ?? '')?.[1] ?? 0);
  const m: Match = {
    id: String(x.fixture.id),
    leagueId: String(x.league.id),
    round,
    kickoff: new Date(x.fixture.date).toISOString(),
    homeId: String(x.teams.home.id),
    awayId: String(x.teams.away.id),
    status,
  };
  if (status !== 'scheduled' && x.goals?.home != null && x.goals?.away != null) {
    m.score = { home: x.goals.home, away: x.goals.away };
  }
  return m;
}

async function listTeamsRaw(leagueId: string): Promise<Team[]> {
  const rows = await call('/teams', { league: leagueId, season: season() });
  const leagues = await call('/leagues', { id: leagueId });
  const country = leagues[0]?.country?.name ?? '';
  return rows.map((r: any) => ({
    id: String(r.team.id),
    leagueId,
    name: r.team.name,
    short: r.team.code || r.team.name.slice(0, 3).toUpperCase(),
    country: r.team.country || country,
    coach: '—', // тренер подтягивается отдельным запросом /coachs, чтобы не тратить лимит на списке команд
    stadium: r.venue?.name ?? '—',
  }));
}

const mapLineup = (l: any, confirmed: boolean): Lineup => {
  const conv = (e: any): LineupPlayer => ({
    id: String(e.player.id),
    name: e.player.name,
    number: e.player.number ?? undefined,
    pos: e.player.pos ? mapPos({ G: 'goalkeeper', D: 'defender', M: 'midfielder', F: 'attacker' }[e.player.pos as string]) : undefined,
  });
  return {
    teamId: String(l.team.id),
    formation: l.formation || '—',
    confirmed,
    startXI: (l.startXI ?? []).map(conv),
    bench: (l.substitutes ?? []).map(conv),
  };
};

const num = (v: any): number | null => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace('%', ''));
  return Number.isFinite(n) ? n : null;
};

function mapTeamStats(arr: any[]): TeamMatchStats {
  const get = (t: string) => num(arr.find((s: any) => s.type === t)?.value);
  return {
    xg: get('expected_goals'),
    possession: get('Ball Possession'),
    shots: get('Total Shots'),
    shotsOnTarget: get('Shots on Goal'),
    corners: get('Corner Kicks'),
    yellow: get('Yellow Cards'),
    red: get('Red Cards'),
  };
}

export const apiFootball: FootballProvider = {
  name: 'apifootball',

  async listLeagues(): Promise<League[]> {
    const out: League[] = [];
    for (const id of leagueIds()) {
      const r = (await call('/leagues', { id, season: season() }))[0];
      if (r) out.push({ id: String(r.league.id), name: r.league.name, country: r.country?.name ?? '', season: `${season()}/${String(season() + 1).slice(2)}` });
    }
    return out;
  },

  async listTeams(leagueId) {
    return listTeamsRaw(leagueId);
  },

  async listMatches(q: MatchQuery) {
    const from = q.from ? ymd(q.from) : undefined;
    const to = q.to ? ymd(q.to) : undefined;
    let rows: any[] = [];
    if (q.teamId) {
      rows = await call('/fixtures', { team: q.teamId, season: season(), from, to });
    } else {
      const ids = q.leagueId ? [q.leagueId] : leagueIds();
      for (const league of ids) rows.push(...(await call('/fixtures', { league, season: season(), from, to })));
    }
    const fromMs = q.from ? Date.parse(q.from) : -Infinity;
    const toMs = q.to ? Date.parse(q.to) : Infinity;
    return rows
      .map(mapFixture)
      .filter((m) => {
        const t = Date.parse(m.kickoff);
        return t >= fromMs && t <= toMs;
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  },

  async getMatch(id) {
    const r = (await call('/fixtures', { id }))[0];
    return r ? mapFixture(r) : null;
  },

  async getSquad(teamId) {
    const r = (await call('/players/squads', { team: teamId }))[0];
    const emptyStats = { apps: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
    const squad: Player[] = (r?.players ?? []).map((p: any) => ({
      id: String(p.id),
      teamId,
      name: p.name,
      position: mapPos(p.position),
      number: p.number ?? 0,
      age: p.age ?? 0,
      nationality: '—',
      stats: emptyStats,
    }));
    // Статистика сезона: постранично /players?team=&season= (до 20 игроков на страницу)
    try {
      const stats = await call('/players', { team: teamId, season: season(), page: 1 });
      for (const s of stats) {
        const st = s.statistics?.find((x: any) => String(x.team?.id) === teamId) ?? s.statistics?.[0];
        const p = squad.find((x) => x.id === String(s.player.id));
        if (p && st) {
          p.nationality = s.player.nationality ?? p.nationality;
          p.stats = {
            apps: st.games?.appearences ?? 0,
            minutes: st.games?.minutes ?? 0,
            goals: st.goals?.total ?? 0,
            assists: st.goals?.assists ?? 0,
            yellow: st.cards?.yellow ?? 0,
            red: st.cards?.red ?? 0,
          };
        }
      }
    } catch {
      /* статистика необязательна — отдаём состав без неё */
    }
    return squad;
  },

  async getPlayer(id) {
    const r = (await call('/players', { id, season: season() }))[0];
    if (!r) return null;
    const st = r.statistics?.[0];
    return {
      id: String(r.player.id),
      teamId: String(st?.team?.id ?? ''),
      name: r.player.name,
      position: mapPos(st?.games?.position),
      number: st?.games?.number ?? 0,
      age: r.player.age ?? 0,
      nationality: r.player.nationality ?? '—',
      stats: {
        apps: st?.games?.appearences ?? 0,
        minutes: st?.games?.minutes ?? 0,
        goals: st?.goals?.total ?? 0,
        assists: st?.goals?.assists ?? 0,
        yellow: st?.cards?.yellow ?? 0,
        red: st?.cards?.red ?? 0,
      },
    };
  },

  async getPlayerAppearances(playerId, limit): Promise<PlayerAppearance[]> {
    const p = await this.getPlayer(playerId);
    if (!p) return [];
    const matches = (await this.listMatches({ teamId: p.teamId }))
      .filter((m) => m.status === 'finished')
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, limit);
    const out: PlayerAppearance[] = [];
    for (const m of matches) {
      const rows = await call('/fixtures/players', { fixture: m.id, team: p.teamId });
      const e = rows[0]?.players?.find((x: any) => String(x.player.id) === playerId);
      const s = e?.statistics?.[0];
      if (!s || !s.games?.minutes) continue;
      out.push({
        matchId: m.id,
        kickoff: m.kickoff,
        opponentId: m.homeId === p.teamId ? m.awayId : m.homeId,
        isHome: m.homeId === p.teamId,
        minutes: s.games.minutes,
        goals: s.goals?.total ?? 0,
        assists: s.goals?.assists ?? 0,
        rating: s.games.rating ? Number(s.games.rating) : null,
      });
    }
    return out;
  },

  async getStandings(leagueId): Promise<StandingRow[]> {
    const r = (await call('/standings', { league: leagueId, season: season() }))[0];
    const rows: any[] = r?.league?.standings?.[0] ?? [];
    return rows.map((x) => ({
      teamId: String(x.team.id),
      played: x.all.played,
      won: x.all.win,
      drawn: x.all.draw,
      lost: x.all.lose,
      gf: x.all.goals.for,
      ga: x.all.goals.against,
      points: x.points,
    }));
  },

  async getLineups(matchId) {
    const m = await this.getMatch(matchId);
    const rows = await call('/fixtures/lineups', { fixture: matchId });
    const res: { home: Lineup | null; away: Lineup | null } = { home: null, away: null };
    if (m) {
      const h = rows.find((r) => String(r.team.id) === m.homeId);
      const a = rows.find((r) => String(r.team.id) === m.awayId);
      if (h) res.home = mapLineup(h, true);
      if (a) res.away = mapLineup(a, true);
      // Официального состава ещё нет → «вероятный» = состав последнего сыгранного матча команды.
      for (const side of ['home', 'away'] as const) {
        if (res[side]) continue;
        const teamId = side === 'home' ? m.homeId : m.awayId;
        const prev = (await this.listMatches({ teamId, to: m.kickoff }))
          .filter((x) => x.status === 'finished' && x.id !== m.id)
          .sort((x, y) => y.kickoff.localeCompare(x.kickoff))[0];
        if (!prev) continue;
        const pr = (await call('/fixtures/lineups', { fixture: prev.id })).find((r) => String(r.team.id) === teamId);
        if (pr) res[side] = mapLineup(pr, false);
      }
    }
    return res;
  },

  async getAbsences(teamId): Promise<Absence[]> {
    const rows = await call('/injuries', { team: teamId, season: season() });
    const now = Date.now();
    const seen = new Set<string>();
    const out: Absence[] = [];
    for (const r of rows) {
      if (Date.parse(r.fixture?.date) < now - 86400e3) continue; // только актуальные (будущие матчи)
      const id = String(r.player.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const reason = String(r.player.reason ?? '');
      out.push({
        playerId: id,
        playerName: r.player.name,
        teamId,
        reason: /susp|card/i.test(reason) ? 'suspension' : 'injury',
        detail: reason || String(r.player.type ?? ''),
      });
    }
    return out;
  },

  /** Тренер — отдельным запросом, чтобы не тратить лимит на списке команд. */
  async getCoach(teamId) {
    const rows = await call('/coachs', { team: teamId });
    const current = rows.find((c: any) => c.career?.some((k: any) => String(k.team?.id) === teamId && !k.end)) ?? rows[0];
    return current?.name ?? null;
  },

  async getMatchStats(matchId): Promise<MatchStats | null> {
    const m = await this.getMatch(matchId);
    if (!m || m.status !== 'finished') return null;
    const rows = await call('/fixtures/statistics', { fixture: matchId });
    const h = rows.find((r) => String(r.team.id) === m.homeId);
    const a = rows.find((r) => String(r.team.id) === m.awayId);
    if (!h || !a) return null;
    return { home: mapTeamStats(h.statistics ?? []), away: mapTeamStats(a.statistics ?? []) };
  },
};

