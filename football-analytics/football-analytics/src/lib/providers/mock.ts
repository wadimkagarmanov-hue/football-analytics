// Демо-провайдер: полностью вымышленные лиги, команды и игроки, детерминированная генерация.
// Нужен, чтобы сайт работал без ключей. Это НЕ реальные данные.

import { computeStandings } from '../analytics';
import type {
  Absence,
  League,
  Lineup,
  LineupPlayer,
  Match,
  MatchStats,
  OddsQuote,
  Player,
  PlayerAppearance,
  Position,
  StandingRow,
  Team,
} from '../types';
import type { FootballProvider, MatchQuery, OddsProvider } from './types';

const DAY = 864e5;

// ── Псевдослучайность ────────────────────────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = (seed: string) => mulberry32(hash(seed));
const r1 = (seed: string) => rnd(seed)();
const pick = <T,>(arr: T[], seed: string): T => arr[Math.floor(r1(seed) * arr.length)];

function poissonSample(lambda: number, r: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}
function poissonPmf(k: number, lambda: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

// ── Мир ──────────────────────────────────────────────────────────────────
const LEAGUES: League[] = [
  { id: 'L1', name: 'Демо-лига А', country: 'Англия', season: '2026/27' },
  { id: 'L2', name: 'Демо-лига B', country: 'Испания', season: '2026/27' },
  { id: 'L3', name: 'Демо-лига C', country: 'Германия', season: '2026/27' },
];

const TEAM_NAMES: Record<string, string[]> = {
  L1: ['Рейвенсбрук', 'Нортфилд', 'Эшвуд Роверс', 'Блэкмор Атлетик', 'Сент-Клер', 'Вестхэвен', 'Ферн-Вэлли', 'Кингсбридж'],
  L2: ['Сьерра-Бланка', 'Мирамар', 'Каса-Верде', 'Лома-Альта', 'Эль-Прадо', 'Монтеверде', 'Пуэрто-Рояль', 'Ривера'],
  L3: ['Айхенталь', 'Бергштадт', 'Фрайбах', 'Нордвальд', 'Зеебург', 'Хохфельд', 'Линденау', 'Штайнбрюк'],
};
const FIRST = ['Алекс', 'Марк', 'Лукас', 'Томас', 'Рафаэль', 'Дэниел', 'Йохан', 'Карлос', 'Эрик', 'Оливер', 'Матео', 'Феликс', 'Даниэль', 'Лео'];
const LAST = ['Вернер', 'Моралес', 'Хьюз', 'Беккер', 'Сантос', 'Кларк', 'Фишер', 'Рамос', 'Лундгрен', 'Паркер', 'Новак', 'Ортега', 'Шмидт', 'Дюран', 'Грин', 'Хансен'];
const NATION: Record<string, string> = { L1: 'Англия', L2: 'Испания', L3: 'Германия' };
const SQUAD_POS: Position[] = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'FW'];
const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];
const INJURIES = ['Растяжение мышцы бедра', 'Повреждение связок колена', 'Ушиб голеностопа', 'Мышечная травма', 'Болезнь'];

interface Fixture {
  id: string;
  leagueId: string;
  round: number;
  kickoffMs: number;
  homeId: string;
  awayId: string;
}

interface World {
  teams: Map<string, Team>;
  strength: Map<string, number>;
  squads: Map<string, Player[]>;
  players: Map<string, Player>;
  quality: Map<string, number>;
  fixtures: Fixture[];
}

function roundRobin(ids: string[]): [string, string][][] {
  const n = ids.length;
  const arr = [...ids];
  const first: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    first.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = first.map((round) => round.map(([a, b]) => [b, a] as [string, string]));
  return [...first, ...second];
}

