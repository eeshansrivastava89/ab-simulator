// Feature flag + identity keys
const ANALYTICS = window.abAnalytics || {}
const FEATURE_FLAG_KEY = ANALYTICS.FEATURE_FLAG_KEY || 'word_search_difficulty_v2'
const USERNAME_KEY = ANALYTICS.USERNAME_KEY || 'simulator_username'
const USER_ID_KEY = ANALYTICS.USER_ID_KEY || 'simulator_user_id'
window.FEATURE_FLAG_KEY = FEATURE_FLAG_KEY

const TILE_COLORS = {
	base: 'bg-gray-100',
	memorizing: 'bg-gray-100',
	hit: 'bg-emerald-300',
	miss: 'bg-red-500'
}

const TILE_COLOR_CLASSES = [
	'bg-gray-100',
	'bg-emerald-300',
	'bg-red-500',
	'bg-red-600',
	'bg-gray-800',
	'bg-gray-700',
	'bg-green-600'
]

const TILE_STATE_CONFIG = {
	default: {
		color: 'base',
		tileRemove: ['scale-105', 'animate-pulse'],
		emojiAdd: ['opacity-0', 'scale-80'],
		emojiRemove: ['opacity-100', 'scale-100']
	},
	memorize: {
		color: 'memorizing',
		tileAdd: ['scale-105'],
		tileRemove: ['animate-pulse'],
		emojiAdd: ['opacity-100', 'scale-100'],
		emojiRemove: ['opacity-0', 'scale-80']
	},
	hidden: {
		color: 'base',
		tileRemove: ['scale-105', 'animate-pulse'],
		emojiAdd: ['opacity-0', 'scale-80'],
		emojiRemove: ['opacity-100', 'scale-100']
	},
	hit: {
		color: 'hit',
		tileAdd: ['scale-105'],
		tileRemove: ['animate-pulse'],
		emojiAdd: ['opacity-100', 'scale-100'],
		emojiRemove: ['opacity-0', 'scale-80']
	},
	missActive: {
		color: 'miss',
		tileAdd: ['animate-pulse'],
		emojiAdd: ['opacity-100', 'scale-100'],
		emojiRemove: ['opacity-0', 'scale-80']
	}
}

const PROGRESS_CLASSES = Object.freeze({
	success: 'success',
	fail: 'fail',
	slotActive: 'is-active',
	slotMissed: 'is-missed',
	slotComplete: 'is-complete',
	slotPop: 'pop'
})

const DOM_CACHE = new Map()
function getDom(id, selector, all = false) {
	const cacheKey = `${id}:${selector}:${all}`
	if (DOM_CACHE.has(cacheKey)) return DOM_CACHE.get(cacheKey)
	const node = all ? document.querySelectorAll(selector) : document.querySelector(selector)
	DOM_CACHE.set(cacheKey, node)
	return node
}

const DOM = {
	progressContainer: () => getDom('progressContainer', '.pineapple-progress'),
	progressStats: () => getDom('progressStats', '#pineapple-stats'),
	progressSlots: () => getDom('progressSlots', '#pineapple-progress-slots'),
	progressFill: () => getDom('progressFill', '#pineapple-progress-fill'),
	timer: () => getDom('timer', '#timer'),
	startButton: () => getDom('startButton', '#start-button'),
	resetButton: () => getDom('resetButton', '#reset-button'),
	tryAgainButtons: () => getDom('tryAgainButtons', '.try-again-button', true),
	grid: () => getDom('grid', '#letter-grid')
}

const MEMORIZE_DURATION_SECONDS = 7
const ROUND_DURATION_MS = 60000

function applyTileColor(tile, state = 'base') {
	if (!tile) return
	tile.classList.remove(...TILE_COLOR_CLASSES)
	tile.classList.add(TILE_COLORS[state] || TILE_COLORS.base)
}

