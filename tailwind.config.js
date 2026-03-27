/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          orange: '#f97316',
          black: '#111111',
          brown: '#4a3728',
          beige: '#faf9f6',
          sand: '#f2ece0',
          cream: '#ffffff',
        }
      }
    }
  },
  plugins: [],
}
