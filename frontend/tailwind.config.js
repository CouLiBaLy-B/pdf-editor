/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          base:    '#f9fafb',
          DEFAULT: '#ffffff',
          raised:  '#f3f4f6',
          overlay: '#e5e7eb',
        },
        brand: {
          DEFAULT: '#00b386',
          dim:     '#009970',
          light:   '#ecfdf5',
          glow:    'rgba(0,179,134,0.15)',
          subtle:  'rgba(0,179,134,0.08)',
        },
        ink: {
          DEFAULT: '#111827',
          muted:   '#6b7280',
          faint:   '#9ca3af',
        },
        border: {
          DEFAULT: '#e5e7eb',
          strong:  '#d1d5db',
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
        pdf:      '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        panel:    '0 -1px 0 #e5e7eb, 0 -4px 16px rgba(0,0,0,0.04)',
        card:     '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        dropdown: '0 8px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
        tool:     '0 1px 2px rgba(0,0,0,0.08)',
        header:   '0 1px 0 #e5e7eb',
      },
      animation: {
        'fade-up':  'fadeUp  0.2s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':  'fadeIn  0.15s ease-out',
        'slide-in': 'slideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeUp:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
    },
  },
  plugins: [],
}
