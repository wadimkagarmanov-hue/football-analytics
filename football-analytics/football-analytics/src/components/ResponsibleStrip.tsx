import Link from 'next/link';

/** Показывается на каждой странице под шапкой. */
export default function ResponsibleStrip() {
  return (
    <div className="border-b border-line bg-panel2 px-3 py-1.5 text-center text-xs text-muted">
      <strong className="text-fg">18+</strong> · Сайт не гарантирует результат. Ставки связаны с риском потери денег. Играйте ответственно.{' '}
      <Link href="/responsible" className="underline hover:text-fg">
        Помощь при игровой зависимости
      </Link>
    </div>
  );
}
