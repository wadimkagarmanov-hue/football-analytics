// Фоновый воркер: npm run worker
// 1) раз в WORKER_ODDS_INTERVAL_SEC обновляет коэффициенты ближайших матчей и пишет изменения цен в odds_snapshots (история для графика);
// 2) раз в WORKER_LINEUPS_INTERVAL_SEC обновляет составы матчей, до которых < 3 часов;
// 3) раз в WORKER_CORE_INTERVAL_SEC обновляет лиги, команды, расписание, таблицы и зеркалит их в БД.
// Все обращения к провайдерам идут через общий кэш и лимитер — воркер не превысит заданные лимиты.

import { db } from '../lib/db';
import {
  getLeagues, getLineups, getMatches, getOdds, getStandings, getTeamIndex, getTeams,
} from '../lib/data';
import { limiter } from '../lib/ratelimit';
import { footballProvider, oddsProvider } from '../lib/providers';
import type { Match } from '../lib/types';

const sec = (name: string, def: number) => Number(process.env[name] || def) * 1000;
const ODDS_MS = sec('WORKER_ODDS_INTERVAL_SEC', 60);
const LINEUPS_MS = sec('WORKER_LINEUPS_INTERVAL_SEC', 120);
const CORE_MS = sec('WORKER_CORE_INTERVAL_SEC', 900);
const DAY = 864e5;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), '[worker]', ...a);

/** Предстоящие и идущие матчи в окне [сейчас − 3 ч, сейчас + horizon]. */
async function upcoming(horizonMs: number): Promise<Match[]> {
  const now = Date.now();
  const res = await getMatches({ from: new Date(now - 3 * 3600e3).toISOString(), to: new Date(now + horizonMs).toISOString() });
  return res.data.filter((m) => m.status !== 'finished');
}

const lastPrice = new Map<string, number>();

async function refreshOdds() {
  const pool = db();
  const teams = await getTeamIndex();
  const matches = await upcoming(3 * DAY);
  let written = 0;
  for (const m of matches) {
    try {
      const res = await getOdds(m, teams, { force: true });
      if (!pool) continue;
      const rows = res.data.filter((q) => {
        const k = `${m.id}|${q.bookmaker}|${q.market}|${q.line ?? ''}|${q.selection}`;
        if (lastPrice.get(k) === q.price) return false;
        lastPrice.set(k, q.price);
        return true;
      });
      if (!rows.length) continue;
      // пакетная вставка
      const values: unknown[] = [];
      const tuples = rows.map((q, i) => {
        values.push(m.id, q.bookmaker, q.market, q.line ?? null, q.selection, q.price, q.updatedAt);
        const b = i * 7;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
      });
      await pool.query(
        `insert into odds_snapshots (match_id, bookmaker, market, line, selection, price, captured_at) values ${tuples.join(',')}`,
        values,
      );
      written += rows.length;
    } catch (e) {
      log('odds', m.id, (e as Error).message);
    }
  }
  log(`odds: матчей ${matches.length}, записано изменений ${written}`, limiter.usage(oddsProvider().name));
}

async function refreshLineups() {
  const matches = (await upcoming(3 * 3600e3)).slice(0, 50);
  for (const m of matches) {
    try {
      await getLineups(m.id, { force: true });
    } catch (e) {
      log('lineups', m.id, (e as Error).message);
    }
  }
  log(`lineups: матчей ${matches.length}`, limiter.usage(footballProvider().name));
}

async function refreshCore() {
  const leagues = await getLeagues({ force: true });
  const pool = db();
  for (const l of leagues.data) {
    const [teams, matches] = await Promise.all([getTeams(l.id, { force: true }), getMatches({ leagueId: l.id }, { force: true })]);
    await getStandings(l.id, { force: true }).catch((e) => log('standings', l.id, e.message));
    if (!pool) continue;
    try {
      await pool.query(
        `insert into leagues (id, name, country, season) values ($1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name, country = excluded.country, season = excluded.season, updated_at = now()`,
        [l.id, l.name, l.country, l.season],
      );
      for (const t of teams.data) {
        await pool.query(
          `insert into teams (id, league_id, name, short, country, coach, stadium) values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (id) do update set league_id = excluded.league_id, name = excluded.name, short = excluded.short,
             country = excluded.country, coach = excluded.coach, stadium = excluded.stadium, updated_at = now()`,
          [t.id, t.leagueId, t.name, t.short, t.country, t.coach, t.stadium],
        );
      }
      for (const m of matches.data) {
        await pool.query(
          `insert into matches (id, league_id, round, kickoff, home_id, away_id, status, home_goals, away_goals)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set round = excluded.round, kickoff = excluded.kickoff, status = excluded.status,
             home_goals = excluded.home_goals, away_goals = excluded.away_goals, updated_at = now()`,
          [m.id, m.leagueId, m.round, m.kickoff, m.homeId, m.awayId, m.status, m.score?.home ?? null, m.score?.away ?? null],
        );
      }
    } catch (e) {
      log('db sync', l.id, (e as Error).message);
    }
  }
  log(`core: лиг ${leagues.data.length}`, limiter.usage(footballProvider().name));
}

function every(name: string, ms: number, fn: () => Promise<void>) {
  let running = false;
  const run = async () => {
    if (running) return; // не накладываем запуски
    running = true;
    try {
      await fn();
    } catch (e) {
      log(name, 'ошибка:', (e as Error).message);
    } finally {
      running = false;
    }
  };
  run();
  return setInterval(run, ms);
}

log(`старт. футбол: ${footballProvider().name}, коэффициенты: ${oddsProvider().name}, БД: ${db() ? 'да' : 'нет (история не пишется)'}`);
// core первым: он прогревает кэш команд и расписание
every('core', CORE_MS, refreshCore);
setTimeout(() => every('odds', ODDS_MS, refreshOdds), 5000);
setTimeout(() => every('lineups', LINEUPS_MS, refreshLineups), 8000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
