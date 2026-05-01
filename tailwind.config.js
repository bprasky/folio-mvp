const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ========================================
        // CANONICAL FOLIO SURFACE PALETTE
        // ========================================
        surface: {
          canvas: 'var(--surface-canvas)',     // Level 0 — page bg, nav
          ground: 'var(--surface-ground)',     // Level 1 — filter bars, tabs
          elevated: 'var(--surface-elevated)', // Level 2 — card base
        },

        // ========================================
        // FOLIO NEUMORPHIC DESIGN SYSTEM
        // ========================================

        // Base colors
        'neu-base': 'var(--bg-base)',
        'neu-elevated': 'var(--bg-elevated)',

        // Text colors
        'neu-text': {
          DEFAULT: 'var(--text-primary)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },

        // Accent color
        'neu-accent': {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },

        // Shadow colors
        'neu-shadow': {
          dark: 'var(--shadow-dark)',
          light: 'var(--shadow-light)',
        },

        // Ridge border colors
        'neu-ridge': {
          outer: 'var(--ridge-outer)',
          inner: 'var(--ridge-inner)',
          dark: 'var(--ridge-dark)',
        },

        // ========================================
        // LEGACY COLORS (backward compatibility)
        // ========================================

        // warm neutrals (from brand book)
        canvas:  { DEFAULT:'#F5F3EF',  100:'#FAF9F7' },
        stone:   { DEFAULT:'#DAD4CC',  700:'#8F8A84' },
        ink:     { DEFAULT:'#1B1B1A',  600:'#2A2A28' },
        // accent categories
        accent: {
          engage:'#00B89E',   // emerald – engagement (desaturated)
          perf:'#18B8F0',     // cyan – performance (desaturated)
          opp:'#FFC353',     // amber – opportunity (desaturated)
          risk:'#EF6A6A',     // rose – leaks/risks (desaturated)
          slate:'#6FA3EF'     // slate-blue highlight
        },
        // === Folio Metrics (brand-adjacent) ===
        metrics: {
          bg: '#161616',        // background (softened)
          surface: '#232323',   // cards/surfaces (softened)
          surface2: '#1E1E1E',  // deep panels
          text: '#E6E2DA',      // primary text/icons (warmer)
          text2: '#BEB7AA',     // secondary (warmer)
          line: 'rgba(255,255,255,0.06)' // grid lines
        },
        folio: {
          // === CANONICAL TOKENS ===
          gold: 'var(--folio-gold)',
          'gold-hover': 'var(--folio-gold-hover)',
          'gold-ornament': 'var(--folio-gold-ornament)',
          text: {
            primary: 'var(--folio-text-primary)',
            secondary: 'var(--folio-text-secondary)',
            tertiary: 'var(--folio-text-tertiary)',
          },
          border: {
            DEFAULT: "var(--folio-border)",
            subtle: 'var(--folio-border-subtle)',
            strong: 'var(--folio-border-strong)',
          },
          // === LEGACY TOKENS (backward compat) ===
          bg: "var(--folio-bg)",
          surface: "var(--folio-surface)",
          ink: "var(--folio-ink)",
          stone: {
            100: "var(--folio-stone-100)",
            300: "var(--folio-stone-300)",
            500: "var(--folio-stone-500)",
            700: "var(--folio-stone-700)",
          },
          accent: {
            200: "var(--folio-accent-200)",
            400: "var(--folio-accent-400)",
            700: "var(--folio-accent-700)",
          },
          background: "#F4F2F0",
          textLegacy: "#1E1E1E",
          system: "#4A2C3B",
          success: "#A47B62",
          muted: "#F8F6F4",
          card: "#FFFFFF",
        },
        // DEPRECATED — folioDark theme is broken (see #28/#Infinity placeholders);
        // Task 09 removes this block entirely.
        folioDark: {
          background: "#28",
          card: "#34",
          text: "#F4F2F0",
          border: "#Infinity",
          accent: "var(--folio-gold)",
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl':'1.75rem',
        mdx: '10px',
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        // Neumorphic specific
        'neu': '16px',
        'neu-sm': '12px',
        'neu-lg': '20px',
        'neu-btn': '10px',
        'neu-pill': '50px',
      },
      boxShadow: {
        // Neumorphic shadows
        'neu-raised': 'var(--neu-raised)',
        'neu-raised-lg': 'var(--neu-raised-lg)',
        'neu-inset': 'var(--neu-inset)',
        'neu-inset-sm': 'var(--neu-inset-sm)',
        // Legacy shadows
        card: '0 10px 28px rgba(0,0,0,.14)',
        metrics: '0 12px 32px rgba(0,0,0,.35)',
        ring: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px rgba(0,0,0,0.18)',
        folio1: "var(--shadow-1)",
        folio2: "var(--shadow-2)",
        folio3: "var(--shadow-3)",
      },
      backdropBlur: {
        xl: '16px',
        md: '8px'
      },
      fontFamily: {
        // Folio Design System typography
        headline: 'var(--font-headline)',
        body: 'var(--font-body)',
        logo: 'var(--font-logo)',
        // Legacy fonts
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
        canela: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        metrics: ['Inter','system-ui','sans-serif'],
        metricsDisplay: ['Space Grotesk','Inter','sans-serif'],
        metricsMono: ['IBM Plex Mono','ui-monospace','SFMono-Regular','monospace']
      },
      fontSize: {
        // Folio Design System typography scale
        'folio-h1': ['48px', { lineHeight: '1.1', fontWeight: '500' }],
        'folio-h2': ['36px', { lineHeight: '1.15', fontWeight: '500' }],
        'folio-h3': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
        'folio-quote': ['24px', { lineHeight: '1.4', fontWeight: '400', fontStyle: 'italic' }],
        'folio-body': ['15px', { lineHeight: '1.6', fontWeight: '400' }],
        'folio-ui': ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        'folio-meta': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'folio-stat': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'folio-stat-lg': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'folio-logo': ['22px', { lineHeight: '1', fontWeight: '500', letterSpacing: '0.18em', textTransform: 'uppercase' }],
      },
      maxWidth: {
        metrics: '1440px'
      },
      transitionTimingFunction: {
        folio: "var(--ease)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        med: "var(--dur-med)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  darkMode: 'class',
  safelist: [
    { pattern: /col-span-(1|2|3|4|5|6)/ }
  ],
  plugins: [],
}; 