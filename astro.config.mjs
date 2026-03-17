// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
	site: 'https://absim.eeshans.com',
	integrations: [
		tailwind({
			applyBaseStyles: false
		})
	]
});
