/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'monet-blue': '#a3c1ad',
        'monet-cream': '#f5f5f5',
        'monet-green': '#b3c9a2',
        'monet-grey': '#e0e0e0',
      },
    },
  },
  plugins: [],
} 