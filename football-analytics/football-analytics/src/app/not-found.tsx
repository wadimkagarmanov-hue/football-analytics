import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="kpi">404</p>
      <p className="mt-2 text-sm text-muted">Страница не найдена.</p>
      <Link href="/" className="btn btn-primary mt-4">
        К матчам
      </Link>
    </div>
  );
}
