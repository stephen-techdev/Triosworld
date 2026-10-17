/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        ivory: '#F7F5F0',
        lime: { DEFAULT: '#B7FF43', soft: '#d6ff8a' },
        stone: { DEFAULT: '#DDD8CE', dark: '#C4BFB4' },
        // Brand accents used by product badges (were missing → badges rendered blank).
        burgundy: '#5e1f2a',
        cobalt: '#2b4cb8',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      maxWidth: {
        page: '1440px',
        // Wider frame used on very large / ultrawide displays.
        pageWide: '1760px',
      },
      screens: {
        xs: '420px',
        '3xl': '1920px',
      },
      transitionTimingFunction: {
        // Signature easing — used across the site for a cohesive, premium feel.
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23,23,23,0.04), 0 4px 16px rgba(23,23,23,0.05)',
        card: '0 2px 6px rgba(23,23,23,0.05), 0 16px 40px -18px rgba(23,23,23,0.22)',
        lift: '0 10px 20px -8px rgba(23,23,23,0.14), 0 30px 60px -24px rgba(23,23,23,0.28)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease forwards',
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-up': 'slideUp 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        marquee: 'marquee 30s linear infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'ken-burns': 'kenBurns 20s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        kenBurns: { '0%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
