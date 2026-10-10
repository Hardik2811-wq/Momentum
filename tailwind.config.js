/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        headline: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        editorial: ['Newsreader', 'Georgia', 'serif'],
        'display-mobile': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-lg': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'headline-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        title: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'title-lg': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'title-md': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'title-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'], 'body-md': ['Inter', 'sans-serif'], 'body-sm': ['Inter', 'sans-serif'],
        'label-lg': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'], 'label-md': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'], 'label-sm': ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'], caption: ['Inter', 'sans-serif']
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', fontWeight: '700' }], 'display-mobile': ['2.25rem', { lineHeight: '1.15', fontWeight: '600' }],
        headline: ['1.5rem', { lineHeight: '1.25', fontWeight: '700' }], 'headline-lg': ['1.75rem', { lineHeight: '1.25', fontWeight: '700' }], 'headline-sm': ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }],
        title: ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }], 'title-lg': ['1.375rem', { lineHeight: '1.3', fontWeight: '600' }], 'title-md': ['1rem', { lineHeight: '1.4', fontWeight: '600' }], 'title-sm': ['0.875rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6' }], 'body-md': ['0.875rem', { lineHeight: '1.55' }], 'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', fontWeight: '600' }], 'label-md': ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }], 'label-sm': ['0.6875rem', { lineHeight: '1.35', fontWeight: '500' }], caption: ['0.6875rem', { lineHeight: '1.35', fontWeight: '400' }]
      },
      colors: {
        canvas: '#F7F6F2',
        'canvas-dark': '#121214',
        'surface-bone': '#FBFBFA',
        'surface-titanium': '#1A1A1E',
        'ink-primary': '#161618',
        'ink-secondary': '#6B6A72',
        'hairline': 'rgba(0,0,0,0.07)',
        'hairline-dark': 'rgba(255,255,255,0.08)',
        'accent-cobalt': '#0F52BA',
        'accent-terracotta': '#C84B31',
        surface: '#F7F6F2',
        background: '#EFECE6',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F2EFE9',
        'surface-container': '#EAE6DE',
        'surface-container-high': '#E2DDD4',
        'surface-container-highest': '#D9D3C8',
        'on-surface': '#161618',
        'on-surface-variant': '#5A5960',
        outline: '#76757E',
        'outline-variant': '#C8C6CF',
        primary: '#0F52BA',
        'primary-container': '#0F52BA',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#FFFFFF',
        'primary-fixed': '#DCE6F8',
        'primary-fixed-dim': '#B8CEF2',
        'on-primary-fixed': '#001E4D',
        'on-primary-fixed-variant': '#0A3B85',
        secondary: '#2E6F40',
        'secondary-container': '#D7EBDC',
        'secondary-fixed': '#E0F0E4',
        'secondary-fixed-dim': '#B2D8BB',
        'on-secondary': '#FFFFFF',
        'on-secondary-container': '#184724',
        'on-secondary-fixed': '#0A2912',
        'on-secondary-fixed-variant': '#1E522B',
        tertiary: '#6C4AB6',
        'tertiary-container': '#8D72E1',
        'tertiary-fixed': '#E8E1F8',
        'tertiary-fixed-dim': '#D0C1F0',
        'on-tertiary': '#FFFFFF',
        'on-tertiary-fixed': '#23124A',
        'on-tertiary-fixed-variant': '#482D82',
        error: '#D32F2F',
        'error-container': '#FDE8E8',
        'on-error-container': '#5F1414'
      },
      boxShadow: {
        'editorial': '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        'double-bezel': '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        'tactile': '0 2px 0 0 rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        'float-pill': '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)'
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' },
      spacing: { 'sidebar-width': '256px', 'gutter-xs': '4px', 'gutter-sm': '8px', 'gutter-md': '12px', 'gutter-base': '16px', 'gutter-lg': '20px', 'gutter-xl': '24px', 'gutter-2xl': '32px', 'margin-desktop': '32px' },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'translate(-50%, -130%) scale(0.75)', opacity: '0' },
          '100%': { transform: 'translate(-50%, -130%) scale(1)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        slideUp: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1) both',
        scaleIn: 'scaleIn 0.18s ease-out both',
        fadeIn: 'fadeIn 0.15s ease-out both'
      }
    }
  },
  plugins: []
};
