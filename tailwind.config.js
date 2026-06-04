/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bone: '#F4EFE6',
        ink: '#2E2A25',
        ochre: '#B5651D',
        rust: '#9B3D1E',
        sage: '#7F9B78',
        paper: '#FBF8F1',
        line: '#D8CDBD',
        teal: '#4E8F8A',
        fern: '#5D8A55',
        coral: '#C76C55',
        amber: '#D39B38',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hush: '0 18px 50px rgba(46, 42, 37, 0.08)',
      },
    },
  },
  plugins: [],
}
