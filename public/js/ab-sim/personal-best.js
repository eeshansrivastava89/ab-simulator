;(function () {
	const PERSONAL_BEST_KEY_PREFIX = 'ab_sim_pb_ms'
	let personalBestMs = null

	function getPersonalBestStorageKey(variant) {
		return `${PERSONAL_BEST_KEY_PREFIX}_${variant}`
	}

	async function primePersonalBestCache(variant, username) {
		if (!variant || !username || !window.supabaseApi?.personalBest) {
			console.log('[PB] Skipping prime; missing variant/user/api', { variant, username })
			personalBestMs = null
			return
		}

		try {
			const cacheKey = getPersonalBestStorageKey(variant)
			const cached = localStorage.getItem(cacheKey)
			if (cached !== null) {
				const cachedValue = Number(cached)
				personalBestMs = Number.isFinite(cachedValue) ? cachedValue : null
				console.log('[PB] Loaded from cache', { cacheKey, personalBestMs })
			}

			const data = await window.supabaseApi.personalBest(variant, username)
			console.log('[PB] RPC response', { variant, username, data })
			if (data?.best_time !== undefined && data?.best_time !== null) {
				const bestMs = Number(data.best_time) * 1000
				if (Number.isFinite(bestMs)) {
					personalBestMs = bestMs
					localStorage.setItem(cacheKey, String(bestMs))
					console.log('[PB] Cache populated from RPC', { cacheKey, bestMs })
					return
				}
			}

			if (cached === null) {
				personalBestMs = null
				localStorage.removeItem(cacheKey)
				console.log('[PB] No PB found; cleared cache', { cacheKey })
			}
		} catch (error) {
			console.error('personal best cache error', error)
		}
	}

	function updatePersonalBestCache(variant, newMs) {
		if (!variant || !Number.isFinite(newMs)) return
		personalBestMs = Number.isFinite(personalBestMs) ? Math.min(personalBestMs, newMs) : newMs
		localStorage.setItem(getPersonalBestStorageKey(variant), String(personalBestMs))
		console.log('[PB] Updated cache with new best', { variant, personalBestMs })
	}

	function showCelebration(timeMs) {
		// Remove any existing celebration
		const existing = document.getElementById('pb-celebration')
		if (existing) existing.remove()

		const timeStr = window.formatTime ? window.formatTime(timeMs) : (timeMs / 1000).toFixed(2) + 's'

		const overlay = document.createElement('div')
		overlay.id = 'pb-celebration'
		overlay.innerHTML = `
			<div class="pb-celebration-card">
				<div class="pb-celebration-emoji">🎉</div>
				<div class="pb-celebration-title">New Personal Best!</div>
				<div class="pb-celebration-time">${timeStr}</div>
				<div class="pb-celebration-sub">You're on fire 🔥</div>
			</div>
		`
		document.body.appendChild(overlay)

		// Dismiss on click
		overlay.addEventListener('click', function() { overlay.remove() })

		// Auto-dismiss after 3.5s
		setTimeout(function() {
			overlay.classList.add('pb-celebration-exit')
			setTimeout(function() { overlay.remove() }, 400)
		}, 3500)
	}

	function setPersonalBestVisibility(isVisible, timeMs) {
		if (isVisible && Number.isFinite(timeMs)) {
			showCelebration(timeMs)
		}
	}

	window.abPersonalBest = {
		prime: primePersonalBestCache,
		update: updatePersonalBestCache,
		setVisibility: setPersonalBestVisibility,
		currentMs: () => personalBestMs
	}
})()
