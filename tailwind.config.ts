import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crimson: 'var(--color-crimson)',
        'crimson-hover': 'var(--color-crimson-hover)',
        navy: {
          DEFAULT: 'var(--color-navy)',
          mid: 'var(--color-navy-mid)',
          light: 'var(--color-navy-light)',
        },
        gold: 'var(--color-gold)',
        'gold-hover': 'var(--color-gold-hover)',
        glass: {
          bg: 'var(--glass-bg)',
          border: 'var(--glass-border)',
          'border-bright': 'var(--glass-border-bright)',
        },
        text: {
          DEFAULT: 'var(--text-main)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        status: {
          green: 'var(--color-green)',
          amber: 'var(--color-amber)',
          blue: 'var(--color-blue)',
          purple: 'var(--color-purple)',
          teal: 'var(--color-teal)',
          red: 'var(--color-red)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        glass: '20px',
      },
      backdropBlur: {
        glass: '28px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-light': '0 4px 16px rgba(15, 23, 42, 0.08)',
      },
      spacing: {
        sidebar: '260px',
        topbar: '64px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
