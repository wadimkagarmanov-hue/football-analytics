import { HELPLINES } from '@/config/helplines';

export const metadata = { title: 'Ответственная игра' };

export default function ResponsiblePage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-4 p-4 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">Ответственная игра</h1>
      <p>
        Этот сайт — аналитический справочник. Он <b>не принимает ставки</b> и не гарантирует результат. Коэффициенты и статистика не
        являются прогнозом или советом делать ставки. Ставки связаны с риском потери денег. Материалы предназначены только для лиц старше 18 лет.
      </p>
      <h2 className="text-base font-semibold">Правила, которые помогают сохранять контроль</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Ставьте только те деньги, которые готовы потерять без ущерба для себя и семьи.</li>
        <li>Заранее определите лимит времени и суммы и не превышайте его.</li>
        <li>Не пытайтесь отыграться после проигрыша и не занимайте деньги для ставок.</li>
        <li>Не ставьте в состоянии стресса, усталости или под воздействием алкоголя.</li>
      </ul>
      <h2 className="text-base font-semibold">Признаки, что пора остановиться и обратиться за помощью</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Мысли об играх занимают большую часть времени.</li>
        <li>Приходится увеличивать суммы, чтобы получить прежние эмоции.</li>
        <li>Вы скрываете ставки от близких или занимаете деньги.</li>
        <li>Попытки сократить игру не удаются.</li>
      </ul>
      <h2 className="text-base font-semibold">Где получить помощь</h2>
      <ul className="space-y-1">
        {HELPLINES.map((h) => (
          <li key={h.url}>
            <a href={h.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
              {h.name}
            </a>{' '}
            <span className="text-muted">
              — {h.region}
              {h.phone ? `, тел. ${h.phone}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Если вы находитесь в другой стране, обратитесь в местную службу помощи при игровой зависимости или к врачу.
      </p>
    </article>
  );
}
