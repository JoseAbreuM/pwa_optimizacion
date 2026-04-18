module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',
    './public/**/*.js',
    './node_modules/flowbite/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#edf5fb',
          100: '#d9ebf7',
          200: '#b5d6ef',
          300: '#8fc0e5',
          400: '#5fa2d6',
          500: '#3d82bf',
          600: '#28649e',
          700: '#033F73',
          800: '#03365f',
          900: '#022c4d',
          950: '#011629'
        },
        'brand-bg': '#F2F2F2',
        'brand-dark': '#0D0D0D'
      }
    }
  },
  plugins: [require('flowbite/plugin')]
};
