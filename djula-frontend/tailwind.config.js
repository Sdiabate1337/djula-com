d/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        djula: {
          orange: '#FF8A2B',
          'orange-dark': '#FF6B00',
          primary: '#075E54',
          secondary: '#128C7E',
          gray: {
            50: '#F2F8F7',
            100: '#E9EDF0',
            400: '#8896A6',
            700: '#324756'
          }
        }
      },
      backgroundImage: {
        'gradient-djula': 'linear-gradient(135deg, #FF8A2B, #FF6B00)',
        'gradient-djula-soft': 'linear-gradient(135deg, rgba(255,138,43,0.1), rgba(255,107,0,0.1))',
      },
      boxShadow: {
        djula: '0 4px 12px rgba(255, 138, 43, 0.15)',
        'djula-dark': '0 6px 16px rgba(7, 94, 84, 0.15)'
      }
    }
  },
  plugins: [],
}