function buildWorld(): World {
  const teams = new Map<string, Team>();
  const strength = new Map<string, number>();
  const squads = new Map<string, Player[]>();
  const players = new Map<string, Player>();
  const quality = new Map<string, number>();
  const fixtures: Fixture[] = [];

  // базовая точка: начало сегодняшних суток (UTC) минус 21 день → раунд 7 приходится на сегодня
  const base = Math.floor(Date.now() / DAY) * DAY - 21 * DAY;

  LEAGUES.forEach((lg, li) => {
    const ids: string[] = [];
    TEAM_NAMES[lg.id].forEach((name, ti) => {
      const id = `${lg.id}-T${ti + 1}`;
      ids.push(id);
      teams.set(id, {
        id,
        leagueId: lg.id,
        name,
        short: name.replace(/[^А-Яа-яA-Za-z]/g, '').slice(0, 3).toUpperCase(),
        country: lg.country,
        coach: `${pick(FIRST, `coachf:${id}`)} ${pick(LAST, `coachl:${id}`)}`,
        stadium: `Стадион «${name}»`,
      });
      strength.set(id, 0.7 + r1(`str:${id}`) * 0.8);

      const squad: Player[] = SQUAD_POS.map((position, i) => {
        const pid = `${id}-P${i + 1}`;
        const q = r1(`q:${pid}`);
        quality.set(pid, q);
        const p: Player = {
          id: pid,
          teamId: id,
          name: `${pick(FIRST, `pf:${pid}`)} ${pick(LAST, `pl:${pid}`)}`,
          position,
          number: i + 1,
          age: 18 + Math.floor(r1(`age:${pid}`) * 18),
          nationality: r1(`nat:${pid}`) < 0.7 ? NATION[lg.id] : pick(Object.values(NATION), `nat2:${pid}`),
          stats: { apps: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 },
        };
        players.set(pid, p);
        return p;
      });
      squads.set(id, squad);
    });

    roundRobin(ids).forEach((pairs, r) => {
      pairs.forEach(([h, a], i) => {
        const slot = [13, 15.5, 18, 20.5][i % 4];
        fixtures.push({
          id: `${lg.id}-r${r + 1}-${i + 1}`,
          leagueId: lg.id,
          round: r + 1,
          kickoffMs: base + (r * 3 + li) * DAY + slot * 3600e3,
          homeId: h,
          awayId: a,
        });
      });
    });
  });

  return { teams, strength, squads, players, quality, fixtures };
}

// Мир пересобирается при смене суток (UTC), чтобы «сегодня» в демо не уезжало при долгой работе процесса.
const gw = globalThis as unknown as { __mockWorld?: { day: number; w: World } };
const world = (): World => {
  const day = Math.floor(Date.now() / DAY);
  if (!gw.__mockWorld || gw.__mockWorld.day !== day) gw.__mockWorld = { day, w: buildWorld() };
  return gw.__mockWorld.w;
};

// ── Матчи ────────────────────────────────────────────────────────────────
function lambdas(f: Fixture) {
  const w = world();
  const sh = w.strength.get(f.homeId)!;
  const sa = w.strength.get(f.awayId)!;
  return { lh: 1.45 * Math.sqrt(sh / sa), la: 1.1 * Math.sqrt(sa / sh) };
}

function finalScore(f: Fixture) {
  const { lh, la } = lambdas(f);
  const r = rnd(`score:${f.id}`);
  return { home: poissonSample(lh, r), away: poissonSample(la, r) };
}

function toMatch(f: Fixture): Match {
  const now = Date.now();
  const m: Match = {
    id: f.id,
    leagueId: f.leagueId,
    round: f.round,
    kickoff: new Date(f.kickoffMs).toISOString(),
    homeId: f.homeId,
    awayId: f.awayId,
    status: 'scheduled',
  };
  if (now >= f.kickoffMs) {
    const s = finalScore(f);
    const elapsed = now - f.kickoffMs;
    if (elapsed < 105 * 60e3) {
      const frac = elapsed / (105 * 60e3);
      m.status = 'live';
      m.score = { home: Math.floor(s.home * frac), away: Math.floor(s.away * frac) };
    } else {
      m.status = 'finished';
      m.score = s;
    }
  }
  return m;
}

const allMatches = () => world().fixtures.map(toMatch);

function statsFor(f: Fixture): MatchStats {
  const { lh, la } = lambdas(f);
  const r = rnd(`stats:${f.id}`);
  const poss = Math.max(30, Math.min(70, Math.round(50 + (lh - la) * 9 + (r() - 0.5) * 8)));
  const side = (lam: number, possession: number) => {
    const shots = Math.max(3, Math.round(lam * 6 + 4 + r() * 5));
    return {
      xg: Math.round(lam * (0.8 + r() * 0.4) * 100) / 100,
      possession,
      shots,
      shotsOnTarget: Math.max(1, Math.round(shots * (0.3 + r() * 0.15))),
      corners: Math.round(2 + shots / 4 + r() * 3),
      yellow: Math.floor(r() * 4),
      red: r() < 0.05 ? 1 : 0,
    };
  };
  return { home: side(lh, poss), away: side(la, 100 - poss) };
}

// ── Составы и отсутствующие ──────────────────────────────────────────────
function absencesFor(teamId: string): Absence[] {
  const squad = world().squads.get(teamId) ?? [];
  const n = 1 + Math.floor(r1(`abs-n:${teamId}`) * 3);
  const out: Absence[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const p = squad[Math.floor(r1(`abs:${teamId}:${i}`) * squad.length)];
    if (!p || used.has(p.id)) continue;
    used.add(p.id);
    const susp = r1(`abs-t:${teamId}:${i}`) < 0.3;
    out.push({
      playerId: p.id,
      playerName: p.name,
      teamId,
      reason: susp ? 'suspension' : 'injury',
      detail: susp ? 'Дисквалификация (накопление жёлтых карточек)' : pick(INJURIES, `abs-d:${teamId}:${i}`),
    });
  }
  return out;
}

