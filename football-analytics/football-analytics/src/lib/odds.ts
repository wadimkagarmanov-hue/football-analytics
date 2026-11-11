import type { Market, OddsQuote } from './types';

export const MARKET_LABEL: Record<Market, string> = {
  '1X2': '1X2',
  TOTAL: 'Тотал',
  BTTS: 'Обе забьют',
  HANDICAP: 'Форы',
};

export const SELECTIONS: Record<Market, string[]> = {
  '1X2': ['1', 'X', '2'],
  TOTAL: ['Over', 'Under'],
  BTTS: ['Yes', 'No'],
  HANDICAP: ['Home', 'Away'],
};

export const SELECTION_LABEL: Record<string, string> = {
  '1': 'П1',
  X: 'Х',
  '2': 'П2',
  Over: 'Больше',
  Under: 'Меньше',
  Yes: 'Да',
  No: 'Нет',
  Home: 'Хозяева',
  Away: 'Гости',
};

/** Подразумеваемая вероятность из десятичного коэффициента (с маржой букмекера). */
export const impliedProb = (price: number) => (price > 0 ? 1 / price : 0);

/** Маржа букмекера по полной группе исходов: сумма 1/k − 1. */
export const bookmakerMargin = (prices: number[]) => prices.reduce((s, p) => s + 1 / p, 0) - 1;

/** «Честные» вероятности: подразумеваемые, нормированные на 1 (маржа распределена пропорционально). */
export function fairProbs(prices: number[]): number[] {
  const total = prices.reduce((s, p) => s + 1 / p, 0);
  return prices.map((p) => 1 / p / total);
}

export function calcFromOdds(prices: number[]) {
  const implied = prices.map(impliedProb);
  const margin = bookmakerMargin(prices);
  const fair = fairProbs(prices);
  return { implied, margin, fair, fairOdds: fair.map((f) => 1 / f) };
}

export const lineKey = (q: Pick<OddsQuote, 'market' | 'line'>) => `${q.market}|${q.line ?? ''}`;

/** Группы рынков: 1X2, тотал по каждой линии, обе забьют, форы по каждой линии. */
export function groupByMarket(quotes: OddsQuote[]): Map<string, OddsQuote[]> {
  const m = new Map<string, OddsQuote[]>();
  for (const q of quotes) {
    const k = lineKey(q);
    const arr = m.get(k);
    if (arr) arr.push(q);
    else m.set(k, [q]);
  }
  return m;
}

/** Лучшая цена по каждому исходу. */
export function bestBySelection(quotes: OddsQuote[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const q of quotes) if (!best[q.selection] || q.price > best[q.selection]) best[q.selection] = q.price;
  return best;
}

/** Изменение цены относительно первой точки истории. */
export function movement(q: OddsQuote): { delta: number; dir: 'up' | 'down' | 'flat' } {
  const first = q.history[0]?.p ?? q.price;
  const delta = Math.round((q.price - first) * 100) / 100;
  return { delta, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

/** Маржа конкретного букмекера внутри группы рынка (нужны все исходы). */
export function marginForBookmaker(group: OddsQuote[], bookmaker: string, market: Market): number | null {
  const sels = SELECTIONS[market];
  const prices = sels.map((s) => group.find((q) => q.bookmaker === bookmaker && q.selection === s)?.price);
  if (prices.some((p) => p == null)) return null;
  return bookmakerMargin(prices as number[]);
}
