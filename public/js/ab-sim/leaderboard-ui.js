;(function () {
	const LEADERBOARD_ROW_SURFACE =
		'bg-white border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700 shadow-sm'
	const LEADERBOARD_ROW_BASE =
		'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200 transform'

	function buildLeaderboardRow(entry, index, isCurrentUser) {
		const glowClass = isCurrentUser
			? 'ring-2 ring-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.45)]'
			: 'hover:ring-1 hover:ring-slate-200 dark:hover:ring-slate-600'
		const youTag = isCurrentUser
			? '<span class="shrink-0 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-300">YOU</span>'
			: ''
		return `
      <li class="${LEADERBOARD_ROW_BASE} ${LEADERBOARD_ROW_SURFACE} ${glowClass} hover:-translate-y-0.5 hover:shadow-lg hover:bg-slate-50 dark:hover:bg-slate-900/60">
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            ${index + 1}
          </span>
          <span class="truncate font-medium ${isCurrentUser ? 'font-semibold' : ''}">${entry.username}</span>
          ${youTag}
        </span>
        <span class="shrink-0 font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">${Number(entry.best_time).toFixed(2)}s</span>
      </li>
    `
	}

	function buildLeaderboardUserCard(entry, userRank) {
		if (!entry || !userRank) return ''
		return `
      <div class="mt-3 space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/80 p-3 text-sm text-sky-900 shadow-[0_12px_28px_rgba(14,165,233,0.25)] dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
        <div class="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-300">Your Current Rank</div>
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2 font-medium">
            <span class="font-bold">${userRank}.</span>
            <span>${entry.username}</span>
          </span>
          <span class="font-mono font-bold tabular-nums">${Number(entry.best_time).toFixed(2)}s</span>
        </div>
      </div>
    `
	}

	async function render(variant, preloadedData) {
		const list = document.getElementById('leaderboard-list')
		const usernameKey = window.abAnalytics?.USERNAME_KEY || 'simulator_username'
		const username = localStorage.getItem(usernameKey)
		if (!list) return

		try {
			if (!window.supabaseApi) throw new Error('Supabase API not initialized')
			const data =
				typeof preloadedData === 'undefined'
					? await window.supabaseApi.leaderboard(variant, 10)
					: preloadedData
			if (!data || data.length === 0) {
				list.innerHTML =
					'<p class="rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-3 text-center text-xs font-medium text-muted-foreground">Complete a run to enter the hall of fame.</p>'
				return
			}
			const userIndex = data.findIndex((entry) => entry.username === username)
			const userRank = userIndex >= 0 ? userIndex + 1 : null
			const userEntry = userIndex >= 0 ? data[userIndex] : null
			const rows = data
				.slice(0, 5)
				.map((entry, i) => buildLeaderboardRow(entry, i, entry.username === username))
				.join('')
			const userRow = userRank > 5 ? buildLeaderboardUserCard(userEntry, userRank) : ''

			list.innerHTML = `<ol class="space-y-1">${rows}</ol>${userRow}`
		} catch (error) {
			console.error('Leaderboard error:', error)
			list.innerHTML =
				'<p class="rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-center text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">Loading leaderboard…</p>'
		}
	}

	window.abLeaderboard = { render }
})()
