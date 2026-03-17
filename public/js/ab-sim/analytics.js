;(function () {
	const FEATURE_FLAG_KEY = 'word_search_difficulty_v2'
	const USERNAME_KEY = 'simulator_username'
	const USER_ID_KEY = 'simulator_user_id'
	window.FEATURE_FLAG_KEY = FEATURE_FLAG_KEY

	const generateUsername = () => {
		if (typeof window.generateRandomUsername === 'function') {
			return window.generateRandomUsername()
		}
		return 'Player ' + Math.floor(Math.random() * 1000)
	}

	function initializeVariant() {
		if (typeof posthog === 'undefined') return false
		const posthogVariant = posthog.getFeatureFlag(FEATURE_FLAG_KEY)

		let variant = null
		if (posthogVariant === '4-words') variant = 'B'
		else if (posthogVariant === 'control') variant = 'A'
		else return false

		localStorage.setItem('simulator_variant', variant)

		const userId = 'user_' + Math.random().toString(36).slice(2, 11)
		localStorage.setItem(USER_ID_KEY, userId)

		if (!localStorage.getItem(USERNAME_KEY)) {
			const username = generateUsername()
			localStorage.setItem(USERNAME_KEY, username)
			if (typeof posthog !== 'undefined' && posthog.identify) {
				posthog.identify(username)
			}
		}

		return true
	}

	function trackEvent(name, puzzleState, extra = {}) {
		try {
			if (!posthog?.capture) return
			posthog.capture(name, {
				variant: puzzleState?.variant,
				username: localStorage.getItem(USERNAME_KEY),
				user_id: localStorage.getItem(USER_ID_KEY),
				game_session_id: puzzleState?.gameSessionId,
				$feature_flag: FEATURE_FLAG_KEY,
				$feature_flag_response: posthog.getFeatureFlag(FEATURE_FLAG_KEY),
				...extra
			})
		} catch (error) {
			console.error('PostHog error:', error)
		}
	}

	window.abAnalytics = {
		FEATURE_FLAG_KEY,
		USERNAME_KEY,
		USER_ID_KEY,
		initializeVariant,
		trackEvent
	}
})()
