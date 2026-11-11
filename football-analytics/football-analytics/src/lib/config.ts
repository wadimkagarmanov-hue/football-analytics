export const TZ = process.env.NEXT_PUBLIC_DISPLAY_TZ || 'Europe/Moscow';
export const LIVE_POLL_MS = Number(process.env.NEXT_PUBLIC_LIVE_POLL_MS || 30000);

/** Время жизни кэша по типам данных, мс */
export const TTL = {
  static: 24 * 3600e3, // лиги, команды
  squad: 6 * 3600e3,
  matches: 5 * 60e3,
  matchLive: 60e3,
  standings: 10 * 60e3,
  odds: 30e3,
  lineups: 2 * 60e3,
  absences: 10 * 60e3,
  finishedStats: 24 * 3600e3,
} as const;

export const OPERATOR_NAME = process.env.OPERATOR_NAME || 'Название организации';
export const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || 'contact@example.com';
