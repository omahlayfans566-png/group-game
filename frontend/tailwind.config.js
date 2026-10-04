/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep blacks and grays — the arena
        arena: {
          950: '#030304',
          900: '#08080f',
          800: '#0f0f1a',
          700: '#161625',
          600: '#1e1e30',
          500: '#26263c',
        },
        // Blood red — danger, elimination
        danger: {
          900: '#4a0000',
          800: '#7f0000',
          700: '#a80000',
          600: '#cc0000',
          500: '#e63333',
          400: '#ff5555',
        },
        // Electric amber — active, competition
        amber: {
          900: '#451a00',
          800: '#7a2e00',
          700: '#b34500',
          600: '#cc5500',
          500: '#e06600',
          400: '#f97316',
          300: '#fb923c',
        },
        // Cold cyan — intelligence, system
        cyber: {
          900: '#001a1a',
          800: '#003333',
          700: '#004d4d',
          600: '#006666',
          500: '#008080',
          400: '#00b3b3',
          300: '#00e5e5',
        },
        // Gold — winner, finalist
        gold: {
          600: '#a37700',
          500: '#c9920a',
          400: '#e6b020',
          300: '#f5c842',
          200: '#fcd966',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Impact"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 3s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'count-down': 'countdown 1s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,229,229,0.3), 0 0 10px rgba(0,229,229,0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(0,229,229,0.6), 0 0 40px rgba(0,229,229,0.2)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        countdown: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300b3b3' fill-opacity='0.04'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
