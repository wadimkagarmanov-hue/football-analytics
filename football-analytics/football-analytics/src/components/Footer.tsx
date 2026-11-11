import Link from 'next/link';
import { HELPLINES } from '@/config/helplines';
import { OPERATOR_EMAIL, OPERATOR_NAME } from '@/lib/config';
import CookieSettingsButton from './CookieSettingsButton';

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-6 px-3 py-6 text-xs text-muted sm:px-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-fg">О сайте</p>
          <p>Сайт носит исключительно информационно-аналитический характер. Ставки здесь не принимаются.</p>
          <p className="font-medium text-fg">Сайт не гарантирует результат. Ставки связаны с риском потери денег.</p>
          <p>Материалы предназначены для лиц старше 18 лет (18+).</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-fg">Помощь при игровой зависимости</p>
          <ul className="space-y-1">
            {HELPLINES.map((h) => (
              <li key={h.url}>
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-fg">
                  {h.name}
                </a>{' '}
                — {h.region}
                {h.phone ? `, ${h.phone}` : ''}
              </li>
            ))}
          </ul>
          <p>
            <Link href="/responsible" className="underline hover:text-fg">
              Подробнее об ответственной игре
            </Link>
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-fg">Документы и контакты</p>
          <ul className="space-y-1">
            <li>
              <Link href="/privacy" className="underline hover:text-fg">
                Политика конфиденциальности
              </Link>
            </li>
            <li>
              <CookieSettingsButton />
            </li>
            <li>
              {OPERATOR_NAME} ·{' '}
              <a href={`mailto:${OPERATOR_EMAIL}`} className="underline hover:text-fg">
                {OPERATOR_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
