'use client';

import { useEffect, useState } from 'react';

export type FavKind = 'match' | 'team';
const KEY = (k: FavKind) => `fav:${k}`;

export function readFavs(kind: FavKind): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(kind)) || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function writeFavs(kind: FavKind, ids: string[]) {
  try {
    localStorage.setItem(KEY(kind), JSON.stringify(ids));
  } catch {
    /* хранилище недоступно */
  }
  window.dispatchEvent(new Event('fav-change'));
}

export default function FavoriteButton({ kind, id, withLabel = false }: { kind: FavKind; id: string; withLabel?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(readFavs(kind).includes(id));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('fav-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fav-change', sync);
    };
  }, [kind, id]);

  const toggle = () => {
    const cur = readFavs(kind);
    writeFavs(kind, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Убрать из избранного' : 'Добавить в избранное'}
      title={on ? 'Убрать из избранного' : 'Добавить в избранное'}
      className={withLabel ? 'btn' : 'rounded px-1 text-base leading-none hover:bg-panel2'}
    >
      <span className={on ? 'text-best' : 'text-muted'}>{on ? '★' : '☆'}</span>
      {withLabel && <span>{on ? 'В избранном' : 'В избранное'}</span>}
    </button>
  );
}
