/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm amber brand. A full scale so tints/hovers come from real stops
        // instead of alpha tricks. DEFAULT is dark enough to pass AA as text on
        // white; `dark`/`light` aliases keep pre-scale class names working.
        brand: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          DEFAULT: '#B45309',
          dark: '#92400E',
          light: '#D97706',
        },
        gold: '#FACC15',
        // Deep "trust" green — wordmark, footer, section eyebrows. Used
        // sparingly so the gold accents keep their pop.
        pine: {
          DEFAULT: '#166534',
          dark: '#14532D',
          deep: '#0C2E1C',
        },
        ink: '#1F2937',
        // Warm off-white page canvas (plain stone-50 reads cold and flat).
        canvas: '#FAF9F6',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: [
          'Plus Jakarta Sans Variable',
          'Plus Jakarta Sans',
          'Inter Variable',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Layered, warm-tinted elevation — borders stay nearly invisible and
        // depth does the separating.
        card: '0 1px 2px rgb(28 25 23 / 0.04), 0 4px 12px rgb(28 25 23 / 0.06)',
        'card-hover': '0 4px 8px rgb(28 25 23 / 0.06), 0 16px 32px rgb(28 25 23 / 0.12)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-up': 'slide-up 0.4s ease-out both',
        'pulse-soft': 'pulse-soft 1.5s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
