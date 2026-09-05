import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  // The theme toggle in Settings adds/removes the `dark` class (via next-themes).
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
