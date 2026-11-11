// Быстрая проверка слоя данных без Next.js и без сети: npm run selftest
import assert from 'node:assert/strict';
import { bookmakerMargin, calcFromOdds, bestBySelection, groupByMarket, marginForBookmaker } from '../src/lib/odds';
import { checkCondition } from '../src/lib/analytics';
import {
  getLeagues, getMatches, getMatch, getOdds, getTeamIndex, getStandings, getLineups, getTeamAverages, getSquad, getTeamMatches,
} from '../src/lib/data';

async function main() {
  // калькулятор
  const c = calcFromOdds([2.0, 3.5, 4.0]);
  assert.ok(Math.abs(c.margin - (0.5 + 1 / 3.5 + 0.25 - 1)) < 1e-9);
  assert.ok(Math.abs(c.fair.reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.ok(Math.abs(bookmakerMargin([2, 2])) < 1e-9);

  const leagues = (await getLeagues()).data;
  assert.equal(leagues.length, 3);
  const teams = await getTeamIndex();
  assert.equal(teams.size, 24);

  const all = (await getMatches({})).data;
  assert.equal(all.length, 3 * 56);
  const finished = all.filter((m) => m.status === 'finished');
  const upcoming = all.filter((m) => m.status === 'scheduled');
  assert.ok(finished.length > 20 && upcoming.length > 20, 'есть и сыгранные, и будущие матчи');

  const st = (await getStandings('L1')).data;
  assert.equal(st.length, 8);
  assert.equal(st.reduce((s, r) => s + r.gf, 0), st.reduce((s, r) => s + r.ga, 0), 'забитые = пропущенные');

  const m = upcoming[0];
  const odds = (await getOdds(m, teams)).data;
  const groups = groupByMarket(odds);
  assert.ok(groups.has('1X2|'));
  const g1 = groups.get('1X2|')!;
  const best = bestBySelection(g1);
  for (const q of g1) assert.ok(q.price <= best[q.selection]);
  const margin = marginForBookmaker(g1, 'БК Альфа', '1X2')!;
  assert.ok(margin > 0 && margin < 0.15, `маржа 1X2 разумна: ${margin}`);
  assert.ok(odds.every((q) => q.history.length >= 2 && q.price > 1));

  const lu = (await getLineups(m.id)).data;
  assert.equal(lu.home!.startXI.length, 11);
  assert.equal(lu.away!.startXI.length, 11);

  const avg = await getTeamAverages(m.homeId, undefined, 5);
  assert.ok(avg.n > 0 && avg.xg != null && avg.possession != null);

  const squad = (await getSquad(m.homeId)).data;
  assert.equal(squad.length, 20);

  const hm = (await getTeamMatches(m.homeId)).data;
  const am = (await getTeamMatches(m.awayId)).data;
  checkCondition('home_unbeaten_home', 2, { id: m.homeId, matches: hm }, { id: m.awayId, matches: am });

  const one = (await getMatch(m.id)).data;
  assert.equal(one?.id, m.id);

  console.log(`OK: матчей ${all.length} (сыграно ${finished.length}), котировок на матч ${odds.length}, маржа 1X2 у БК Альфа ${(margin * 100).toFixed(1)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
