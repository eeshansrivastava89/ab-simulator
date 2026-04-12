/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}', './public/js/**/*.js'],
	darkMode: ['selector', '[data-theme="dark"]'],
	theme: {
		extend: {
			colors: {
				// Colors that need opacity-modifier support (border/60, bg-muted/60, bg-card/80, etc.)
				// use rgb(var(--x-rgb) / <alpha-value>); channels defined in app.css :root block.
				border: ({ opacityValue }) =>
					opacityValue !== undefined
						? `rgb(var(--border-rgb) / ${opacityValue})`
						: 'var(--border)',
				muted: {
					DEFAULT: ({ opacityValue }) =>
						opacityValue !== undefined
							? `rgb(var(--muted-rgb) / ${opacityValue})`
							: 'var(--muted)',
					foreground: 'var(--muted-foreground)',
				},
				card: {
					DEFAULT: ({ opacityValue }) =>
						opacityValue !== undefined
							? `rgb(var(--card-rgb) / ${opacityValue})`
							: 'var(--card)',
					foreground: 'var(--card-foreground)',
				},
				input: 'var(--input)',
				ring: 'var(--ring)',
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)',
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)',
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)',
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)',
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				serif: ['Playfair Display', 'Georgia', 'serif'],
				mono: ['JetBrains Mono', 'monospace'],
			},
		},
	},
	plugins: [require('@tailwindcss/typography')],
}
