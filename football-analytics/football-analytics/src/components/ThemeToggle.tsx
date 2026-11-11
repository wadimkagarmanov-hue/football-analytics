'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* хранилище недоступно — тема действует до перезагрузки */
    }
  };
  return (
    <button type="button" onClick={toggle} className="btn" aria-label="Переключить тему" title="Переключить тему">
      {dark ? '☀' : '☾'}
    </button>
  );
}
