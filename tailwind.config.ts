import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tailwind config alignée sur le Design System "Stade moderne v2".
 *
 * Les couleurs utilisent les variables HSL définies dans
 * `src/styles/globals.css` pour rester theme-able (light/dark) sans
 * dupliquer les valeurs ici.
 *
 * Convention : `hsl(var(--xxx))` pour pouvoir combiner avec `/opacity`
 * (ex : `bg-primary/50`) — c'est la syntaxe standard shadcn.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: 'hsl(var(--primary-50))',
          100: 'hsl(var(--primary-100))',
          200: 'hsl(var(--primary-200))',
          300: 'hsl(var(--primary-300))',
          400: 'hsl(var(--primary-400))',
          500: 'hsl(var(--primary-500))',
          600: 'hsl(var(--primary-600))',
          700: 'hsl(var(--primary-700))',
          800: 'hsl(var(--primary-800))',
          900: 'hsl(var(--primary-900))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          50: 'hsl(var(--accent-50))',
          100: 'hsl(var(--accent-100))',
          200: 'hsl(var(--accent-200))',
          300: 'hsl(var(--accent-300))',
          400: 'hsl(var(--accent-400))',
          500: 'hsl(var(--accent-500))',
          600: 'hsl(var(--accent-600))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        /* Sémantiques matchs / scoring */
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },

        /* Podium (classement) — usage : bg-podium-gold, text-podium-gold */
        podium: {
          gold: 'hsl(var(--podium-gold))',
          silver: 'hsl(var(--podium-silver))',
          bronze: 'hsl(var(--podium-bronze))',
        },
      },
      borderRadius: {
        /* Mapping aligné sur les tokens CSS. Note : `--radius` est passé
         * de 8px à 12px dans cette release — tous les composants shadcn
         * qui utilisent `rounded-lg/md/sm` bougent en cohérence. */
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'var(--radius-lg)' /* 16px — modales, sheets */,
        '2xl': 'var(--radius-xl)' /* 24px — bottom-sheets, tiles */,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        /* Override des shadcn defaults pour aligner sur la palette
         * "Stade moderne" (tintée hue 226, pas gris neutre). */
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        primary: 'var(--shadow-primary)',
        accent: 'var(--shadow-accent)',
        'inner-pressed': 'var(--shadow-inner-pressed)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        celebration: 'var(--duration-celebration)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emphasis: 'var(--ease-emphasis)',
        bounce: 'var(--ease-bounce)',
        celebration: 'var(--ease-celebration)',
      },
      height: {
        /* Hauteurs tactiles minimums (≥ 44px mobile) */
        touch: 'var(--touch-target)',
        topbar: 'var(--topbar-height)',
        tabbar: 'var(--tabbar-height)',
      },
      minHeight: {
        touch: 'var(--touch-target)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
