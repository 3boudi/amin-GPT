/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: "#fdfbf7",
        pencil: "#2d2d2d",
        muted: "#e5e0d8",
        accent: "#ff4d4d",
        secondary: "#2d5da1",
        postit: "#fff9c4",
      },
      fontFamily: {
        heading: ['Kalam', 'cursive'],
        body: ['Patrick Hand', 'cursive'],
      },
      boxShadow: {
        'hand-drawn': '4px 4px 0px 0px #2d2d2d',
        'hand-drawn-hover': '2px 2px 0px 0px #2d2d2d',
        'hand-drawn-heavy': '8px 8px 0px 0px #2d2d2d',
      },
    },
  },
  plugins: [],
}
