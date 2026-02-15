/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0D0221',
        foreground: '#FFFFFF',
        primary: {
          DEFAULT: '#7B2CBF',
          hover: '#9D4EDD',
        },
        secondary: '#C0C0C0',
        accent: '#E0AAFF',
        success: '#00FF88',
        warning: '#FFAA00',
        error: '#FF3333',
        card: 'rgba(123, 44, 191, 0.1)',
        border: 'rgba(192, 192, 192, 0.2)',
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
