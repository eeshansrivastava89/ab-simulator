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
})()
