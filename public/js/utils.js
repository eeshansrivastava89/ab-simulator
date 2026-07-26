;(function () {
	// Lightweight DOM helpers as globals
	window.$ = function (id) {
		return document.getElementById(id)
	}
	window.$$ = function (selector, root) {
		return (root || document).querySelectorAll(selector)
	}
	window.show = function (...ids) {
		ids.forEach((id) => $(id)?.classList.remove('hidden'))
	}
	window.hide = function (...ids) {
		ids.forEach((id) => $(id)?.classList.add('hidden'))
	}
	window.toggle = function (id, shouldShow) {
		$(id)?.classList.toggle('hidden', shouldShow === false)
	}
	window.formatTime = function (ms) {
		const m = Math.floor(ms / 60000)
		const s = Math.floor((ms % 60000) / 1000)
		const d = Math.floor((ms % 1000) / 10)
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(d).padStart(2, '0')}`
	}
	window.escapeHtml = function (text) {
		return String(text ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
	}
	// Site theme is tracked via the data-theme attribute on <html> (see Layout.astro).
	// Do NOT check classList for a 'dark' class — it is never set.
	window.isDarkMode = function () {
		return document.documentElement.getAttribute('data-theme') === 'dark'
	}
	// ECharts theme derived from the site's CSS design tokens (tokens.css),
	// so charts always match the current palette — single source of truth.
	window.getEChartsTheme = function () {
		const styles = getComputedStyle(document.documentElement)
		const token = (name, fallback) => styles.getPropertyValue(name).trim() || fallback
		const dark = window.isDarkMode()
		const foreground = token('--foreground', dark ? '#e5e7eb' : '#374151')
		const border = token('--border', dark ? '#374151' : '#e5e7eb')
		const split = token('--input', dark ? '#1f2937' : '#f3f4f6')
		return {
			backgroundColor: 'transparent',
			textStyle: { color: foreground, fontFamily: 'Inter, sans-serif' },
			axisLine: { lineStyle: { color: border } },
			splitLine: { lineStyle: { color: split } },
			legend: { textStyle: { color: foreground } }
		}
	}
	// Leaflet tile provider matched to the site theme (CARTO Voyager / Dark Matter)
	window.mapTileUrl = function () {
		return window.isDarkMode()
			? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
			: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
	}
	// Curated word lists for username generation — positive/friendly words only.
	// The unique-names-generator defaults include words like 'xenophobic' and 'louse'
	// which produce public-facing leaderboard names we don't want.
	window.USERNAME_ADJECTIVES = [
		'Agile', 'Brave', 'Bright', 'Calm', 'Cheerful', 'Clever', 'Curious', 'Daring',
		'Eager', 'Elated', 'Fancy', 'Friendly', 'Gentle', 'Glad', 'Happy', 'Helpful',
		'Jolly', 'Joyful', 'Keen', 'Kind', 'Lively', 'Lucky', 'Merry', 'Mighty',
		'Nimble', 'Optimistic', 'Playful', 'Proud', 'Quick', 'Quiet', 'Shiny', 'Silly',
		'Swift', 'Witty', 'Zesty', 'Cosmic', 'Golden', 'Silver', 'Velvet', 'Sunny',
		'Cozy', 'Snappy', 'Peppy', 'Breezy', 'Charming', 'Dazzling', 'Fearless', 'Spirited'
	]
	window.USERNAME_ANIMALS = [
		'Penguin', 'Otter', 'Fox', 'Owl', 'Tortoise', 'Lynx', 'Badger', 'Puffin',
		'Alpaca', 'Parakeet', 'Armadillo', 'Crane', 'Vole', 'Lark', 'Meerkat', 'Manatee',
		'Dolphin', 'Koala', 'Panda', 'Falcon', 'Heron', 'Sparrow', 'Rabbit', 'Squirrel',
		'Hedgehog', 'Platypus', 'Capybara', 'Quokka', 'Walrus', 'Gibbon', 'Leopard', 'Gecko'
	]
	window.computeKDE = function (data, bandwidth) {
		if (!data || data.length === 0) return { x: [], y: [] }
		const mean = data.reduce((a, b) => a + b, 0) / data.length
		const std = Math.sqrt(data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length)
		const bw = bandwidth || std * Math.pow(data.length, -0.2)
		const min = Math.min(...data), max = Math.max(...data)
		const x = [], y = []
		for (let i = 0; i <= 150; i++) {
			const xi = min + ((max - min) * i) / 150
			x.push(xi)
			y.push(data.reduce((sum, d) => sum + Math.exp(-Math.pow((xi - d) / bw, 2) / 2), 0) / (data.length * bw * Math.sqrt(2 * Math.PI)))
		}
		return { x, y }
	}
})()
