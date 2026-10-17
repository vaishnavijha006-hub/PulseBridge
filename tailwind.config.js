/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette
        navy: {
          DEFAULT: '#0B1220',
          50: '#E8EDF5',
          100: '#C7D2E3',
          200: '#9DADD0',
          300: '#6B81A8',
          400: '#3F5887',
          500: '#1E3766',
          600: '#142A52',
          700: '#0F2038',
          800: '#0B1220',
          900: '#060B14',
        },
        surface: {
          DEFAULT: '#111C2E',
          light: '#F5F7FA',
          card: '#FFFFFF',
          muted: '#EEF2F7',
          border: '#E2E8F0',
        },
        teal: {
          DEFAULT: '#14B8A6',
          50: '#E6FFFA',
          100: '#B2F5EA',
          200: '#81E6D9',
          300: '#4FD1C5',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        amber: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        success: {
          DEFAULT: '#22C55E',
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        danger: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        devanagari: ['Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-line': 'pulseLine 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        pulseLine: {
          '0%, 100%': { strokeDashoffset: '0' },
          '50%': { strokeDashoffset: '20' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.25' },
        },
      },
    },
  },
  plugins: [],
};
