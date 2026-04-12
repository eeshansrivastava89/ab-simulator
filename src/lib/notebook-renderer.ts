// SYNCED from datascienceapps/src/lib/notebooks.ts (simplified — local file reads, no GitHub fetch)

import { marked } from 'marked'
import Prism from 'prismjs'
// Load language grammars. Order matters: main Prism import first.
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-r.js'
import 'prismjs/components/prism-javascript.js'
import 'prismjs/components/prism-typescript.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-json.js'
import fs from 'node:fs'

export interface NotebookSummary {
	status: 'significant' | 'not_significant' | 'inconclusive' | 'error'
	decision: string
	metrics: {
		label: string
		value: string
		delta?: string
		delta_direction?: 'up' | 'down'
		context?: string
	}[]
	raw_stats?: Record<string, number>
	warnings?: string[]
	methodology?: string
	power_analysis?: string
	sample_size_a?: number
	sample_size_b?: number
	generated_at: string
}

interface IpynbCell {
	cell_type: 'markdown' | 'code' | 'raw'
	source: string | string[]
	outputs?: IpynbOutput[]
	execution_count?: number | null
}

interface IpynbOutput {
	output_type: 'stream' | 'display_data' | 'execute_result' | 'error'
	text?: string | string[]
	data?: Record<string, string | string[]>
	traceback?: string[]
}

interface Ipynb {
	cells: IpynbCell[]
	metadata?: {
		kernelspec?: { language?: string }
	}
}

function joinSource(source: string | string[] | undefined): string {
	if (source === undefined) return ''
	return Array.isArray(source) ? source.join('') : source
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Strip ANSI escape codes (Jupyter sometimes embeds them in error tracebacks).
 */
function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Highlight a code block via Prism. Falls back to plain escaped HTML if the
 * language grammar isn't loaded.
 */
function highlightCode(code: string, language: string): string {
	const grammar = Prism.languages[language]
	if (grammar) {
		return Prism.highlight(code, grammar, language)
	}
	return escapeHtml(code)
}

function renderOutput(output: IpynbOutput): string {
	if (output.output_type === 'stream') {
		return `<pre class="nb-output nb-stream">${escapeHtml(joinSource(output.text))}</pre>`
	}
	if (output.output_type === 'error') {
		const traceback = (output.traceback || []).map((line) => escapeHtml(stripAnsi(line))).join('\n')
		return `<pre class="nb-output nb-error">${traceback}</pre>`
	}
	if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
		const data = output.data || {}
		// Prefer rich content: html → image → svg → text
		if (data['text/html']) {
			return `<div class="nb-output nb-html">${joinSource(data['text/html'])}</div>`
		}
		if (data['image/png']) {
			const base64 = joinSource(data['image/png']).trim()
			return `<div class="nb-output nb-image"><img alt="output" src="data:image/png;base64,${base64}"></div>`
		}
		if (data['image/jpeg']) {
			const base64 = joinSource(data['image/jpeg']).trim()
			return `<div class="nb-output nb-image"><img alt="output" src="data:image/jpeg;base64,${base64}"></div>`
		}
		if (data['image/svg+xml']) {
			return `<div class="nb-output nb-image">${joinSource(data['image/svg+xml'])}</div>`
		}
		if (data['text/plain']) {
			return `<pre class="nb-output nb-text">${escapeHtml(joinSource(data['text/plain']))}</pre>`
		}
	}
	return ''
}

/**
 * Convert a parsed .ipynb document into HTML.
 * Returns plain string HTML with classes prefixed `nb-` for styling.
 */
export function renderNotebook(ipynb: Ipynb): string {
	const lang = ipynb.metadata?.kernelspec?.language || 'python'
	const cells = ipynb.cells.map((cell) => {
		if (cell.cell_type === 'markdown') {
			const md = joinSource(cell.source)
			const html = marked.parse(md, { async: false }) as string
			return `<div class="nb-cell nb-markdown">${html}</div>`
		}
		if (cell.cell_type === 'code') {
			const code = joinSource(cell.source)
			const highlighted = highlightCode(code, lang)
			const codeBlock = `<pre class="nb-input language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`
			const outputs = (cell.outputs || []).map(renderOutput).join('')
			return `<div class="nb-cell nb-code">${codeBlock}${outputs ? `<div class="nb-outputs">${outputs}</div>` : ''}</div>`
		}
		// raw cells: emit as plain text
		return `<pre class="nb-cell nb-raw">${escapeHtml(joinSource(cell.source))}</pre>`
	})
	return `<div class="notebook">${cells.join('\n')}</div>`
}

/**
 * Read and parse a local .ipynb file. Returns null if the file doesn't exist.
 * Runs at build time (Astro SSG), so Node APIs are available.
 */
export function loadLocalNotebook(ipynbPath: string): Ipynb | null {
	try {
		const raw = fs.readFileSync(ipynbPath, 'utf-8')
		return JSON.parse(raw) as Ipynb
	} catch (e) {
		console.warn(`[notebook-renderer] Could not load ${ipynbPath}: ${e}`)
		return null
	}
}

/**
 * Read and parse a local .summary.json sidecar file.
 * Returns null if the file doesn't exist (expected — CI generates it).
 */
export function loadLocalSummary(summaryPath: string): NotebookSummary | null {
	try {
		const raw = fs.readFileSync(summaryPath, 'utf-8')
		return JSON.parse(raw) as NotebookSummary
	} catch (e) {
		// 404-equivalent: expected when CI hasn't run yet
		return null
	}
}