function setTileState(tile, stateKey) {
	const config = TILE_STATE_CONFIG[stateKey]
	if (!tile || !config) return
	applyTileColor(tile, config.color)
	if (config.tileAdd) tile.classList.add(...config.tileAdd)
	if (config.tileRemove) tile.classList.remove(...config.tileRemove)
	const emoji = tile.querySelector('.fruit-emoji')
	if (emoji) {
		if (config.emojiAdd) emoji.classList.add(...config.emojiAdd)
		if (config.emojiRemove) emoji.classList.remove(...config.emojiRemove)
	}
}

// Game state
const RUN_PHASES = Object.freeze({
	IDLE: 'idle',
	MEMORIZE: 'memorize',
	HUNT: 'hunt',
	RESULT: 'result'
})

const puzzleState = {
	variant: null,
	puzzleConfig: null,
	startTime: null,
	timerInterval: null,
	countdownInterval: null,
	countdownTimeout: null,
	completionTime: null,
	foundPineapples: [],
	totalClicks: 0,
	gridState: [],
	gameSessionId: null,
	phase: RUN_PHASES.IDLE
}

function resetState() {
	clearInterval(puzzleState.timerInterval)
	clearInterval(puzzleState.countdownInterval)
	clearTimeout(puzzleState.countdownTimeout)
	puzzleState.countdownInterval = null
	puzzleState.countdownTimeout = null
	puzzleState.startTime = null
	puzzleState.foundPineapples = []
	puzzleState.totalClicks = 0
	puzzleState.gridState = []
	puzzleState.completionTime = null
	puzzleState.gameSessionId = null
	puzzleState.phase = RUN_PHASES.IDLE
}

function setPhase(nextPhase) {
	if (!Object.values(RUN_PHASES).includes(nextPhase)) {
		console.warn('[phase] Attempted to set invalid phase', nextPhase)
		return
	}
	puzzleState.phase = nextPhase
}

function isPhase(...phases) {
	return phases.includes(puzzleState.phase)
}

function clearCountdownTimer() {
	if (puzzleState.countdownInterval) {
		clearInterval(puzzleState.countdownInterval)
		puzzleState.countdownInterval = null
	}
	if (puzzleState.countdownTimeout) {
		clearTimeout(puzzleState.countdownTimeout)
		puzzleState.countdownTimeout = null
	}
}

function updateMemorizePill(state = 'idle', { text, countdown } = {}) {
	const pill = $('memorize-pill')
	if (!pill) return
	pill.dataset.state = state
	if (text) {
		const textEl = $('memorize-pill-text')
		if (textEl) textEl.textContent = text
	}
	if (typeof countdown !== 'undefined') {
		const countdownEl = $('memorize-countdown')
		if (countdownEl) {
			if (typeof countdown === 'number') {
				const padded = countdown < 10 ? `0${countdown}` : `${countdown}`
				countdownEl.textContent = `${padded}s`
			} else {
				countdownEl.textContent = countdown
			}
		}
	}
}

function resetMemorizePill() {
	updateMemorizePill('idle', {
		text: 'Memorize Time',
		countdown: `${MEMORIZE_DURATION_SECONDS}s`
	})
}

function buildPineappleProgress(targetCount) {
	const slotsHost = DOM.progressSlots()
	const fill = DOM.progressFill()
	const track = $('pineapple-progress-track')
	if (!slotsHost || !fill || !track) return
	slotsHost.innerHTML = ''
	for (let i = 0; i < targetCount; i++) {
		const slot = document.createElement('div')
		slot.className = 'pineapple-slot'
		slot.dataset.index = String(i)
		slot.innerHTML = '<span>🍍</span>'
		slotsHost.appendChild(slot)
	}
	const targetLabel = $('pineapple-target')
	if (targetLabel) targetLabel.textContent = targetCount
	fill.style.width = '0%'
	updatePineappleProgress(0)
}

