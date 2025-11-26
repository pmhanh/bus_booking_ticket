/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#f8fafc',
        },
        secondary: {
          DEFAULT: '#06b6d4',
          foreground: '#0b1021',
        },
        surface: '#0b1021',
        muted: '#1f2937',
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sm: '0.75rem',
        md: '1.25rem',
        lg: '2rem',
      },
      boxShadow: {
        card: '0 10px 40px rgba(0,0,0,0.18)',
      },
    },
  },
  plugins: [],
};
