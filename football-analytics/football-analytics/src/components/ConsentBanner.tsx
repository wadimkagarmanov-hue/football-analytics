'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Сейчас сайт использует только необходимое хранилище (тема, избранное, выбор по cookie).
// Если добавите аналитику/рекламные скрипты — запускайте их только при consent.analytics === true.

export interface Consent {
  necessary: true;
  analytics: boolean;
  ts: string;
}

export function readConsent(): Consent | null {
  try {
    return JSON.parse(localStorage.getItem('consent') || 'null');
  } catch {
    return null;
  }
}

export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = readConsent();
    if (!c) setOpen(true);
    else setAnalytics(c.analytics);
    const reopen = () => setOpen(true);
    window.addEventListener('open-consent', reopen);
    return () => window.removeEventListener('open-consent', reopen);
  }, []);

  const save = (a: boolean) => {
    const c: Consent = { necessary: true, analytics: a, ts: new Date().toISOString() };
    try {
      localStorage.setItem('consent', JSON.stringify(c));
    } catch {
      /* без хранилища выбор действует до перезагрузки */
    }
    document.cookie = `consent=${a ? 'all' : 'necessary'}; Max-Age=31536000; Path=/; SameSite=Lax`;
    setAnalytics(a);
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Согласие на использование cookie" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel p-3 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p>
            Мы используем cookie и локальное хранилище браузера: необходимые (тема, избранное, ваш выбор) работают всегда; аналитические — только с вашего согласия.{' '}
            <Link href="/privacy" className="underline">
              Политика конфиденциальности
            </Link>
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            Разрешить аналитические cookie
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => save(false)}>
            Только необходимые
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save(analytics)}>
            Сохранить выбор
          </button>
        </div>
      </div>
    </div>
  );
}
