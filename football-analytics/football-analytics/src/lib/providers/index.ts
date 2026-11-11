// Единственное место, где выбирается конкретный провайдер. Чтобы добавить нового —
// реализуйте интерфейс из ./types и добавьте строку в соответствующий switch.

import { apiFootball } from './apifootball';
import { mockFootball, mockOdds } from './mock';
import { theOddsApi } from './theoddsapi';
import type { FootballProvider, OddsProvider } from './types';

export function footballProvider(): FootballProvider {
  switch (process.env.FOOTBALL_PROVIDER || 'mock') {
    case 'apifootball':
      return apiFootball;
    case 'mock':
      return mockFootball;
    default:
      throw new Error(`Unknown FOOTBALL_PROVIDER "${process.env.FOOTBALL_PROVIDER}"`);
  }
}

export function oddsProvider(): OddsProvider {
  switch (process.env.ODDS_PROVIDER || 'mock') {
    case 'theoddsapi':
      return theOddsApi;
    case 'mock':
      return mockOdds;
    default:
      throw new Error(`Unknown ODDS_PROVIDER "${process.env.ODDS_PROVIDER}"`);
  }
}

export const isDemo = () => (process.env.FOOTBALL_PROVIDER || 'mock') === 'mock' || (process.env.ODDS_PROVIDER || 'mock') === 'mock';
