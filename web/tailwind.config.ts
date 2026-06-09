import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        heading: ['Poppins', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: '#0D9488',
        secondary: '#0F766E',
        accent: '#065F56',
      },
    },
  },
  plugins: [],
} satisfies Config;
