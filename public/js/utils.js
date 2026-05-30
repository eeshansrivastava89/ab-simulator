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
