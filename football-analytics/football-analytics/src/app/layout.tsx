import type { Metadata, Viewport } from 'next';
import './globals.css';
import ConsentBanner from '@/components/ConsentBanner';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ResponsibleStrip from '@/components/ResponsibleStrip';
import { isDemo } from '@/lib/providers';

export const metadata: Metadata = {
  title: { default: 'Футбольная аналитика', template: '%s · Футбольная аналитика' },
  description: 'Коэффициенты, составы и статистика футбольных матчей. Только аналитика — ставки на сайте не принимаются. 18+',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <Header />
        <ResponsibleStrip />
        {isDemo() && (
          <div className="border-b border-line bg-panel2 px-3 py-1 text-center text-xs text-muted">
            Демо-режим: данные вымышленные (команды, игроки и коэффициенты сгенерированы). Подключите провайдеров в .env — см. README.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">{children}</main>
        <Footer />
        <ConsentBanner />
      </body>
    </html>
  );
}
