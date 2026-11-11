// Контракты провайдеров. Чтобы подключить другого поставщика данных, достаточно
// реализовать один из этих интерфейсов и зарегистрировать его в providers/index.ts —
// страницы, кэш и воркер используют только эти типы.

import type {
  Absence,
  League,
  Lineup,
  Match,
  MatchStats,
  OddsQuote,
  Player,
  PlayerAppearance,
  StandingRow,
  Team,
} from '../types';

export interface MatchQuery {
  from?: string; // ISO
  to?: string; // ISO
  leagueId?: string;
  teamId?: string;
}

export interface FootballProvider {
  /** Имя — ключ для лимитера и метка «источник». */
  readonly name: string;
  listLeagues(): Promise<League[]>;
  listTeams(leagueId: string): Promise<Team[]>;
  listMatches(q: MatchQuery): Promise<Match[]>;
  getMatch(id: string): Promise<Match | null>;
  getSquad(teamId: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | null>;
  getPlayerAppearances(playerId: string, limit: number): Promise<PlayerAppearance[]>;
  getStandings(leagueId: string): Promise<StandingRow[]>;
  /** Необязательно: если в списке команд тренер не указан, имя берётся отсюда. */
  getCoach?(teamId: string): Promise<string | null>;
  /** Если провайдер не знает составов — вернуть null (confirmed=false допустим для «вероятного» состава). */
  getLineups(matchId: string): Promise<{ home: Lineup | null; away: Lineup | null }>;
  getAbsences(teamId: string): Promise<Absence[]>;
  /** Статистика матча (xG, владение, удары...). null, если ещё нет. */
  getMatchStats(matchId: string): Promise<MatchStats | null>;
}

export interface OddsProvider {
  readonly name: string;
  /** Все коэффициенты по матчу от разных букмекеров. history может быть пустой — её накапливает воркер. */
  getOdds(match: Match, home: Team, away: Team): Promise<OddsQuote[]>;
}