function lineupFor(teamId: string, f: Fixture): Lineup {
  const w = world();
  const squad = w.squads.get(teamId) ?? [];
  const out = new Set(absencesFor(teamId).map((a) => a.playerId));
  const formation = pick(FORMATIONS, `form:${teamId}:${f.round}`);
  const parts = formation.split('-').map(Number);
  const need: Record<Position, number> = {
    GK: 1,
    DF: parts[0],
    MF: parts.slice(1, -1).reduce((s, x) => s + x, 0),
    FW: parts[parts.length - 1],
  };
  const ranked = (pos: Position) =>
    squad.filter((p) => p.position === pos && !out.has(p.id)).sort((a, b) => (w.quality.get(b.id) ?? 0) - (w.quality.get(a.id) ?? 0));
  const start: LineupPlayer[] = [];
  const startIds = new Set<string>();
  (['GK', 'DF', 'MF', 'FW'] as Position[]).forEach((pos) => {
    ranked(pos)
      .slice(0, need[pos])
      .forEach((p) => {
        start.push({ id: p.id, name: p.name, number: p.number, pos: p.position });
        startIds.add(p.id);
      });
  });
  const bench = squad
    .filter((p) => !startIds.has(p.id) && !out.has(p.id))
    .slice(0, 7)
    .map((p) => ({ id: p.id, name: p.name, number: p.number, pos: p.position }));
  const confirmed = Date.now() >= f.kickoffMs - 75 * 60e3;
  return { teamId, formation, confirmed, startXI: start, bench };
}

// ── Провайдер футбольных данных ──────────────────────────────────────────
function seasonStats(p: Player): Player {
  const played = allMatches().filter(
    (m) => m.status === 'finished' && (m.homeId === p.teamId || m.awayId === p.teamId),
  ).length;
  const q = world().quality.get(p.id) ?? 0.5;
  const apps = Math.floor(played * (0.3 + 0.7 * q));
  const rate = { GK: 0, DF: 0.05, MF: 0.15, FW: 0.4 }[p.position];
  const goals = Math.round(apps * rate * (0.5 + q));
  const assists = p.position === 'GK' ? 0 : Math.round(apps * (rate * 0.6 + 0.04) * (0.5 + q));
  return {
    ...p,
    stats: {
      apps,
      minutes: Math.round(apps * (55 + 35 * q)),
      goals,
      assists,
      yellow: Math.floor(apps * 0.15 * r1(`y:${p.id}`) * 2),
      red: r1(`r:${p.id}`) < 0.05 ? 1 : 0,
    },
  };
}

