/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'sans-serif'], 'display-mobile': ['Inter', 'sans-serif'],
        headline: ['Inter', 'sans-serif'], 'headline-lg': ['Inter', 'sans-serif'], 'headline-sm': ['Inter', 'sans-serif'],
        title: ['Inter', 'sans-serif'], 'title-lg': ['Inter', 'sans-serif'], 'title-md': ['Inter', 'sans-serif'], 'title-sm': ['Inter', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'], 'body-md': ['Inter', 'sans-serif'], 'body-sm': ['Inter', 'sans-serif'],
        'label-lg': ['Inter', 'sans-serif'], 'label-md': ['Inter', 'sans-serif'], 'label-sm': ['Inter', 'sans-serif'], caption: ['Inter', 'sans-serif']
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', fontWeight: '700' }], 'display-mobile': ['2.25rem', { lineHeight: '1.15', fontWeight: '600' }],
        headline: ['1.5rem', { lineHeight: '1.25', fontWeight: '700' }], 'headline-lg': ['1.75rem', { lineHeight: '1.25', fontWeight: '700' }], 'headline-sm': ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }],
        title: ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }], 'title-lg': ['1.375rem', { lineHeight: '1.3', fontWeight: '600' }], 'title-md': ['1rem', { lineHeight: '1.4', fontWeight: '600' }], 'title-sm': ['0.875rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6' }], 'body-md': ['0.875rem', { lineHeight: '1.55' }], 'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', fontWeight: '600' }], 'label-md': ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }], 'label-sm': ['0.6875rem', { lineHeight: '1.35', fontWeight: '500' }], caption: ['0.6875rem', { lineHeight: '1.35', fontWeight: '400' }]
      },
      colors: {
        surface: '#F5F4FA', background: '#EFEFF5', 'surface-container-lowest': '#FFFFFF', 'surface-container-low': '#F0EFF5', 'surface-container': '#E8E7EF', 'surface-container-high': '#E2E1E8', 'surface-container-highest': '#DCDBE2',
        'on-surface': '#1A1B1F', 'on-surface-variant': '#44464F', outline: '#74777F', 'outline-variant': '#C4C6D0',
        primary: '#0A84FF', 'primary-container': '#0A84FF', 'on-primary': '#FFFFFF', 'on-primary-container': '#FFFFFF', 'primary-fixed': '#D7E2FF', 'primary-fixed-dim': '#ABC7FF', 'on-primary-fixed': '#001B3F', 'on-primary-fixed-variant': '#00458F',
        secondary: '#006E28', 'secondary-container': '#6FFB85', 'secondary-fixed': '#D8F3DE', 'secondary-fixed-dim': '#A0D4AC', 'on-secondary': '#FFFFFF', 'on-secondary-container': '#00732A', 'on-secondary-fixed': '#002107', 'on-secondary-fixed-variant': '#00531D',
        tertiary: '#5E5CE6', 'tertiary-container': '#7B79F7', 'tertiary-fixed': '#E2DFFF', 'tertiary-fixed-dim': '#C4C0FF', 'on-tertiary': '#FFFFFF', 'on-tertiary-fixed': '#181268', 'on-tertiary-fixed-variant': '#3F3CB9',
        error: '#FF453A', 'error-container': '#FFDAD6', 'on-error-container': '#93000A'
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' },
      spacing: { 'sidebar-width': '248px', 'gutter-xs': '4px', 'gutter-sm': '8px', 'gutter-md': '12px', 'gutter-base': '16px', 'gutter-lg': '20px', 'gutter-xl': '24px', 'gutter-2xl': '32px', 'margin-desktop': '32px' }
    }
  },
  plugins: []
};