function resetProgressVisuals() {
	const progressContainer = DOM.progressContainer()
	const progressStats = DOM.progressStats()
	progressContainer?.classList.remove(PROGRESS_CLASSES.success, PROGRESS_CLASSES.fail)
	progressStats?.classList.remove('is-visible')
	window.abPersonalBest?.setVisibility(false)
}

function updatePineappleProgress(foundCount) {
	const slotsHost = DOM.progressSlots()
	const fill = DOM.progressFill()
	const storedTarget = Number($('pineapple-target')?.textContent || 0)
	const target = puzzleState.puzzleConfig?.targetCount ?? storedTarget ?? 0
	if (!slotsHost || !fill || !Number.isFinite(target)) return
	const slots = slotsHost.querySelectorAll('.pineapple-slot')
	slots.forEach((slot, index) => {
		slot.classList.remove(PROGRESS_CLASSES.slotActive, PROGRESS_CLASSES.slotMissed)
		if (slot.classList.contains(PROGRESS_CLASSES.slotPop)) {
			slot.classList.remove(PROGRESS_CLASSES.slotPop)
		}
		if (index < foundCount) {
			if (!slot.classList.contains(PROGRESS_CLASSES.slotComplete)) {
				slot.classList.add(PROGRESS_CLASSES.slotPop)
				setTimeout(() => slot.classList.remove(PROGRESS_CLASSES.slotPop), 320)
			}
			slot.classList.add(PROGRESS_CLASSES.slotComplete)
		} else {
			slot.classList.remove(PROGRESS_CLASSES.slotComplete)
			if (index === foundCount) {
				slot.classList.add(PROGRESS_CLASSES.slotActive)
			}
		}
	})
	const progressPercent = target === 0 ? 0 : Math.min(100, (foundCount / target) * 100)
	fill.style.width = `${progressPercent}%`
	const foundLabel = $('pineapple-progress-found')
	if (foundLabel) foundLabel.textContent = foundCount
	const targetLabel = $('pineapple-target')
	if (targetLabel) targetLabel.textContent = target
}

function markProgressFailure() {
	const slotsHost = DOM.progressSlots()
	if (!slotsHost) return
	const slots = slotsHost.querySelectorAll('.pineapple-slot')
	const foundCount = puzzleState.foundPineapples.length
	slots.forEach((slot, index) => {
		if (index >= foundCount && !slot.classList.contains(PROGRESS_CLASSES.slotComplete)) {
			slot.classList.remove(PROGRESS_CLASSES.slotActive)
			slot.classList.add(PROGRESS_CLASSES.slotMissed)
		}
	})
}

function setGridPulse(isActive) {
	const grid = DOM.grid()
	if (!grid) return
	grid.classList.toggle('grid-live', Boolean(isActive))
}

// Utility: build puzzle grid
function buildGrid(config) {
	const gridHTML = config.grid
		.map((row, rowIndex) =>
			row
				.map(
					(fruit, colIndex) =>
						`<div class="aspect-square w-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden memory-tile border-2 border-slate-300 dark:border-slate-600 hover:!bg-amber-100 hover:!border-amber-500 hover:scale-105 dark:hover:!bg-amber-500/20" data-row="${rowIndex}" data-col="${colIndex}" data-fruit="${fruit}">
          <span class="text-3xl transition-all duration-300 fruit-emoji opacity-0 scale-80">${fruit}</span>
        </div>`
				)
				.join('')
		)
		.join('')
	$('letter-grid').innerHTML = gridHTML
}

function forEachMemoryTile(callback) {
	document.querySelectorAll('.memory-tile').forEach((tile) => callback(tile))
}

function showMemorizePhase() {
	forEachMemoryTile((tile) => setTileState(tile, 'memorize'))
	DOM.startButton()?.classList.add('hidden')
	updateMemorizePill('memorizing', {
		text: 'Memorizing...',
		countdown: MEMORIZE_DURATION_SECONDS
	})
}

function hideFruits() {
	forEachMemoryTile((tile) => setTileState(tile, 'hidden'))
}

