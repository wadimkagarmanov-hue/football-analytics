// Адаптер The Odds API (v4). Преобразует ответы в OddsQuote.
// НЕ проверялся на живом ключе — сверьте на вашем тарифе (см. README).
// The Odds API не отдаёт историю цен в обычных запросах — её копит воркер в таблице odds_snapshots.

import type { Match, OddsQuote, Team } from '../types';
import type { OddsProvider } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = 'https://api.the-odds-api.com/v4';

const sportKeys = (): Record<string, string> => {
  try {
    return JSON.parse(process.env.ODDS_SPORT_KEYS || '{}');
  } catch {
    return {};
  }
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|club|de|the)\b/g, '')
    .replace(/[^a-zа-я0-9]/g, '');

const sameTeam = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

async function api(path: string, params: Record<string, string>): Promise<any> {
  const key = process.env.THEODDSAPI_KEY;
  if (!key) throw new Error('THEODDSAPI_KEY is not set');
  const url = new URL(BASE + path);
  url.searchParams.set('apiKey', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The Odds API ${path}: HTTP ${res.status}`);
  return res.json();
}

// Короткая память на ответ по виду спорта, чтобы запросы разных матчей одной лиги не дублировались.
const sportMemo = new Map<string, { at: number; data: any[] }>();
async function eventsFor(sport: string): Promise<any[]> {
  const hit = sportMemo.get(sport);
  if (hit && Date.now() - hit.at < 20e3) return hit.data;
  const data = await api(`/sports/${sport}/odds`, {
    regions: process.env.ODDS_REGIONS || 'eu',
    markets: 'h2h,totals,spreads',
    oddsFormat: 'decimal',
  });
  sportMemo.set(sport, { at: Date.now(), data });
  return data;
}

export const theOddsApi: OddsProvider = {
  name: 'theoddsapi',

  async getOdds(match: Match, home: Team, away: Team): Promise<OddsQuote[]> {
    const sport = sportKeys()[match.leagueId];
    if (!sport) return [];
    const events = await eventsFor(sport);
    const kick = Date.parse(match.kickoff);
    const ev = events.find(
      (e) => Math.abs(Date.parse(e.commence_time) - kick) < 3 * 3600e3 && sameTeam(e.home_team, home.name) && sameTeam(e.away_team, away.name),
    );
    if (!ev) return [];

    const out: OddsQuote[] = [];
    const push = (bookmaker: string, market: OddsQuote['market'], selection: string, price: number, at: string, line?: number) =>
      out.push({ bookmaker, market, selection, price, updatedAt: at, history: [], ...(line != null ? { line } : {}) });

    const collect = (bookmakers: any[]) => {
      for (const b of bookmakers) {
        for (const mk of b.markets ?? []) {
          const at = mk.last_update ?? b.last_update;
          if (mk.key === 'h2h') {
            for (const o of mk.outcomes) {
              const sel = /draw/i.test(o.name) ? 'X' : sameTeam(o.name, ev.home_team) ? '1' : '2';
              push(b.title, '1X2', sel, o.price, at);
            }
          } else if (mk.key === 'totals') {
            for (const o of mk.outcomes) push(b.title, 'TOTAL', /over/i.test(o.name) ? 'Over' : 'Under', o.price, at, o.point);
          } else if (mk.key === 'spreads') {
            for (const o of mk.outcomes) {
              const isHome = sameTeam(o.name, ev.home_team);
              // линия хранится для хозяев: у гостей знак обратный
              push(b.title, 'HANDICAP', isHome ? 'Home' : 'Away', o.price, at, isHome ? o.point : -o.point);
            }
          } else if (mk.key === 'btts') {
            for (const o of mk.outcomes) push(b.title, 'BTTS', /yes/i.test(o.name) ? 'Yes' : 'No', o.price, at);
          }
        }
      }
    };
    collect(ev.bookmakers ?? []);

    // «Обе забьют» отдаётся только событийным запросом (расходует дополнительный лимит).
    try {
      const detail = await api(`/sports/${sport}/events/${ev.id}/odds`, {
        regions: process.env.ODDS_REGIONS || 'eu',
        markets: 'btts',
        oddsFormat: 'decimal',
      });
      collect(detail.bookmakers ?? []);
    } catch {
      /* рынок может быть недоступен на тарифе */
    }
    return out;
  },
};
