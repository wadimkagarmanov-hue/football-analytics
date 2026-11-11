import { averages, lastN, record } from '@/lib/analytics';
import {
  getMatch, getMatchStats, getOdds, getSquad, getStandings, getTeamIndex, getTeamMatches,
} from '@/lib/data';
import { MARKET_LABEL, SELECTION_LABEL } from '@/lib/odds';

export const dynamic = 'force-dynamic';

type V = string | number | null | undefined;

function toCsv(rows: V[][]): string {
  const esc = (v: V) => {
    const s = v == null ? '' : String(v);
    return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

function respond(name: string, rows: V[][]) {
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

// GET /api/export?kind=standings&league=ID | team-matches&team=ID | squad&team=ID | odds&match=ID | match-stats&match=ID | compare&a=ID&b=ID
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get('kind');
  try {
    const teams = await getTeamIndex();
    const name = (id: string) => teams.get(id)?.name ?? id;

    if (kind === 'standings') {
      const league = sp.get('league') ?? '';
      const rows = (await getStandings(league)).data;
      return respond(`standings-${league}`, [
        ['Место', 'Команда', 'И', 'В', 'Н', 'П', 'ЗМ', 'ПМ', 'РМ', 'Очки'],
        ...rows.map((r, i) => [i + 1, name(r.teamId), r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gf - r.ga, r.points]),
      ]);
    }

    if (kind === 'team-matches') {
      const team = sp.get('team') ?? '';
      const ms = (await getTeamMatches(team)).data;
      return respond(`matches-${team}`, [
        ['Дата (UTC)', 'Тур', 'Хозяева', 'Гости', 'Счёт', 'Статус'],
        ...ms.map((m) => [m.kickoff, m.round, name(m.homeId), name(m.awayId), m.score ? `${m.score.home}:${m.score.away}` : '', m.status]),
      ]);
    }

    if (kind === 'squad') {
      const team = sp.get('team') ?? '';
      const squad = (await getSquad(team)).data;
      return respond(`squad-${team}`, [
        ['№', 'Игрок', 'Позиция', 'Возраст', 'Матчи', 'Минуты', 'Голы', 'Пасы', 'ЖК', 'КК'],
        ...squad.map((p) => [p.number, p.name, p.position, p.age, p.stats.apps, p.stats.minutes, p.stats.goals, p.stats.assists, p.stats.yellow, p.stats.red]),
      ]);
    }

    if (kind === 'odds') {
      const id = sp.get('match') ?? '';
      const m = (await getMatch(id)).data;
      if (!m) return new Response('not found', { status: 404 });
      const odds = (await getOdds(m, teams)).data;
      return respond(`odds-${id}`, [
        ['Букмекер', 'Рынок', 'Линия', 'Исход', 'Коэффициент', 'Обновлено (UTC)'],
        ...odds.map((q) => [q.bookmaker, MARKET_LABEL[q.market], q.line ?? '', SELECTION_LABEL[q.selection] ?? q.selection, q.price, q.updatedAt]),
      ]);
    }

    if (kind === 'match-stats') {
      const id = sp.get('match') ?? '';
      const m = (await getMatch(id)).data;
      if (!m) return new Response('not found', { status: 404 });
      const s = (await getMatchStats(id, m.status === 'finished')).data;
      if (!s) return respond(`match-stats-${id}`, [['Статистика появится после матча']]);
      const rows: [string, keyof typeof s.home][] = [
        ['xG', 'xg'], ['Владение, %', 'possession'], ['Удары', 'shots'], ['В створ', 'shotsOnTarget'],
        ['Угловые', 'corners'], ['Жёлтые', 'yellow'], ['Красные', 'red'],
      ];
      return respond(`match-stats-${id}`, [['Показатель', name(m.homeId), name(m.awayId)], ...rows.map(([l, k]) => [l, s.home[k], s.away[k]])]);
    }

    if (kind === 'compare') {
      const a = sp.get('a') ?? '';
      const b = sp.get('b') ?? '';
      const out: V[][] = [['Показатель', name(a), name(b)]];
      const [ma, mb] = await Promise.all([getTeamMatches(a), getTeamMatches(b)]);
      const stat = async (id: string, ms: typeof ma.data) => {
        const items = await Promise.all(
          lastN(ms, id, 10).map(async (match) => ({ match, stats: (await getMatchStats(match.id, true).catch(() => null))?.data ?? null })),
        );
        return averages(items, id);
      };
      const [sa, sb] = await Promise.all([stat(a, ma.data), stat(b, mb.data)]);
      const ra = record(ma.data, a);
      const rb = record(mb.data, b);
      out.push(
        ['Матчи', ra.played, rb.played], ['Очки', ra.points, rb.points], ['Забито', ra.gf, rb.gf], ['Пропущено', ra.ga, rb.ga],
        ['Голы за матч (посл. 10)', sa.gf.toFixed(2), sb.gf.toFixed(2)], ['xG (посл. 10)', sa.xg?.toFixed(2), sb.xg?.toFixed(2)],
        ['Владение, % (посл. 10)', sa.possession?.toFixed(1), sb.possession?.toFixed(1)], ['Удары (посл. 10)', sa.shots?.toFixed(1), sb.shots?.toFixed(1)],
        ['Угловые (посл. 10)', sa.corners?.toFixed(1), sb.corners?.toFixed(1)],
      );
      return respond(`compare-${a}-${b}`, out);
    }

    // небольшая справка по доступным видам
    return new Response('Unknown kind. Use: standings, team-matches, squad, odds, match-stats, compare.', { status: 400 });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
