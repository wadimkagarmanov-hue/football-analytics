import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        panel: c('panel'),
        panel2: c('panel2'),
        line: c('line'),
        fg: c('fg'),
        muted: c('muted'),
        up: c('up'),
        down: c('down'),
        accent: c('accent'),
        best: c('best'),
      },
      fontSize: { xs: ['0.75rem', '1rem'], sm: ['0.8125rem', '1.125rem'] },
    },
  },
  plugins: [],
} satisfies Config;
