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

	function buildUserCard(state) {
		// state: { type: 'unplayed' | 'ranked', username?, rank?, bestTime?, totalPlayers? }
		if (state.type === 'unplayed') {
			return `
        <div class="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 text-center dark:border-slate-600 dark:bg-slate-800/50">
          <div class="text-xs text-muted-foreground">🎮 Play to see your rank</div>
        </div>
      `
		}
		const ofTotal = state.totalPlayers ? ' of ' + state.totalPlayers : ''
		return `
      <div class="mt-3 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 text-sm shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
        <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-1.5">Your Rank</div>
        <div class="flex items-center justify-between">
          <span class="flex min-w-0 items-center gap-2">
            <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-500/30 dark:text-amber-200">${state.rank}</span>
            <span class="truncate font-medium text-foreground">${state.username}</span>
          </span>
          <span class="shrink-0 font-mono font-bold tabular-nums text-foreground">${Number(state.bestTime).toFixed(2)}s</span>
        </div>
        <div class="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-1">${ofTotal ? '#' + state.rank + ofTotal + ' players' : ''}</div>
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
			const userInTop5 = userIndex >= 0 && userIndex < 5

			// Build top 5 rows
			const rows = data
				.slice(0, 5)
				.map((entry, i) => buildLeaderboardRow(entry, i, entry.username === username))
				.join('')

			// Build user card (always shown at bottom unless user is in top 5)
			let userCardHtml = ''
			if (!userInTop5) {
				if (username) {
					try {
						const rankData = await window.supabaseApi.userRank(variant, username)
						if (rankData?.rank) {
							userCardHtml = buildUserCard({
								type: 'ranked',
								username: username,
								rank: rankData.rank,
								bestTime: rankData.best_time,
								totalPlayers: rankData.total_players
							})
						} else {
							userCardHtml = buildUserCard({ type: 'unplayed' })
						}
					} catch (e) {
						userCardHtml = buildUserCard({ type: 'unplayed' })
					}
				} else {
					userCardHtml = buildUserCard({ type: 'unplayed' })
				}
			}

			list.innerHTML = `<ol class="space-y-1">${rows}</ol>${userCardHtml}`
		} catch (error) {
			console.error('Leaderboard error:', error)
			list.innerHTML =
				'<p class="rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-center text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">Loading leaderboard…</p>'
		}
	}

	window.abLeaderboard = { render }
})()
