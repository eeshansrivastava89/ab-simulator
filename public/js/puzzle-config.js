/**
 * Puzzle Configuration for A/B Test Simulator - Memory Game Edition
 *
 * Each variant has multiple puzzle options to increase variety.
 * Puzzles are memory games where users memorize fruit positions and find pineapples.
 * Variant A: Find 4 pineapples in 60 seconds
 * Variant B: Find 5 pineapples in 60 seconds
 */

const PUZZLE_VARIANTS = {
	// Variant A: Difficulty 3/10 - Find exactly 4 pineapples
	A: [
		{
			id: 'A1',
			pineapplePositions: [
				[0, 1],
				[2, 3],
				[4, 0],
				[1, 4]
			], // 4 pineapple positions [row, col]
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'], // Fruits to fill remaining spots
			difficulty: 3,
			targetCount: 4
		},
		{
			id: 'A2',
			pineapplePositions: [
				[1, 1],
				[3, 2],
				[0, 4],
				[4, 3]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 3,
			targetCount: 4
		},
		{
			id: 'A3',
			pineapplePositions: [
				[2, 2],
				[0, 0],
				[4, 4],
				[1, 3]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 3,
			targetCount: 4
		},
		{
			id: 'A4',
			pineapplePositions: [
				[3, 1],
				[1, 0],
				[2, 4],
				[0, 2]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 3,
			targetCount: 4
		},
		{
			id: 'A5',
			pineapplePositions: [
				[4, 1],
				[2, 0],
				[0, 3],
				[3, 4]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 3,
			targetCount: 4
		}
	],

	// Variant B: Difficulty 5/10 - Find exactly 5 pineapples
	B: [
		{
			id: 'B1',
			pineapplePositions: [
				[0, 1],
				[2, 3],
				[4, 0],
				[1, 4],
				[3, 2]
			], // 5 pineapple positions
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 5,
			targetCount: 5
		},
		{
			id: 'B2',
			pineapplePositions: [
				[1, 1],
				[3, 2],
				[0, 4],
				[4, 3],
				[2, 0]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 5,
			targetCount: 5
		},
		{
			id: 'B3',
			pineapplePositions: [
				[2, 2],
				[0, 0],
				[4, 4],
				[1, 3],
				[3, 1]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 5,
			targetCount: 5
		},
		{
			id: 'B4',
			pineapplePositions: [
				[3, 1],
				[1, 0],
				[2, 4],
				[0, 2],
				[4, 2]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 5,
			targetCount: 5
		},
		{
			id: 'B5',
			pineapplePositions: [
				[4, 1],
				[2, 0],
				[0, 3],
				[3, 4],
				[1, 2]
			],
			otherFruits: ['🍎', '🍌', '🍇', '🍓', '🍊'],
			difficulty: 5,
			targetCount: 5
		}
	]
}

/**
 * Select a random puzzle for the given variant
 * @param {string} variant - 'A' or 'B'
 * @returns {object} Puzzle configuration with pineapplePositions, otherFruits, etc.
 */
function selectRandomPuzzle(variant) {
	const variants = PUZZLE_VARIANTS[variant]
	if (!variants || variants.length === 0) {
		throw new Error(`No puzzles found for variant ${variant}`)
	}

	const randomIndex = Math.floor(Math.random() * variants.length)
	return variants[randomIndex]
}

/**
 * Generate the full 5x5 grid for the memory game
 * @param {object} puzzle - Puzzle configuration
 * @returns {Array} 5x5 grid with fruits
 */
function generateGrid(puzzle) {
	const grid = Array(5)
		.fill(null)
		.map(() => Array(5).fill(null))

	// Place pineapples
	puzzle.pineapplePositions.forEach(([row, col]) => {
		grid[row][col] = '🍍'
	})

	// Fill remaining spots with other fruits
	const otherFruits = [...puzzle.otherFruits]
	let fruitIndex = 0

	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 5; col++) {
			if (grid[row][col] === null) {
				grid[row][col] = otherFruits[fruitIndex % otherFruits.length]
				fruitIndex++
			}
		}
	}

	return grid
}

/**
 * Get a puzzle configuration with generated grid
 * @param {string} variant - 'A' or 'B'
 * @returns {object} Puzzle config with generated grid
 */
function getPuzzleForVariant(variant) {
	const puzzle = selectRandomPuzzle(variant)

	return {
		...puzzle,
		grid: generateGrid(puzzle)
	}
}

// Export for use in ab-simulator.js
window.PuzzleConfig = {
	getPuzzleForVariant,
	PUZZLE_VARIANTS // Export for testing/debugging
}
