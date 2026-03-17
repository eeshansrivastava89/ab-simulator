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

	function setPersonalBestVisibility(isVisible) {
		const personalBestPill = document.getElementById('pineapple-personal-best')
		if (!personalBestPill) return
		personalBestPill.classList.toggle('is-visible', Boolean(isVisible))
		personalBestPill.setAttribute('aria-hidden', Boolean(isVisible) ? 'false' : 'true')
	}

	window.abPersonalBest = {
		prime: primePersonalBestCache,
		update: updatePersonalBestCache,
		setVisibility: setPersonalBestVisibility,
		currentMs: () => personalBestMs
	}
})()
