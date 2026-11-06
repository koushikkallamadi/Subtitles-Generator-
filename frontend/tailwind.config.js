// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#B8501F',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-soft': 'var(--accent-soft)',
        highlight: 'var(--highlight)',
        dark: 'var(--dark)',
      },
      fontFamily: {
        display: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        marketing: ['var(--font-inter)', 'Inter', 'sans-serif'],
        telugu: ['var(--font-noto-telugu)', 'Noto Sans Telugu', 'sans-serif'],
        devanagari: ['var(--font-noto-devanagari)', 'Noto Sans Devanagari', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
