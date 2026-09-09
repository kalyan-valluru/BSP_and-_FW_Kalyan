/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary surfaces
        obsidian: {
          DEFAULT: 'rgb(var(--color-obsidian) / <alpha-value>)',
          50: 'rgb(var(--color-obsidian-50) / <alpha-value>)',
          100: 'rgb(var(--color-obsidian-100) / <alpha-value>)',
          200: 'rgb(var(--color-obsidian-200) / <alpha-value>)',
          300: 'rgb(var(--color-obsidian-300) / <alpha-value>)',
          400: 'rgb(var(--color-obsidian-400) / <alpha-value>)',
        },
        slate: {
          deep: 'rgb(var(--color-slate-deep) / <alpha-value>)',
        },
        // Neon accent colors
        neon: {
          cyan: 'rgb(var(--color-neon-cyan) / <alpha-value>)',
          cyanDim: 'rgb(var(--color-neon-cyan-dim) / <alpha-value>)',
          emerald: 'rgb(var(--color-neon-emerald) / <alpha-value>)',
          emeraldDim: 'rgb(var(--color-neon-emerald-dim) / <alpha-value>)',
          amber: 'rgb(var(--color-neon-amber) / <alpha-value>)',
          amberDim: 'rgb(var(--color-neon-amber-dim) / <alpha-value>)',
        },
        // Functional colors
        status: {
          success: 'rgb(var(--color-status-success) / <alpha-value>)',
          warning: 'rgb(var(--color-status-warning) / <alpha-value>)',
          error: 'rgb(var(--color-status-error) / <alpha-value>)',
          info: 'rgb(var(--color-status-info) / <alpha-value>)',
        },
        // Text colors
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 245, 255, 0.3), 0 0 40px rgba(0, 245, 255, 0.1)',
        'neon-emerald': '0 0 20px rgba(0, 255, 135, 0.3), 0 0 40px rgba(0, 255, 135, 0.1)',
        'neon-amber': '0 0 20px rgba(255, 170, 0, 0.3), 0 0 40px rgba(255, 170, 0, 0.1)',
        'neon-error': '0 0 20px rgba(255, 59, 59, 0.3), 0 0 40px rgba(255, 59, 59, 0.1)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-amber': 'flash-amber 1s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'blob': 'blob 7s infinite',
        'slide-up': 'slide-up 0.8s ease-out forwards',
        'scan': 'scan 3s ease-in-out infinite',
      },
      keyframes: {
        'flash-amber': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-10px)', opacity: 0 },
          '100%': { transform: 'translateX(0)', opacity: 1 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'blob': {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(40px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'scan': {
          '0%': { top: '0', opacity: 0 },
          '10%': { opacity: 1 },
          '90%': { opacity: 1 },
          '100%': { top: '100%', opacity: 0 },
        },
      },
      borderColor: {
        grid: '#1a1a22',
      },
    },
  },
  plugins: [],
};
