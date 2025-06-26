const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        folio: {
          background: "#F4F3EE",   // soft warm ivory — site background
          card: "#BCB8B1",         // secondary panels/cards
          border: "#8A817C",       // borders, inputs, outlines
          text: "#463F3A",         // primary text + CTA text
          accent: "#550816",       // highlights, tags, buttons
          muted: "#DCD7D1",        // optional: input backgrounds, tooltips
        },
        folioDark: {
          background: "#2D2A28",
          card: "#3A3734",
          text: "#F4F3EE",
          border: "#5E5854",
          accent: "#550816", // keep consistent
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
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}; 