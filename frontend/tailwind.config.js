/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base:    '#f0ede6',   // warm beige body (viewer bg)
          DEFAULT: '#ffffff',   // white cards / panels
          raised:  '#f7f5f0',   // off-white hover
          overlay: '#ede9e0',   // warm border bg
        },
        brand: {
          DEFAULT: '#00b386',
          dim:     '#009970',
          light:   '#e6f7f3',
          glow:    'rgba(0,179,134,0.15)',
          subtle:  'rgba(0,179,134,0.08)',
        },
        ink: {
          DEFAULT: '#1a1a2e',
          muted:   '#6b7280',
          faint:   '#9ca3af',
        },
        border: {
          DEFAULT: '#e2ded5',
          strong:  '#cbc7bd',
        },
        success: '#22c55e',
        danger:  '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        pdf:      '0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)',
        panel:    '0 -2px 12px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.03)',
        card:     '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        dropdown: '0 8px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
        tool:     '0 1px 3px rgba(0,0,0,0.10)',
        header:   '0 1px 0 #e2ded5, 0 2px 8px rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-up':  'fadeUp  0.22s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':  'fadeIn  0.18s ease-out',
        'slide-in': 'slideIn 0.28s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(100%)' },             to: { transform: 'none' } },
      },
    },
  },
  plugins: [],
}