function updateTimerDisplay(elapsed) {
	const remaining = Math.max(ROUND_DURATION_MS - elapsed, 0)
	$('timer').textContent = formatTime(remaining)
}

// Event tracking helper (delegates to analytics module)
function trackEvent(name, extra = {}) {
	window.abAnalytics?.trackEvent?.(name, puzzleState, {
		phase: puzzleState.phase,
		...extra
	})
}

// Display variant + build grid
function displayVariant() {
	const variant = localStorage.getItem('simulator_variant')
	if (!variant) {
		$('user-variant').textContent = 'Error'
		$('user-username').textContent = 'Feature flag failed'
		$('target-word-count').textContent = '0'
		return
	}
	puzzleState.variant = variant
	const username = localStorage.getItem(USERNAME_KEY)
	const config = window.PuzzleConfig.getPuzzleForVariant(variant)
	puzzleState.puzzleConfig = config
	$('user-variant').textContent = `Variant ${variant} | ${config.id}`
	$('user-username').textContent = username || 'Loading...'
	$('target-word-count').textContent = config.targetCount
	buildPineappleProgress(config.targetCount)
	resetMemorizePill()
	const puzzleSection = $('puzzle-section')
	puzzleSection.classList.toggle('variant-a-theme', variant === 'A')
	puzzleSection.classList.toggle('variant-b-theme', variant === 'B')
	buildGrid(config)
}

function setupPuzzle() {
	const variant = localStorage.getItem('simulator_variant')
	if (!variant) {
		const startButton = DOM.startButton()
		if (startButton) {
			startButton.disabled = true
			startButton.textContent = 'Feature Flag Error'
			startButton.classList.add('opacity-50', 'cursor-not-allowed')
		}
		return
	}
	DOM.startButton()?.addEventListener('click', startChallenge)
	DOM.resetButton()?.addEventListener('click', () => resetPuzzle())
	DOM.tryAgainButtons().forEach((btn) => btn.addEventListener('click', () => resetPuzzle(true)))
	forEachMemoryTile((tile) => tile.addEventListener('click', handleTileClick))
}

function startChallenge() {
	if (!isPhase(RUN_PHASES.IDLE, RUN_PHASES.RESULT)) return
	setPhase(RUN_PHASES.MEMORIZE)
	// Randomize subvariant on each game start
	puzzleState.puzzleConfig = window.PuzzleConfig.getPuzzleForVariant(puzzleState.variant)
	$('user-variant').textContent = `Variant ${puzzleState.variant} | ${puzzleState.puzzleConfig.id}`
	buildGrid(puzzleState.puzzleConfig)
	forEachMemoryTile((tile) => tile.addEventListener('click', handleTileClick))
	puzzleState.foundPineapples = []
	puzzleState.totalClicks = 0
	puzzleState.gridState = Array(5)
		.fill(null)
		.map(() => Array(5).fill(false))
	puzzleState.gameSessionId = 'game_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
	resetProgressVisuals()
	updatePineappleProgress(0)
	setGridPulse(true)
	showMemorizePhase()
	startCountdownTimer(startGamePhase)
	trackEvent('puzzle_started', {
		difficulty: puzzleState.puzzleConfig.difficulty,
		puzzle_id: puzzleState.puzzleConfig.id
	})
}

function startCountdownTimer(onComplete) {
	clearCountdownTimer()
	let countdown = MEMORIZE_DURATION_SECONDS
	updateMemorizePill('memorizing', {
		text: 'Memorize every pineapple location.',
		countdown
	})
	puzzleState.countdownInterval = setInterval(() => {
		countdown--
		if (countdown > 0) {
			updateMemorizePill('memorizing', { countdown })
			return
		}
		clearCountdownTimer()
		updateMemorizePill('memorizing', { countdown: 'Go!' })
		puzzleState.countdownTimeout = setTimeout(() => {
			setPhase(RUN_PHASES.HUNT)
			if (typeof onComplete === 'function') onComplete()
		}, 400)
	}, 1000)
}

