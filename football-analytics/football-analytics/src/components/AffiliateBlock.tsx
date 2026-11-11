import { affiliatesForUser } from '@/lib/affiliates';

/** Партнёрские ссылки: только лицензированные в регионе пользователя, с пометкой «Реклама». */
export default async function AffiliateBlock() {
  const list = await affiliatesForUser();
  if (!list.length) return null;
  return (
    <section className="card p-3 text-sm" aria-label="Реклама">
      <p className="mb-2 flex items-center gap-2">
        <span className="chip bg-panel2 text-muted">Реклама</span>
        <span className="text-xs text-muted">18+ · Партнёрские ссылки. Ставки связаны с риском потери денег.</span>
      </p>
      <ul className="space-y-1">
        {list.map((a) => (
          <li key={a.url}>
            <a href={a.url} target="_blank" rel="sponsored nofollow noopener noreferrer" className="underline hover:text-accent">
              {a.name}
            </a>{' '}
            <span className="text-xs text-muted">· {a.license}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
