/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fbf9f1',
          100: '#f5f0de',
          200: '#ebdcb7',
          300: '#dfc28b',
          400: '#d3a863',
          500: '#ca9145',
          600: '#b87737',
          700: '#99592f',
          800: '#7c462b',
          900: '#653a25',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
