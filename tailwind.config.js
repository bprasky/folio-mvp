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
          // New design system tokens
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
          border: "var(--folio-border)",
          // Legacy tokens (backward compatibility)
          background: "#F4F2F0",
          text: "#1E1E1E",
          system: "#4A2C3B",
          success: "#A47B62",
          muted: "#F8F6F4",
          card: "#FFFFFF",
        },
        folioDark: {
          background: "#28",
          card: "#34",
          text: "#F4F2F0",
          border: "#Infinity",
          accent: "#7C1E3D",
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
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
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
      borderRadius: {
        xl: '1.25rem', 
        '2xl':'1.75rem',
        mdx: '10px', // updated for metrics
        xl: '14px', // updated for metrics
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      fontFamily: {
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
        canela: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        metrics: ['Inter','system-ui','sans-serif'],
        metricsDisplay: ['Space Grotesk','Inter','sans-serif'],
        metricsMono: ['IBM Plex Mono','ui-monospace','SFMono-Regular','monospace']
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