/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: { 950: '#05070c', 900: '#0a0e17', 850: '#0e1420', 800: '#131a29', 700: '#1c2638', 600: '#283449' },
        atwater: { DEFAULT: '#f59e0b', soft: '#fbbf24' },
        nme: { DEFAULT: '#22d3ee', soft: '#67e8f9' },
        fuel: { DEFAULT: '#a3e635', soft: '#bef264' },
        plastic: { DEFAULT: '#c084fc', soft: '#d8b4fe' },
        loss: { DEFAULT: '#f43f5e', soft: '#fb7185' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.15), 0 8px 30px -12px rgba(34,211,238,0.25)',
      },
    },
  },
  plugins: [],
};
