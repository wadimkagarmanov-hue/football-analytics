'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import FavoriteButton, { type FavKind } from './FavoriteButton';

// Таблица с сортировкой по клику на заголовок. Данные — только сериализуемые
// (сервер → клиент), поэтому ячейки описываются объектами, а не функциями.

export interface Cell {
  text: string;
  sort?: number | string;
  href?: string;
  tone?: 'up' | 'down' | 'best' | 'muted' | 'strong';
  fav?: { kind: FavKind; id: string };
}
export interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}
export interface Row {
  id: string;
  cells: Record<string, Cell>;
}

const TONE: Record<NonNullable<Cell['tone']>, string> = {
  up: 'text-up font-semibold',
  down: 'text-down font-semibold',
  best: 'bg-best/25 font-bold',
  muted: 'text-muted',
  strong: 'font-semibold',
};
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export default function SortableTable({
  cols,
  rows,
  initialSort,
  empty = 'Нет данных',
}: {
  cols: Col[];
  rows: Row[];
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const val = (r: Row) => r.cells[sort.key]?.sort ?? r.cells[sort.key]?.text ?? '';
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru', { numeric: true });
      return sort.dir === 'asc' ? c : -c;
    });
  }, [rows, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  if (!rows.length) return <p className="px-3 py-6 text-center text-sm text-muted">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  className={ALIGN[c.align ?? 'left']}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-fg">
                      {c.label}
                      <span className={active ? 'text-accent' : 'opacity-30'}>{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              {cols.map((c) => {
                const cell = r.cells[c.key];
                if (!cell) return <td key={c.key} />;
                const inner = cell.fav ? (
                  <FavoriteButton kind={cell.fav.kind} id={cell.fav.id} />
                ) : cell.href ? (
                  <Link href={cell.href} className="hover:text-accent hover:underline">
                    {cell.text}
                  </Link>
                ) : (
                  cell.text
                );
                return (
                  <td key={c.key} className={`${ALIGN[c.align ?? 'left']} ${cell.tone ? TONE[cell.tone] : ''}`}>
                    {inner}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