function startGamePhase() {
	if (!isPhase(RUN_PHASES.HUNT)) return
	puzzleState.startTime = Date.now()
	hideFruits()
	updateMemorizePill('hunting', {
		text: 'Find them!',
		countdown: 'GO!'
	})
	setGridPulse(true)
	DOM.resetButton()?.classList.remove('hidden')
	puzzleState.timerInterval = setInterval(updateTimer, 100)
}

function updateTimer() {
	const elapsed = Date.now() - puzzleState.startTime
	if (elapsed >= ROUND_DURATION_MS) return endChallenge(false)
	updateTimerDisplay(elapsed)
}

function handleTileClick(event) {
	if (!isPhase(RUN_PHASES.HUNT)) return
	const tile = event.currentTarget
	const row = parseInt(tile.dataset.row)
	const col = parseInt(tile.dataset.col)
	const fruit = tile.dataset.fruit
	if (puzzleState.gridState[row][col]) return
	puzzleState.totalClicks++
	puzzleState.gridState[row][col] = true
	if (fruit === '🍍') {
		puzzleState.foundPineapples.push([row, col])
		setTileState(tile, 'hit')
		updatePineappleProgress(puzzleState.foundPineapples.length)
		if (puzzleState.foundPineapples.length === puzzleState.puzzleConfig.targetCount)
			endChallenge(true)
	} else {
		setTileState(tile, 'missActive')
		setTimeout(() => {
			setTileState(tile, 'hidden')
			puzzleState.gridState[row][col] = false
		}, 1000)
	}
}

function prepareResultView() {
	const progressContainer = document.querySelector('.pineapple-progress')
	const progressStats = $('pineapple-stats')
	const resultTime = $('pineapple-result-time')
	const resultGuesses = $('pineapple-result-guesses')
	progressContainer?.classList.remove('success', 'fail')
	progressStats?.classList.remove('is-visible')
	window.abPersonalBest?.setVisibility(false)
	return { progressContainer, progressStats, resultTime, resultGuesses }
}

async function handleSuccessfulRun(viewRefs) {
	await updateLeaderboard(puzzleState.variant)
	const { progressContainer, resultTime, resultGuesses } = viewRefs
	const currentPersonalBest = window.abPersonalBest?.currentMs?.()
	const isPersonalBest =
		!Number.isFinite(currentPersonalBest) || puzzleState.completionTime < currentPersonalBest
	console.log('[PB] Success run evaluated', {
		completionMs: puzzleState.completionTime,
		personalBestMs: currentPersonalBest,
		isPersonalBest
	})
	if (resultTime) resultTime.textContent = formatTime(puzzleState.completionTime)
	if (resultGuesses) resultGuesses.textContent = puzzleState.totalClicks
	updatePineappleProgress(puzzleState.puzzleConfig.targetCount)
	progressContainer?.classList.add('success')
	window.abPersonalBest?.setVisibility(isPersonalBest)
	if (isPersonalBest) {
		window.abPersonalBest?.update(puzzleState.variant, puzzleState.completionTime)
	}
}

function handleFailedRun(viewRefs) {
	const { progressContainer, resultTime, resultGuesses } = viewRefs
	if (resultTime) resultTime.textContent = '00:60:00'
	if (resultGuesses) resultGuesses.textContent = puzzleState.totalClicks
	window.abPersonalBest?.setVisibility(false)
	progressContainer?.classList.add('fail')
	markProgressFailure()
}

