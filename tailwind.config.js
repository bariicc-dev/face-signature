/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f0d0c',
        ink2: '#171413',
        ink3: '#221d1b',
        cream: '#f5ede0',
        creamSoft: '#e8dccb',
        gold: '#c9a572',
        goldSoft: '#d9b888',
        rose: '#e9c4c0',
        mute: '#8a7e72',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
    },
  },
  plugins: [],
};
