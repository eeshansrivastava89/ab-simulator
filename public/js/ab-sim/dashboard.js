;(function initDashboard() {
	if (typeof echarts === 'undefined') return setTimeout(initDashboard, 100)

	const colors = { variantA: '#F7CA45', variantB: '#4572F7' }

	// Adaptive polling state
	let pollDelay = 3000 // Start at 3 seconds
	const minDelay = 3000
	const maxDelay = 60000
	let pollTimeout = null

	// Store ECharts instances for resize handling
	const charts = {
		avgTime: null,
		distribution: null,
		funnel: null
	}

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
		const chart = echarts.init(container, null, { renderer: 'canvas' })
		return chart
	}

	function renderComparison(c) {
		const diff = c.percentage_difference
		document.getElementById('variant-a-time').textContent = `${c.variant_a_avg}s`
		document.getElementById('variant-a-count').textContent = c.variant_a_completions
		document.getElementById('variant-b-time').textContent = `${c.variant_b_avg}s`
		document.getElementById('variant-b-count').textContent = c.variant_b_completions
		document.getElementById('comparison-diff').textContent = `${diff > 0 ? '+' : ''}${diff}%`
		const statusText = document.getElementById('comparison-status')
		if (diff > 0) statusText.textContent = '5-pineapples variant seems to be harder'
		else if (diff < 0) statusText.textContent = '4-pineapples variant seems to be harder'
		else statusText.textContent = 'Both variants are equal'
	}

	function renderAvgTimeChart(stats) {
		if (!stats || stats.length < 2) return
		const theme = getEChartsTheme()

		if (!charts.avgTime) {
			charts.avgTime = initChart('avg-time-chart')
			if (!charts.avgTime) return
		}

		const option = {
			backgroundColor: theme.backgroundColor,
			textStyle: theme.textStyle,
			title: {
				text: 'Average Completion Time',
				left: 'center',
				textStyle: { fontSize: 14, fontWeight: 'normal', ...theme.textStyle }
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				formatter: function (params) {
					const p = params[0]
					return `${p.name}<br/>Avg Time: <strong>${p.value.toFixed(2)}s</strong>`
				}
			},
			grid: { left: 50, right: 50, top: 50, bottom: 40 },
			xAxis: {
				type: 'category',
				data: ['Variant A', 'Variant B'],
				axisLine: theme.axisLine,
				axisTick: { show: false }
			},
			yAxis: {
				type: 'value',
				name: 'Seconds',
				nameTextStyle: theme.textStyle,
				axisLine: theme.axisLine,
				splitLine: theme.splitLine
			},
			series: [{
				type: 'bar',
				data: [
					{ value: stats[0].avg_completion_time, itemStyle: { color: colors.variantA } },
					{ value: stats[1].avg_completion_time, itemStyle: { color: colors.variantB } }
				],
				barWidth: '50%',
				label: {
					show: true,
					position: 'top',
					formatter: function (params) {
						return params.value.toFixed(2) + 's'
					},
					...theme.textStyle
				}
			}]
		}

		charts.avgTime.setOption(option)
	}

	function computeKDE(data) {
		if (!data || data.length === 0) return { x: [], y: [] }
		const mean = data.reduce((a, b) => a + b) / data.length
		const std = Math.sqrt(data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length)
		const bw = std * Math.pow(data.length, -0.2)
		const min = Math.min(...data),
			max = Math.max(...data)
		const x = [],
			y = []
		for (let i = 0; i <= 150; i++) {
			const xi = min + ((max - min) * i) / 150
			x.push(xi)
			y.push(
				data.reduce((sum, d) => sum + Math.exp(-Math.pow((xi - d) / bw, 2) / 2), 0) /
					(data.length * bw * Math.sqrt(2 * Math.PI))
			)
		}
		return { x, y }
	}

	function renderDistributionChart(d) {
		if (!d.variant_a_times || !d.variant_b_times) return
		const theme = getEChartsTheme()

		if (!charts.distribution) {
			charts.distribution = initChart('distribution-chart')
			if (!charts.distribution) return
		}

		const kdeA = computeKDE(d.variant_a_times)
		const kdeB = computeKDE(d.variant_b_times)

		// Combine x and y into [x, y] pairs for ECharts
		const dataA = kdeA.x.map((x, i) => [x, kdeA.y[i]])
		const dataB = kdeB.x.map((x, i) => [x, kdeB.y[i]])

		const option = {
			backgroundColor: theme.backgroundColor,
			textStyle: theme.textStyle,
			title: {
				text: 'Completion Time Distribution (KDE)',
				left: 'center',
				textStyle: { fontSize: 14, fontWeight: 'normal', ...theme.textStyle }
			},
			tooltip: {
				trigger: 'axis',
				formatter: function (params) {
					const time = params[0]?.data?.[0]?.toFixed(2) || '0'
					let result = `Time: ${time}s<br/>`
					params.forEach(p => {
						result += `${p.seriesName}: ${p.data[1].toFixed(4)}<br/>`
					})
					return result
				}
			},
			legend: {
				data: ['Variant A', 'Variant B'],
				bottom: 0,
				textStyle: theme.legend.textStyle
			},
			grid: { left: 50, right: 30, top: 50, bottom: 60 },
			xAxis: {
				type: 'value',
				name: 'Completion Time (seconds)',
				nameLocation: 'center',
				nameGap: 30,
				nameTextStyle: theme.textStyle,
				axisLine: theme.axisLine,
				splitLine: theme.splitLine
			},
			yAxis: {
				type: 'value',
				name: 'Density',
				nameTextStyle: theme.textStyle,
				axisLine: theme.axisLine,
				splitLine: theme.splitLine
			},
			series: [
				{
					name: 'Variant B',
					type: 'line',
					smooth: true,
					data: dataB,
					lineStyle: { color: colors.variantB, width: 2 },
					itemStyle: { color: colors.variantB },
					areaStyle: { color: colors.variantB, opacity: 0.4 },
					symbol: 'none'
				},
				{
					name: 'Variant A',
					type: 'line',
					smooth: true,
					data: dataA,
					lineStyle: { color: colors.variantA, width: 2 },
					itemStyle: { color: colors.variantA },
					areaStyle: { color: colors.variantA, opacity: 0.4 },
					symbol: 'none'
				}
			]
		}

		charts.distribution.setOption(option)
	}

	function renderFunnelChart(funnel) {
		if (!funnel || funnel.length === 0) return
		const theme = getEChartsTheme()

		if (!charts.funnel) {
			charts.funnel = initChart('funnel-chart')
			if (!charts.funnel) return
		}

		const variantA = funnel
			.filter((f) => f.variant === 'A')
			.sort((a, b) => a.stage_order - b.stage_order)
		const variantB = funnel
			.filter((f) => f.variant === 'B')
			.sort((a, b) => a.stage_order - b.stage_order)

		// Calculate percentages for display (relative to first stage)
		const maxA = variantA[0]?.event_count || 1
		const maxB = variantB[0]?.event_count || 1

		// Find max value for symmetric x-axis
		const maxValue = Math.max(
			...variantA.map(f => f.event_count),
			...variantB.map(f => f.event_count)
		)

		// Stage names for y-axis (reversed so Started is at top)
		const stages = variantA.map(f => f.stage).reverse()

		const option = {
			backgroundColor: theme.backgroundColor,
			textStyle: theme.textStyle,
			title: {
				text: 'Conversion Funnel',
				left: 'center',
				textStyle: { fontSize: 14, fontWeight: 'normal', ...theme.textStyle }
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				formatter: function (params) {
					let result = `<strong>${params[0].axisValue}</strong><br/>`
					params.forEach(p => {
						const absValue = Math.abs(p.value)
						const percent = p.data.percent || 0
						result += `${p.marker} ${p.seriesName}: ${absValue} (${percent}%)<br/>`
					})
					return result
				}
			},
			legend: {
				data: ['Variant A', 'Variant B'],
				top: 30,
				right: 20,
				orient: 'vertical',
				textStyle: theme.legend.textStyle
			},
			grid: { left: 100, right: 100, top: 60, bottom: 20 },
			xAxis: {
				type: 'value',
				min: -maxValue * 1.15,
				max: maxValue * 1.15,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { show: false },
				splitLine: { show: false }
			},
			yAxis: {
				type: 'category',
				data: stages,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					...theme.textStyle,
					fontWeight: 'bold'
				}
			},
			series: [
				{
					name: 'Variant A',
					type: 'bar',
					stack: 'total',
					data: variantA.map(f => ({
						value: -f.event_count, // Negative for left side
						percent: ((f.event_count / maxA) * 100).toFixed(0),
						actualValue: f.event_count
					})).reverse(),
					itemStyle: {
						color: colors.variantA,
						borderRadius: [4, 0, 0, 4]
					},
					label: {
						show: true,
						position: 'left',
						formatter: function (params) {
							return `${params.data.actualValue}\n${params.data.percent}%`
						},
						...theme.textStyle,
						fontSize: 11,
						align: 'right'
					},
					barWidth: '60%'
				},
				{
					name: 'Variant B',
					type: 'bar',
					stack: 'total',
					data: variantB.map(f => ({
						value: f.event_count, // Positive for right side
						percent: ((f.event_count / maxB) * 100).toFixed(0),
						actualValue: f.event_count
					})).reverse(),
					itemStyle: {
						color: colors.variantB,
						borderRadius: [0, 4, 4, 0]
					},
					label: {
						show: true,
						position: 'right',
						formatter: function (params) {
							return `${params.data.actualValue}\n${params.data.percent}%`
						},
						...theme.textStyle,
						fontSize: 11,
						align: 'left'
					},
					barWidth: '60%'
				}
			]
		}

		charts.funnel.setOption(option)
	}

	// Cache previous completions to avoid unnecessary re-renders (preserves scroll position)
	let prevCompletionsHash = null

	function renderCompletionsTable(completions) {
		const container = document.getElementById('completions-table')
		if (!container) return

		const hasData = completions && completions.length > 0

		// Skip re-render if data unchanged (preserves scroll position)
		const newHash = JSON.stringify(completions)
		if (newHash === prevCompletionsHash) return
		prevCompletionsHash = newHash

		if (!hasData) {
			container.innerHTML = `
				<div class="flex h-20 items-center justify-center text-xs text-muted-foreground">
					No completions yet
				</div>
			`
			return
		}

		// Compact column headers
		const colLabels = {
			'Variant': 'V',
			'Username': 'Player',
			'Time to Complete': 'Time',
			'Total Guesses': 'Guesses',
			'When': 'When',
			'City': 'City',
			'Country': 'Country'
		}

		const columns = Object.keys(completions[0])

		container.innerHTML = `
			<div class="max-h-72 overflow-auto rounded-lg border border-border">
				<table class="w-full text-xs">
					<thead class="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
						<tr>
							${columns.map((col) => `<th class="whitespace-nowrap px-2 py-2 font-semibold">${colLabels[col] || col}</th>`).join('')}
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						${completions
							.map(
								(row, i) => `
							<tr class="${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/40 transition-colors">
								${columns
									.map((col) => {
										const val = row[col] ?? '—'
										// Variant badge
										if (col === 'Variant') {
											const color = val === 'A' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
											return `<td class="px-2 py-1.5 text-center"><span class="inline-flex h-5 w-5 items-center justify-center rounded font-bold text-[10px] ${color}">${val}</span></td>`
										}
										// Numeric - monospace
										if (col === 'Time to Complete') {
											return `<td class="whitespace-nowrap px-2 py-1.5 text-center font-mono tabular-nums">${val}s</td>`
										}
										if (col === 'Total Guesses') {
											return `<td class="px-2 py-1.5 text-center font-mono tabular-nums">${val}</td>`
										}
										// Truncate long usernames
										if (col === 'Username') {
											return `<td class="max-w-[100px] truncate px-2 py-1.5" title="${val}">${val}</td>`
										}
										return `<td class="whitespace-nowrap px-2 py-1.5 text-center">${val}</td>`
									})
									.join('')}
							</tr>
						`
							)
							.join('')}
					</tbody>
				</table>
			</div>
		`
	}

	// ============================================
	// Leaflet Geo Map (tile-based for detail)
	// ============================================

	let leafletMap = null
	let markerLayer = null
	let prevGeoHash = null
	let prevMostRecentKey = null

	// Bind follow toggle to HTML checkbox
	function isFollowEnabled() {
		const checkbox = document.getElementById('follow-checkbox')
		return checkbox ? checkbox.checked : false
	}

	// Track most recent location for follow-live toggle
	let lastKnownMostRecent = null

	// Initialize follow toggle
	function initFollowToggle() {
		const checkbox = document.getElementById('follow-checkbox')
		if (!checkbox || checkbox._initDone) return
		checkbox._initDone = true

		checkbox.addEventListener('change', () => {
			if (!leafletMap) return

			if (checkbox.checked) {
				// When follow is ENABLED, immediately pan to most recent location
				if (lastKnownMostRecent?.lat && lastKnownMostRecent?.lon) {
					leafletMap.setView([lastKnownMostRecent.lat, lastKnownMostRecent.lon], 10, { animate: false })
				}
			} else {
				// When follow is DISABLED, zoom out to global view
				leafletMap.setView([25, 0], 2, { animate: false })
			}
		})
	}

	function renderGeoMap(geoData) {
		const mapEl = document.getElementById('geo-map')
		if (!mapEl || typeof L === 'undefined') return

		const hasData = geoData && geoData.length > 0
		if (!hasData) {
			if (!leafletMap) {
				mapEl.innerHTML = '<div class="flex h-full items-center justify-center text-muted-foreground">No geo data yet</div>'
			}
			return
		}

		// Check if data changed (skip re-render to preserve zoom/pan)
		const newGeoHash = JSON.stringify(geoData)
		const dataChanged = newGeoHash !== prevGeoHash

		// Find most recent completion for follow-live
		const mostRecent = geoData.reduce((a, b) =>
			new Date(a.last_completion_at) > new Date(b.last_completion_at) ? a : b
		)
		const mostRecentKey = mostRecent ? `${mostRecent.city}-${mostRecent.last_completion_at}` : null
		const hasNewCompletion = mostRecentKey !== prevMostRecentKey

		// Store for toggle handler
		lastKnownMostRecent = mostRecent

		// Skip update if data unchanged (just handle follow-live)
		if (!dataChanged && leafletMap) {
			if (isFollowEnabled() && hasNewCompletion && mostRecent?.lat && mostRecent?.lon) {
				prevMostRecentKey = mostRecentKey
				// Use setView for instant pan (no slow flyTo animation)
				leafletMap.setView([mostRecent.lat, mostRecent.lon], 10, { animate: false })
			}
			return
		}

		prevGeoHash = newGeoHash
		prevMostRecentKey = mostRecentKey

		// Initialize map once
		if (!leafletMap) {
			leafletMap = L.map('geo-map', {
				scrollWheelZoom: true,
				// Keep animations ON for smooth user zoom/pan
				// Only programmatic setView calls use { animate: false }
				zoomAnimation: true,
				fadeAnimation: true,
				markerZoomAnimation: true
			}).setView([25, 0], 2)

			// Use CartoDB Voyager (clean, fast tiles with labels)
			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 19
			}).addTo(leafletMap)

			// Create marker layer group
			markerLayer = L.layerGroup().addTo(leafletMap)

			// Reset view button - clearer UX with text
			L.Control.ResetView = L.Control.extend({
				onAdd: function() {
					const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control')
					btn.innerHTML = '🌍 Reset'
					btn.title = 'Reset to global view'
					btn.style.cssText = 'padding:6px 10px;font-size:12px;font-weight:500;cursor:pointer;background:#fff;border:none;white-space:nowrap;'
					btn.onclick = (e) => {
						e.stopPropagation()
						leafletMap.setView([25, 0], 2, { animate: false })
					}
					return btn
				}
			})
			new L.Control.ResetView({ position: 'topleft' }).addTo(leafletMap)

			initFollowToggle()
		}

		// Clear existing markers efficiently
		markerLayer.clearLayers()

		// Add markers
		geoData.forEach(d => {
			if (!d.lat || !d.lon) return

			const color = d.variant === 'A' ? colors.variantA : colors.variantB
			const borderColor = d.variant === 'A' ? '#b8860b' : '#2d4a9e'

			const marker = L.circleMarker([d.lat, d.lon], {
				radius: 5,
				fillColor: color,
				color: borderColor,
				weight: 1.5,
				opacity: 1,
				fillOpacity: 0.85
			})

			marker.bindPopup(`
				<strong>${d.city || 'Unknown City'}, ${d.country}</strong><br/>
				Variant ${d.variant}<br/>
				Completions: ${d.completions}<br/>
				Avg Time: ${(d.avg_time_ms / 1000).toFixed(2)}s
			`)

			// Click to zoom to city level
			marker.on('click', () => {
				leafletMap.setView([d.lat, d.lon], 10, { animate: false })
			})

			markerLayer.addLayer(marker)
		})

		// Pan to most recent if follow is enabled
		// (We only reach here when data changed, so this is either first load or new completion)
		if (isFollowEnabled() && mostRecent?.lat && mostRecent?.lon) {
			leafletMap.setView([mostRecent.lat, mostRecent.lon], 10, { animate: false })
		}
	}

	async function updateDashboard() {
		try {
			if (!window.supabaseApi) throw new Error('Supabase API not initialized')
			const [overview, funnel, completions, distribution, geoData] = await Promise.all([
				window.supabaseApi.variantOverview(),
				window.supabaseApi.funnel(),
				window.supabaseApi.recent(50),
				window.supabaseApi.distribution(),
				window.supabaseApi.geoCompletions()
			])
			if (!overview || !overview.comparison || !overview.stats) {
				throw new Error('Overview data missing')
			}
			renderComparison(overview.comparison)
			renderFunnelChart(funnel)
			renderAvgTimeChart(overview.stats)
			renderDistributionChart(distribution || {})
			renderCompletionsTable(completions)
			renderGeoMap(geoData || [])
			document.getElementById('last-updated').innerHTML =
				`Last updated: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
			document.getElementById('update-indicator').classList.remove('opacity-50')

			// Success: reset to minimum delay
			pollDelay = minDelay

			// Clear any existing error message
			const errorEl = document.getElementById('dashboard-error')
			if (errorEl) errorEl.remove()
		} catch (err) {
			console.error('Dashboard error:', err)

			// Error: exponential backoff
			pollDelay = Math.min(pollDelay * 2, maxDelay)
			console.warn(`Dashboard fetch failed, retrying in ${pollDelay / 1000}s`)

			const container = document.getElementById('dashboard-section')
			if (container && !document.getElementById('dashboard-error')) {
				const el = document.createElement('div')
				el.id = 'dashboard-error'
				el.innerHTML = `
          <div class="rounded-lg p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 mb-3">
            <div class="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">❌ Error Loading Dashboard</div>
            <div class="text-xs text-red-800 dark:text-red-200">${err.message}</div>
            <div class="text-xs text-red-700 dark:text-red-300 mt-2">Retrying in ${pollDelay / 1000}s... Check Supabase project URL and anon key in site env.</div>
          </div>
        `
				container.prepend(el)
			}
		}
	}

	// Schedule next poll with adaptive delay
	function scheduleNextPoll() {
		if (pollTimeout) clearTimeout(pollTimeout)
		pollTimeout = setTimeout(async () => {
			document.getElementById('update-indicator').classList.add('opacity-50')
			await updateDashboard()
			if (typeof updateLeaderboard === 'function') {
				updateLeaderboard()
			}
			scheduleNextPoll()
		}, pollDelay)
	}

	// Manual refresh function
	window.refreshDashboard = async function () {
		if (pollTimeout) clearTimeout(pollTimeout)
		document.getElementById('update-indicator').classList.add('opacity-50')
		await updateDashboard()
		if (typeof updateLeaderboard === 'function') {
			updateLeaderboard()
		}
		scheduleNextPoll()
	}

	// Handle window resize
	window.addEventListener('resize', () => {
		Object.values(charts).forEach(chart => {
			if (chart) chart.resize()
		})
		// Leaflet needs invalidateSize on resize
		if (leafletMap) leafletMap.invalidateSize()
	})

	// Initial load
	updateDashboard()
	scheduleNextPoll()

	// Dark mode observer - update all charts when theme changes
	const observer = new MutationObserver(() => {
		// Re-render all charts with new theme
		Object.values(charts).forEach(chart => {
			if (chart) {
				const theme = getEChartsTheme()
				chart.setOption({
					textStyle: theme.textStyle
				})
			}
		})
		// Full re-render to apply all theme changes
		updateDashboard()
	})
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})()
