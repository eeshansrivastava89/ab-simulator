;(function () {
	const SUPABASE_URL = window.__SUPABASE_URL__
	const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__

	function ensureEnv() {
		if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
			throw new Error('Supabase env not configured')
		}
	}

	function jsonHeaders(includeContentType = true) {
		const headers = {
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`
		}
		if (includeContentType) headers['Content-Type'] = 'application/json'
		return headers
	}

	async function rpc(name, body) {
		ensureEnv()
		const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
			method: 'POST',
			headers: jsonHeaders(true),
			body: JSON.stringify(body)
		})
		if (!res.ok) {
			const text = await res.text()
			console.error(`RPC ${name} failed:`, res.status, text)
			throw new Error(`${name} RPC failed (${res.status}): ${text}`)
		}
		const text = await res.text()
		if (!text) return null
		let data
		try {
			data = JSON.parse(text)
		} catch (e) {
			return null
		}
		return Array.isArray(data) && data.length === 1 ? data[0] : data
	}

	async function view(pathWithQuery) {
		ensureEnv()
		const res = await fetch(`${SUPABASE_URL}${pathWithQuery}`, {
			headers: jsonHeaders(false)
		})
		if (!res.ok) {
			const text = await res.text()
			console.error(`View ${pathWithQuery} failed:`, res.status, text)
			throw new Error(`View fetch failed (${res.status}): ${text}`)
		}
		return res.json()
	}

	window.supabaseApi = {
		variantOverview() {
			return rpc('variant_overview', null)
		},
		funnel() {
			return view('/rest/v1/v_conversion_funnel?select=*')
		},
		recent(limit = 50) {
			return rpc('recent_completions', { limit_count: limit })
		},
		distribution() {
			return rpc('completion_time_distribution', {})
		},
		leaderboard(variant, limit = 10) {
			return rpc('leaderboard', { variant, limit_count: limit })
		},
		personalBest(variant, username) {
			return rpc('personal_best', { variant, username })
		},
		geoCompletions() {
			return rpc('ab_completions_geo', {})
		}
	}
})();
