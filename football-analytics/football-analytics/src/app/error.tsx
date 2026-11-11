'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <p className="text-base font-semibold">Не удалось загрузить данные</p>
      <p className="mt-2 text-sm text-muted">
        Возможно, исчерпан лимит запросов к провайдеру данных или он временно недоступен. {process.env.NODE_ENV !== 'production' ? error.message : ''}
      </p>
      <button className="btn btn-primary mt-4" onClick={reset}>
        Повторить
      </button>
    </div>
  );
}
