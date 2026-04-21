;(function initLeaderboardPage() {
	if (typeof echarts === 'undefined') return setTimeout(initLeaderboardPage, 100)

	const colors = { variantA: '#F7CA45', variantB: '#4572F7' }

	// ─── State ─────────────────────────────────────────────
	let state = {
		page: 1,
		limit: 15,
		variant: '',
		sort: 'best_time',
		search: '',
		totalPlayers: 0,
		summary: null,
	}
	let updateSeq = 0
	const badgeOrder = ['first_game', 'speed_demon', 'top10', 'marathoner', 'contributor']

	// ─── Charts ────────────────────────────────────────────
	const charts = { dist: null, hour: null, variant: null }

	function isDarkMode() {
		return document.documentElement.classList.contains('dark')
	}

	function getEChartsTheme() {
		const dark = isDarkMode()
		return {
			backgroundColor: 'transparent',
			textStyle: { color: dark ? '#e5e7eb' : '#374151', fontFamily: 'Inter, sans-serif' },
			axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
			splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } },
			legend: { textStyle: { color: dark ? '#e5e7eb' : '#374151' } }
		}
	}

	function initChart(containerId) {
		const container = document.getElementById(containerId)
		if (!container) return null
		return echarts.init(container, null, { renderer: 'canvas' })
	}

	// ─── Helpers ───────────────────────────────────────────
	function formatTime(s) {
		if (s === null || s === undefined) return '--'
		return Number(s).toFixed(2) + 's'
	}

	function formatNumber(n) {
		if (n === null || n === undefined) return '--'
		return n.toLocaleString()
	}

	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>"']/g, char => {
			const entities = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			}
			return entities[char] || char
		})
	}

	function badgeEmoji(key) {
		const map = { first_game: '🍍', speed_demon: '⚡', top10: '🥇', marathoner: '🏃', contributor: '🏅' }
		return map[key] || ''
	}

	function badgeTooltip(key, speedThreshold) {
		const speedDemonText = speedThreshold
			? `Awarded for a best time of ${speedThreshold}s or faster.`
			: 'Awarded for an elite best time.'
		const map = {
			first_game: 'Awarded for completing your first game.',
			speed_demon: speedDemonText,
			top10: 'Awarded for placing in the global top 10 by best time.',
			marathoner: 'Awarded after 10 completed games.',
			contributor: 'Awarded after 50 completed games.'
		}
		return map[key] || ''
	}

	function orderedBadges(badges) {
		const badgeSet = new Set((badges || []).filter(Boolean))
		return badgeOrder.filter(badge => badgeSet.has(badge))
	}

	function getCurrentUsername() {
		return localStorage.getItem(window.abAnalytics?.USERNAME_KEY || 'simulator_username')
	}

	function normalizeRows(value) {
		if (Array.isArray(value)) return value
		if (value && typeof value === 'object') return [value]
		return []
	}

	function setTableMessage(message, tone = 'muted') {
		const tbody = document.getElementById('leaderboard-body')
		if (!tbody) return
		const toneClass = tone === 'error'
			? 'text-red-600 dark:text-red-400'
			: 'text-muted-foreground'
		tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-sm ${toneClass}">${escapeHtml(message)}</td></tr>`
	}

	function computeKDE(data, bandwidth) {
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

	function percentile(sorted, p) {
		const idx = Math.ceil((p / 100) * sorted.length) - 1
		return sorted[Math.max(0, idx)]
	}

	// ─── Render Hero Stats ─────────────────────────────────
	function renderHeroStats(s) {
		if (!s) return
		const set = (field, val) => {
			const el = document.querySelector(`[data-field="${field}"]`)
			if (el) el.textContent = val
		}
		set('fastest_time', formatTime(s.fastest_time))
		set('fastest_player', s.fastest_player || '--')
		set('most_games', formatNumber(s.most_games))
		set('most_games_player', s.most_games_player || '--')
		set('cities', formatNumber(s.cities))
		set('countries', formatNumber(s.countries))
		set('top_city_name', s.top_city?.city || '--')
		set('top_city_count', (s.top_city?.completions || '--') + ' completions')
		set('total_games', formatNumber(s.total_games))
		set('avg_guesses', s.avg_guesses ?? '--')
		set('most_improved_delta', s.most_improved ? '-' + formatTime(s.most_improved.improvement).replace('s','') + 's' : '--')
		set('most_improved_player', s.most_improved?.username || '--')
		set('completion_rate', s.completion_rate ? (s.completion_rate * 100).toFixed(1) + '%' : '--%')
		set('repeat_rate', s.repeat_rate ? (s.repeat_rate * 100).toFixed(1) + '%' : '--%')

	}

	// ─── Render Distribution Chart ─────────────────────────
	function renderDistChart(dist, totalGames) {
		if (!charts.dist) charts.dist = initChart('dist-chart')
		if (!charts.dist) return
		if (!dist || !dist.variant_a_times || !dist.variant_b_times) return

		const kdeA = computeKDE(dist.variant_a_times, null)
		const kdeB = computeKDE(dist.variant_b_times, null)
		const seriesA = kdeA.x.map((x, i) => [x, kdeA.y[i]])
		const seriesB = kdeB.x.map((x, i) => [x, kdeB.y[i]])

		const allTimes = [...dist.variant_a_times, ...dist.variant_b_times].sort((a, b) => a - b)
		const p50 = percentile(allTimes, 50)
		const p90 = percentile(allTimes, 90)
		const p99 = percentile(allTimes, 99)

		const p50El = document.getElementById('dist-p50')
		const p90El = document.getElementById('dist-p90')
		const p99El = document.getElementById('dist-p99')
		const nEl = document.getElementById('dist-n')
		if (p50El) p50El.textContent = 'P50: ' + formatTime(p50)
		if (p90El) p90El.textContent = 'P90: ' + formatTime(p90)
		if (p99El) p99El.textContent = 'P99: ' + formatTime(p99)
		if (nEl) nEl.textContent = 'n=' + formatNumber(totalGames)

		charts.dist.setOption({
			grid: { left: 0, right: 0, top: 4, bottom: 4 },
			xAxis: { type: 'value', show: false, min: 0, max: Math.min(40, Math.max(...allTimes) * 1.1) },
			yAxis: { type: 'value', show: false },
			tooltip: { trigger: 'axis', formatter: p => 'Time: ' + p[0].data[0].toFixed(1) + 's' },
			series: [
				{
					name: 'Variant B', type: 'line', smooth: true, showSymbol: false,
					data: seriesB, lineStyle: { color: colors.variantB, width: 2 },
					areaStyle: { color: colors.variantB, opacity: 0.12 }
				},
				{
					name: 'Variant A', type: 'line', smooth: true, showSymbol: false,
					data: seriesA, lineStyle: { color: colors.variantA, width: 2 },
					areaStyle: { color: colors.variantA, opacity: 0.15 }
				}
			]
		}, true)
	}

	// ─── Render Hourly Chart ───────────────────────────────
	function renderHourChart(hourly) {
		if (!charts.hour) charts.hour = initChart('hour-chart')
		if (!charts.hour || !hourly) return

		const hours = Array.from({ length: 24 }, (_, i) => i)
		const data = hours.map(h => {
			const found = hourly.find(item => item.hour === h)
			return found ? found.games : 0
		})
		const maxVal = Math.max(...data)
		const peakIdx = data.indexOf(maxVal)

		const peakHourEl = document.getElementById('peak-hour')
		const peakCountEl = document.getElementById('peak-count')
		if (peakHourEl) {
			const hour12 = peakIdx % 12 || 12
			const ampm = peakIdx < 12 ? 'AM' : 'PM'
			peakHourEl.textContent = `${hour12} ${ampm} PT`
		}
		if (peakCountEl) peakCountEl.textContent = maxVal + ' completions'

		charts.hour.setOption({
			grid: { left: 0, right: 0, top: 4, bottom: 4 },
			xAxis: { type: 'category', data: hours, show: false },
			yAxis: { type: 'value', show: false },
			tooltip: { trigger: 'axis', formatter: p => p[0].name + ':00 — ' + p[0].value + ' games' },
			series: [{
				type: 'bar', data: data,
				itemStyle: {
					color: p => p.dataIndex === peakIdx ? 'var(--primary)' : 'var(--muted)',
					borderRadius: [2, 2, 0, 0]
				},
				barWidth: '70%'
			}]
		}, true)
	}

	// ─── Render Variant Split ──────────────────────────────
	function renderVariantChart(split, total) {
		if (!charts.variant) charts.variant = initChart('variant-chart')
		if (!charts.variant || !split) return

		const aCount = split.A || 0
		const bCount = split.B || 0
		const aPct = total > 0 ? ((aCount / total) * 100).toFixed(0) : 0
		const bPct = total > 0 ? ((bCount / total) * 100).toFixed(0) : 0

		const splitAEl = document.getElementById('split-a')
		const splitBEl = document.getElementById('split-b')
		if (splitAEl) splitAEl.textContent = `A: ${aPct}% (${formatNumber(aCount)})`
		if (splitBEl) splitBEl.textContent = `B: ${bPct}% (${formatNumber(bCount)})`

		charts.variant.setOption({
			tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
			series: [{
				type: 'pie', radius: ['45%', '75%'], center: ['50%', '50%'],
				label: { show: false },
				data: [
					{ value: aCount, name: 'Variant A', itemStyle: { color: colors.variantA } },
					{ value: bCount, name: 'Variant B', itemStyle: { color: colors.variantB } }
				]
			}]
		}, true)
	}

	function renderTable(rows) {
		const tbody = document.getElementById('leaderboard-body')
		if (!tbody) return

		const username = getCurrentUsername()

		if (!rows || rows.length === 0) {
			tbody.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-muted-foreground text-sm">No players found.</td></tr>'
			return
		}

		tbody.innerHTML = rows.map(row => {
			const isCurrentUser = row.username === username
			const rankClass = row.rank <= 3 ? `lb-rank-chip lb-rank-chip--rank-${row.rank}` : 'lb-rank-chip lb-rank-chip--default'
			const variantClass = row.variant === 'A' ? 'lb-variant-pill lb-variant-pill--a' : 'lb-variant-pill lb-variant-pill--b'
			const bestTimeClass = row.rank <= 3 ? 'lb-best-time lb-best-time--top' : 'lb-best-time'
			const badgeDisplay = orderedBadges(row.badges).map(b => badgeEmoji(b)).filter(Boolean).join(' ') || '—'
			const location = [row.city, row.country].filter(Boolean).join(', ') || '—'
			const safeUsername = escapeHtml(row.username || 'Anonymous Player')
			const safeVariant = escapeHtml(row.variant || '—')
			const safeLocation = escapeHtml(location)
			const safeBestTime = escapeHtml(formatTime(row.best_time))
			const safeAvgTime = escapeHtml(formatTime(row.avg_time))
			const safeGames = escapeHtml(row.games ?? '—')
			const safeAvgGuesses = escapeHtml(row.avg_guesses ?? '--')
			const safeRank = escapeHtml(row.rank ?? '—')
			const safeBadges = escapeHtml(badgeDisplay)
			const youLabel = isCurrentUser ? ' <span class="lb-you-label">You</span>' : ''

			return `
				<tr class="${isCurrentUser ? 'lb-row lb-row--current' : 'lb-row'}">
					<td class="text-center"><span class="${rankClass}">${safeRank}</span></td>
					<td class="font-medium">${safeUsername}${youLabel}</td>
					<td class="text-center"><span class="${variantClass}">${safeVariant}</span></td>
					<td class="text-right font-mono font-bold"><span class="${bestTimeClass}">${safeBestTime}</span></td>
						<td class="text-right font-mono">${safeAvgTime}</td>
						<td class="text-center font-mono">${safeGames}</td>
						<td class="text-right font-mono">${safeAvgGuesses}</td>
						<td class="lb-location">${safeLocation}</td>
						<td class="text-center"><span class="lb-badges">${safeBadges}</span></td>
					</tr>
				`
			}).join('')
	}

	// ─── Render Pagination ─────────────────────────────────
	function renderPagination() {
		const info = document.getElementById('lb-pagination-info')
		const container = document.getElementById('lb-pagination')
		if (!info || !container) return

		const total = state.totalPlayers
		const start = (state.page - 1) * state.limit + 1
		const end = Math.min(start + state.limit - 1, total)
		info.textContent = total > 0 ? `Showing ${start}–${end} of ${formatNumber(total)} players` : 'No players found'

		const totalPages = Math.ceil(total / state.limit)
		if (totalPages <= 1) {
			container.innerHTML = ''
			return
		}

		let html = ''
		html += `<button class="filter-btn" ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">← Prev</button>`

		for (let i = 1; i <= totalPages; i++) {
			if (i === 1 || i === totalPages || (i >= state.page - 1 && i <= state.page + 1)) {
				html += `<button class="filter-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`
			} else if (i === state.page - 2 || i === state.page + 2) {
				html += `<span class="text-[11px] px-1 text-muted">…</span>`
			}
		}

		html += `<button class="filter-btn" ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Next →</button>`
		container.innerHTML = html
	}

	// ─── Render Badges ─────────────────────────────────────
	function renderBadges(userRows, topTenRows, speedThreshold) {
		const badgeList = document.getElementById('badge-list')
		const badgeCount = document.getElementById('badge-earned-count')
		const badgeUsernameValue = document.getElementById('badge-username-value')
		const badgeCta = document.getElementById('badge-cta')
		const username = getCurrentUsername()
		const normalizedRows = normalizeRows(userRows)
		const actualTopTenRows = normalizeRows(topTenRows)
		const earnedBadges = new Set(
			normalizedRows.flatMap(row => (row.badges || []).filter(badge => badge !== 'top10'))
		)
		const hasAnyCompletion = normalizedRows.length > 0
		if (hasAnyCompletion) earnedBadges.add('first_game')
		if (actualTopTenRows.some(row => row.username === username)) earnedBadges.add('top10')
		const totalBadges = badgeList?.querySelectorAll('[data-badge-key]')?.length || 6

			badgeList?.querySelectorAll('[data-badge-key]').forEach(el => {
				el.dataset.tooltip = badgeTooltip(el.dataset.badgeKey, speedThreshold)
				const isEarned = earnedBadges.has(el.dataset.badgeKey)
				el.classList.toggle('earned', isEarned)
				el.classList.toggle('locked', !isEarned)
			})

		if (badgeUsernameValue) {
			badgeUsernameValue.textContent = username || 'No player selected'
		}

		if (badgeCount) {
			if (!username) {
				badgeCount.textContent = `0 of ${totalBadges} earned`
			} else {
				badgeCount.textContent = `${earnedBadges.size} of ${totalBadges} earned`
			}
		}

		if (badgeCta) {
			const shouldShowCta = !hasAnyCompletion
			badgeCta.classList.toggle('hidden', !shouldShowCta)
			badgeCta.classList.toggle('inline-flex', shouldShowCta)
			badgeCta.textContent = username ? `Play first game as ${username}` : 'Play your first game'
		}

	}

	// ─── Render Geo Map ────────────────────────────────────
	let leafletMap = null
	let markerLayer = null
	let prevGeoHash = null

	function renderGeoMap(geoData) {
		const mapEl = document.getElementById('geo-map')
		if (!mapEl || typeof L === 'undefined') return

		if (!geoData || geoData.length === 0) {
			if (!leafletMap) mapEl.innerHTML = '<div class="flex h-full items-center justify-center text-muted-foreground">No geo data yet</div>'
			return
		}

		const newGeoHash = JSON.stringify(geoData)
		if (newGeoHash === prevGeoHash && leafletMap) return
		prevGeoHash = newGeoHash

		if (!leafletMap) {
			leafletMap = L.map(mapEl, { scrollWheelZoom: true }).setView([25, 0], 1.8)
			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
				subdomains: 'abcd', maxZoom: 19
			}).addTo(leafletMap)
			markerLayer = L.layerGroup().addTo(leafletMap)

			L.Control.ResetView = L.Control.extend({
				onAdd: function() {
					const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control')
					btn.innerHTML = '🌍 Reset'
					btn.title = 'Reset to global view'
					btn.style.cssText = 'padding:6px 10px;font-size:12px;font-weight:500;cursor:pointer;background:#fff;border:none;white-space:nowrap;'
					btn.onclick = (e) => { e.stopPropagation(); leafletMap.setView([25, 0], 1.8, { animate: false }) }
					return btn
				}
			})
			new L.Control.ResetView({ position: 'topleft' }).addTo(leafletMap)
		}

		markerLayer.clearLayers()
		geoData.forEach(d => {
			if (!d.lat || !d.lon) return
			const color = d.variant === 'A' ? colors.variantA : colors.variantB
			const border = d.variant === 'A' ? '#b8860b' : '#2d4a9e'
			const marker = L.circleMarker([d.lat, d.lon], {
				radius: Math.sqrt(d.completions || 1) * 1.8,
				fillColor: color, color: border, weight: 1.5, opacity: 1, fillOpacity: 0.75
			})
			marker.bindPopup(`<strong>${d.city || 'Unknown'}, ${d.country}</strong><br/>Variant ${d.variant}<br/>${d.completions} completions`)
			markerLayer.addLayer(marker)
		})
	}

	// ─── Fetch & Update ────────────────────────────────────
	async function updatePage() {
		const requestId = ++updateSeq
		try {
			if (!window.supabaseApi) throw new Error('Supabase API not initialized')
			window.abAnalytics?.ensureUserIdentity?.()
			const username = getCurrentUsername()
			const userAchievementPromise = username
				? window.supabaseApi.globalLeaderboard(100, 0, null, 'best_time', username)
				: Promise.resolve([])
			const secondaryFetch = Promise.all([
				window.supabaseApi.distribution(),
				window.supabaseApi.geoCompletions()
			])
			if (state.page === 1 && !state.search && !state.summary) {
				setTableMessage('Loading leaderboard…')
			}

			const [summary, rows, userAchievementRows, topTenRows] = await Promise.all([
				window.supabaseApi.leaderboardSummary(),
				window.supabaseApi.globalLeaderboard(state.limit, (state.page - 1) * state.limit, state.variant || null, state.sort, state.search || null),
				userAchievementPromise,
				window.supabaseApi.globalLeaderboard(10, 0, null, 'best_time', null)
			])
			if (requestId !== updateSeq) return
			const leaderboardRows = normalizeRows(rows)
			const exactUserRows = normalizeRows(userAchievementRows).filter(row => row.username === username)

			state.summary = summary
			state.totalPlayers = summary?.total_players || 0

			renderHeroStats(summary)
			renderHourChart(summary?.hourly_activity)
			renderVariantChart(summary?.variant_split, summary?.total_games)
			renderBadges(exactUserRows, topTenRows, summary?.speed_demon_threshold)
			renderTable(leaderboardRows)
			renderPagination()

			const [dist, geo] = await secondaryFetch
			if (requestId !== updateSeq) return
			renderDistChart(dist, summary?.total_games)
			renderGeoMap(normalizeRows(geo))
		} catch (err) {
			console.error('Leaderboard error:', err)
			if (requestId !== updateSeq) return
			setTableMessage('Error loading leaderboard. Retrying…', 'error')
		}
	}

	// ─── Event Listeners ───────────────────────────────────
	function initEventListeners() {
		// Variant filter
		document.getElementById('variant-filters')?.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-variant]')
			if (!btn) return
			document.querySelectorAll('#variant-filters .filter-btn').forEach(b => b.classList.remove('active'))
			btn.classList.add('active')
			state.variant = btn.dataset.variant
			state.page = 1
			updatePage()
		})

		// Sort
		document.getElementById('lb-sort')?.addEventListener('change', (e) => {
			state.sort = e.target.value
			state.page = 1
			updatePage()
		})

		// Search (debounced)
		let searchTimeout
		document.getElementById('lb-search')?.addEventListener('input', (e) => {
			clearTimeout(searchTimeout)
			searchTimeout = setTimeout(() => {
				state.search = e.target.value.trim()
				state.page = 1
				updatePage()
			}, 300)
		})

		// Pagination
		document.getElementById('lb-pagination')?.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-page]')
			if (!btn) return
			const page = parseInt(btn.dataset.page)
			if (isNaN(page) || page < 1) return
			state.page = page
			updatePage()
			// Scroll to top of table
			document.getElementById('leaderboard-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		})
	}

	// ─── Dark mode observer ────────────────────────────────
	const observer = new MutationObserver(() => {
		Object.values(charts).forEach(chart => {
			if (chart) {
				const theme = getEChartsTheme()
				chart.setOption({ textStyle: theme.textStyle })
			}
		})
	})
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

	// ─── Resize ────────────────────────────────────────────
	window.addEventListener('resize', () => {
		Object.values(charts).forEach(chart => { if (chart) chart.resize() })
		if (leafletMap) leafletMap.invalidateSize()
	})

	// ─── Init ──────────────────────────────────────────────
	initEventListeners()
	updatePage()
})()