async function endChallenge(success) {
	if (!isPhase(RUN_PHASES.MEMORIZE, RUN_PHASES.HUNT)) return
	setPhase(RUN_PHASES.RESULT)
	clearInterval(puzzleState.timerInterval)
	setGridPulse(false)
	puzzleState.completionTime = success ? Date.now() - puzzleState.startTime : 60000
	DOM.resetButton()?.classList.add('hidden')
	DOM.tryAgainButtons().forEach((btn) => btn.classList.remove('hidden'))
	const viewRefs = prepareResultView()
	if (success) {
		await handleSuccessfulRun(viewRefs)
	} else {
		handleFailedRun(viewRefs)
	}
	trackEvent(success ? 'puzzle_completed' : 'puzzle_failed', {
		completion_time_seconds: success
			? Number((puzzleState.completionTime / 1000).toFixed(3))
			: undefined,
		correct_words_count: puzzleState.foundPineapples.length,
		total_guesses_count: puzzleState.totalClicks
	})
	setTimeout(() => {
		resetMemorizePill()
		viewRefs.progressStats?.classList.add('is-visible')
	}, 800)
}

function resetPuzzle(isRepeat = false) {
	resetState()
	const timer = DOM.timer()
	if (timer) timer.textContent = '00:60:00'
	clearCountdownTimer()
	resetMemorizePill()
	updatePineappleProgress(0)
	resetProgressVisuals()
	forEachMemoryTile((tile) => {
		setTileState(tile, 'default')
	})
	DOM.startButton()?.classList.remove('hidden')
	DOM.resetButton()?.classList.add('hidden')
	setGridPulse(false)
	DOM.tryAgainButtons().forEach((btn) => btn.classList.add('hidden'))
	window.abPersonalBest?.setVisibility(false)
	if (isRepeat) trackEvent('puzzle_repeated', {})
}

async function updateLeaderboard(currentTime = null, currentVariant = null) {
	const variant = currentVariant || localStorage.getItem('simulator_variant')
	if (!variant) return false

	let data
	let hadError = false

	if (window.supabaseApi) {
		try {
			data = await window.supabaseApi.leaderboard(variant, 10)
		} catch (error) {
			hadError = true
			console.error('Leaderboard fetch error:', error)
		}
	} else {
		hadError = true
	}

	const render = window.abLeaderboard?.render
	if (!render) return
	if (hadError) {
		await render(variant)
	} else {
		await render(variant, data)
	}
}

function showFeatureFlagError() {
	const errorHTML = `<div class="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950 mb-4"><div class="flex items-start gap-2"><div class="text-lg">⚠️</div><div class="flex-1"><h3 class="font-semibold text-red-900 dark:text-red-100 text-sm">PostHog Feature Flag Error</h3><p class="text-xs text-red-800 dark:text-red-200 mt-1">Feature flag \"${FEATURE_FLAG_KEY}\" failed to load. Check PostHog configuration.</p></div></div></div>`
	const challengeSection = $('challenge-section')
	if (challengeSection) {
		const errorDiv = document.createElement('div')
		errorDiv.innerHTML = errorHTML
		challengeSection.parentNode.insertBefore(errorDiv, challengeSection)
	}
}

async function afterVariantResolved() {
	displayVariant()
	setupPuzzle()
	const variant = puzzleState.variant
	const username = localStorage.getItem(USERNAME_KEY)
	await Promise.all([updateLeaderboard(variant), window.abPersonalBest?.prime?.(variant, username)])
}

document.addEventListener('DOMContentLoaded', () => {
	if (typeof posthog === 'undefined' || !posthog.onFeatureFlags) {
		console.error('PostHog not initialized. Check environment variables.')
		showFeatureFlagError()
		return
	}
	const initializeVariant = window.abAnalytics?.initializeVariant
	if (typeof initializeVariant !== 'function') {
		console.error('Analytics module missing initializeVariant.')
		showFeatureFlagError()
		return
	}
	posthog.onFeatureFlags(() => {
		const ok = initializeVariant()
		if (!ok) {
			return setTimeout(() => {
				const retry = initializeVariant()
				if (!retry) {
					console.error('PostHog feature flag not resolved after retry.')
					showFeatureFlagError()
					return
				}
				afterVariantResolved()
			}, 500)
		}
		afterVariantResolved()
	})
})

// expose limited API (for potential future reuse/testing)
window.abSim = { startChallenge, resetPuzzle, puzzleState }