export const mockFootball: FootballProvider = {
  name: 'mock',
  async listLeagues() {
    return LEAGUES;
  },
  async listTeams(leagueId) {
    return [...world().teams.values()].filter((t) => t.leagueId === leagueId);
  },
  async listMatches(q: MatchQuery) {
    const from = q.from ? Date.parse(q.from) : -Infinity;
    const to = q.to ? Date.parse(q.to) : Infinity;
    return allMatches()
      .filter((m) => {
        const t = Date.parse(m.kickoff);
        return (
          t >= from &&
          t <= to &&
          (!q.leagueId || m.leagueId === q.leagueId) &&
          (!q.teamId || m.homeId === q.teamId || m.awayId === q.teamId)
        );
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  },
  async getMatch(id) {
    const f = world().fixtures.find((x) => x.id === id);
    return f ? toMatch(f) : null;
  },
  async getSquad(teamId) {
    return (world().squads.get(teamId) ?? []).map(seasonStats);
  },
  async getPlayer(id) {
    const p = world().players.get(id);
    return p ? seasonStats(p) : null;
  },
  async getPlayerAppearances(playerId, limit) {
    const p = world().players.get(playerId);
    if (!p) return [];
    return allMatches()
      .filter((m) => m.status === 'finished' && (m.homeId === p.teamId || m.awayId === p.teamId))
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .slice(0, limit)
      .map((m) => {
        const r = rnd(`app:${playerId}:${m.id}`);
        const rate = { GK: 0, DF: 0.05, MF: 0.15, FW: 0.4 }[p.position];
        return {
          matchId: m.id,
          kickoff: m.kickoff,
          opponentId: m.homeId === p.teamId ? m.awayId : m.homeId,
          isHome: m.homeId === p.teamId,
          minutes: r() < 0.75 ? 90 : Math.round(15 + r() * 60),
          goals: r() < rate ? 1 : 0,
          assists: p.position !== 'GK' && r() < rate * 0.6 ? 1 : 0,
          rating: Math.round((5.5 + r() * 3) * 10) / 10,
        } satisfies PlayerAppearance;
      });
  },
  async getStandings(leagueId): Promise<StandingRow[]> {
    const ids = [...world().teams.values()].filter((t) => t.leagueId === leagueId).map((t) => t.id);
    return computeStandings(ids, allMatches().filter((m) => m.leagueId === leagueId));
  },
  async getLineups(matchId) {
    const f = world().fixtures.find((x) => x.id === matchId);
    if (!f) return { home: null, away: null };
    return { home: lineupFor(f.homeId, f), away: lineupFor(f.awayId, f) };
  },
  async getAbsences(teamId) {
    return absencesFor(teamId);
  },
  async getMatchStats(matchId) {
    const f = world().fixtures.find((x) => x.id === matchId);
    if (!f || Date.now() < f.kickoffMs + 105 * 60e3) return null;
    return statsFor(f);
  },
};

// ── Демо-провайдер коэффициентов ─────────────────────────────────────────
const BOOKS = [
  { name: 'БК Альфа', margin: 0.045 },
  { name: 'БК Бета', margin: 0.055 },
  { name: 'БК Гамма', margin: 0.065 },
  { name: 'БК Дельта', margin: 0.05 },
];

export const mockOdds: OddsProvider = {
  name: 'mock',
  async getOdds(match) {
    const f = world().fixtures.find((x) => x.id === match.id);
    if (!f) return [];
    const { lh, la } = lambdas(f);
    const N = 9;
    let pH = 0, pD = 0, pA = 0, btts = 0;
    const grid: number[][] = [];
    for (let h = 0; h < N; h++) {
      grid.push([]);
      for (let a = 0; a < N; a++) {
        const p = poissonPmf(h, lh) * poissonPmf(a, la);
        grid[h].push(p);
        if (h > a) pH += p;
        else if (h === a) pD += p;
        else pA += p;
        if (h > 0 && a > 0) btts += p;
      }
    }
    const sum = (fn: (h: number, a: number) => boolean) => {
      let s = 0;
      for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) if (fn(h, a)) s += grid[h][a];
      return s;
    };
    const norm = pH + pD + pA;

    type Sel = { market: OddsQuote['market']; selection: string; line?: number; p: number };
    const sels: Sel[] = [
      { market: '1X2', selection: '1', p: pH / norm },
      { market: '1X2', selection: 'X', p: pD / norm },
      { market: '1X2', selection: '2', p: pA / norm },
      { market: 'BTTS', selection: 'Yes', p: btts },
      { market: 'BTTS', selection: 'No', p: 1 - btts },
    ];
    for (const line of [1.5, 2.5, 3.5]) {
      const over = sum((h, a) => h + a > line);
      sels.push({ market: 'TOTAL', selection: 'Over', line, p: over }, { market: 'TOTAL', selection: 'Under', line, p: 1 - over });
    }
    for (const line of [-1.5, -0.5, 0.5, 1.5]) {
      const home = sum((h, a) => h - a + line > 0);
      sels.push({ market: 'HANDICAP', selection: 'Home', line, p: home }, { market: 'HANDICAP', selection: 'Away', line, p: 1 - home });
    }

    const now = Date.now();
    const bucket = Math.floor(now / 30000);
    const STEPS = 16;
    const out: OddsQuote[] = [];
    for (const bk of BOOKS) {
      for (const s of sels) {
        const key = `${s.market}:${s.line ?? ''}:${s.selection}`;
        const noise = 1 + (r1(`n:${f.id}:${bk.name}:${key}`) - 0.5) * 0.06;
        const wobble = 1 + (r1(`w:${f.id}:${bk.name}:${key}:${bucket}`) - 0.5) * 0.012;
        const base = 1 / (Math.max(s.p, 0.01) * (1 + bk.margin)) * noise;
        const price = Math.max(1.01, Math.round(base * wobble * 100) / 100);
        const trend = (r1(`tr:${f.id}:${s.market}:${s.line ?? ''}:${s.selection}`) - 0.5) * 0.14;
        const history = Array.from({ length: STEPS }, (_, k) => {
          const left = (STEPS - 1 - k) / (STEPS - 1);
          const drift = trend * left + (r1(`h:${f.id}:${bk.name}:${key}:${k}`) - 0.5) * 0.04 * left;
          const p = k === STEPS - 1 ? price : Math.max(1.01, Math.round(base * (1 + drift) * 100) / 100);
          return { t: new Date(now - (STEPS - 1 - k) * 3 * 3600e3).toISOString(), p };
        });
        out.push({
          bookmaker: bk.name,
          market: s.market,
          selection: s.selection,
          ...(s.line != null ? { line: s.line } : {}),
          price,
          updatedAt: new Date(now).toISOString(),
          history,
        });
      }
    }
    return out;
  },
};
