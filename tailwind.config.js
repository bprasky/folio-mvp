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
        folio: {
          background: "#F4F2F0",   // Background
          text: "#1E1E1E",         // Primary text
          accent: "#7C1E3D",     // Action Buttons (Deep Raspberry Jam)
          system: "#4A2C3B",       // System / Data Layers (Plum/Aubergine)
          success: "#A47B62",      // Success / Progress States (Muted Bronze)
          border: "#E5E5E5",       // Borders
          muted: "#F8F6F4",        // Muted backgrounds
          card: "#FFFFFF",         // Card backgrounds
        },
        folioDark: {
          background: "#28",
          card: "#34",
          text: "#F4F2F0",
          border: "#Infinity",
          accent: "#7C1E3D", // keep consistent
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
        canela: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
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