// Доменные типы. Интерфейс сайта работает только с ними — не с форматами конкретных провайдеров.

export type Market = '1X2' | 'TOTAL' | 'BTTS' | 'HANDICAP';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface League {
  id: string;
  name: string;
  country: string;
  season: string;
}

export interface Team {
  id: string;
  leagueId: string;
  name: string;
  short: string;
  country: string;
  coach: string;
  stadium: string;
}

export interface Match {
  id: string;
  leagueId: string;
  round: number;
  kickoff: string; // ISO UTC
  homeId: string;
  awayId: string;
  status: MatchStatus;
  score?: { home: number; away: number };
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  position: Position;
  number: number;
  age: number;
  nationality: string;
  stats: { apps: number; minutes: number; goals: number; assists: number; yellow: number; red: number };
}

export interface PlayerAppearance {
  matchId: string;
  kickoff: string;
  opponentId: string;
  isHome: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
}

export interface Absence {
  playerId: string;
  playerName: string;
  teamId: string;
  reason: 'injury' | 'suspension';
  detail: string;
}

export interface LineupPlayer {
  id: string;
  name: string;
  number?: number;
  pos?: Position;
}

export interface Lineup {
  teamId: string;
  formation: string;
  confirmed: boolean; // false = вероятный состав
  startXI: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface OddsQuote {
  bookmaker: string;
  market: Market;
  selection: string; // 1|X|2, Over|Under, Yes|No, Home|Away
  line?: number; // тотал; для форы — линия хозяев
  price: number; // десятичный коэффициент
  updatedAt: string;
  history: { t: string; p: number }[];
}

export interface TeamMatchStats {
  xg: number | null;
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  yellow: number | null;
  red: number | null;
}

export interface MatchStats {
  home: TeamMatchStats;
  away: TeamMatchStats;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}
