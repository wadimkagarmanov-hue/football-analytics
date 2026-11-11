import { CsvButton, FormStrip, Section, StatBar } from '@/components/ui';
import { lastN, record, resultFor } from '@/lib/analytics';
import { getLeagues, getStandings, getTeamAverages, getTeamIndex, getTeamMatches } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Сравнение команд' };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const [teams, leagues] = await Promise.all([getTeamIndex(), getLeagues()]);
  const all = [...teams.values()].sort((x, y) => x.name.localeCompare(y.name, 'ru'));
  const a = sp.a ? teams.get(sp.a) : undefined;
  const b = sp.b ? teams.get(sp.b) : undefined;
  const leagueName = (id: string) => leagues.data.find((l) => l.id === id)?.name ?? '';

  const options = () =>
    all.map((t) => (
      <option key={t.id} value={t.id}>
        {t.name} ({leagueName(t.leagueId)})
      </option>
    ));

  let body: React.ReactNode = <p className="text-sm text-muted">Выберите две команды, чтобы сравнить их показатели бок о бок.</p>;

  if (a && b) {
    const load = async (id: string, leagueId: string) => {
      const [ms, avg, avgHome, avgAway, st] = await Promise.all([
        getTeamMatches(id),
        getTeamAverages(id, undefined, 10),
        getTeamAverages(id, 'home', 10),
        getTeamAverages(id, 'away', 10),
        getStandings(leagueId).catch(() => null),
      ]);
      return {
        ms: ms.data,
        avg,
        avgHome,
        avgAway,
        pos: st ? st.data.findIndex((r) => r.teamId === id) + 1 : 0,
      };
    };
    const [A, B] = await Promise.all([load(a.id, a.leagueId), load(b.id, b.leagueId)]);
    const rA = record(A.ms, a.id);
    const rB = record(B.ms, b.id);
    const hA = record(A.ms, a.id, 'home');
    const hB = record(B.ms, b.id, 'home');
    const gA = record(A.ms, a.id, 'away');
    const gB = record(B.ms, b.id, 'away');
    const ppg = (r: ReturnType<typeof record>) => (r.played ? r.points / r.played : null);

    body = (
      <div className="space-y-4">
        <section className="card p-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{a.name}</p>
              <p className="text-xs text-muted">{leagueName(a.leagueId)}{A.pos ? ` · ${A.pos}-е место` : ''}</p>
              <div className="mt-1.5"><FormStrip form={lastN(A.ms, a.id, 5).map((m) => resultFor(m, a.id)).reverse()} /></div>
            </div>
            <span className="text-muted">vs</span>
            <div>
              <p className="text-lg font-bold">{b.name}</p>
              <p className="text-xs text-muted">{leagueName(b.leagueId)}{B.pos ? ` · ${B.pos}-е место` : ''}</p>
              <div className="mt-1.5"><FormStrip form={lastN(B.ms, b.id, 5).map((m) => resultFor(m, b.id)).reverse()} /></div>
            </div>
          </div>
          <div className="mt-3"><CsvButton href={`/api/export?kind=compare&a=${a.id}&b=${b.id}`} label="Экспорт сравнения CSV" /></div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Результаты сезона">
            <StatBar label="Очки за матч" home={ppg(rA)} away={ppg(rB)} digits={2} />
            <StatBar label="Очки за матч дома" home={ppg(hA)} away={ppg(hB)} digits={2} />
            <StatBar label="Очки за матч в гостях" home={ppg(gA)} away={ppg(gB)} digits={2} />
            <StatBar label="Забито за матч" home={A.avg.gf} away={B.avg.gf} digits={2} />
            <StatBar label="Пропущено за матч" home={A.avg.ga} away={B.avg.ga} digits={2} lowerIsBetter />
          </Section>
          <Section title="Игровые показатели (последние 10)">
            <StatBar label="xG" home={A.avg.xg} away={B.avg.xg} digits={2} />
            <StatBar label="xG соперников" home={A.avg.xga} away={B.avg.xga} digits={2} lowerIsBetter />
            <StatBar label="Владение" home={A.avg.possession} away={B.avg.possession} suffix="%" />
            <StatBar label="Удары" home={A.avg.shots} away={B.avg.shots} />
            <StatBar label="В створ" home={A.avg.shotsOnTarget} away={B.avg.shotsOnTarget} />
            <StatBar label="Угловые" home={A.avg.corners} away={B.avg.corners} />
            <StatBar label="Жёлтые карточки" home={A.avg.yellow} away={B.avg.yellow} digits={2} lowerIsBetter />
          </Section>
        </div>
        <p className="text-xs text-muted">Полосы показывают соотношение значений; жирным выделено лучшее. Сравнение справочное и не является прогнозом.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Сравнение команд</h1>
      <form method="get" className="card grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-muted">
          Команда A
          <select name="a" className="input mt-1 w-full text-fg" defaultValue={a?.id ?? ''} required>
            <option value="" disabled>Выберите…</option>
            {options()}
          </select>
        </label>
        <label className="text-xs text-muted">
          Команда B
          <select name="b" className="input mt-1 w-full text-fg" defaultValue={b?.id ?? ''} required>
            <option value="" disabled>Выберите…</option>
            {options()}
          </select>
        </label>
        <div className="flex items-end"><button type="submit" className="btn btn-primary">Сравнить</button></div>
      </form>
      {body}
    </div>
  );
}
