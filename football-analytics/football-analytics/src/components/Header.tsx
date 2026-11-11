import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { href: '/', label: 'Матчи' },
  { href: '/leagues', label: 'Лиги' },
  { href: '/compare', label: 'Сравнение' },
  { href: '/favorites', label: 'Избранное' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-4">
        <Link href="/" className="shrink-0 text-base font-bold tracking-tight">
          Футбол<span className="text-accent">·</span>Аналитика
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Разделы">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-panel2 hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
        <span
          className="shrink-0 rounded-full border-2 border-down px-2 py-0.5 text-xs font-bold text-down"
          title="Материалы предназначены для лиц старше 18 лет"
          aria-label="Возрастное ограничение 18+"
        >
          18+
        </span>
      </div>
    </header>
  );
}
