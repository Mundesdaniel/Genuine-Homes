/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand greens + gold accent (shared with the stage decks).
        brand: { DEFAULT: '#2D6A4F', dark: '#14532D', light: '#40916C' },
        gold: '#E9A23B',
        ink: '#1F2937',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
