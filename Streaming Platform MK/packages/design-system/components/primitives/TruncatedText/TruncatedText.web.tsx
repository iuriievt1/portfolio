'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TruncatedTextProps } from './types'

/**
 * Minimum character length for the last visible word before the ellipsis.
 * Words shorter than this (prepositions, articles like "in", "a", "the")
 * are removed to avoid orphaned fragments at the truncation point.
 */
const MIN_TRAILING_WORD_LENGTH = 4

type WebProps = TruncatedTextProps & {
	as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4'
}

export function TruncatedText({ lines, children: text, className, as: Tag = 'p' }: WebProps) {
	const ref = useRef<HTMLElement>(null)
	const [smartText, setSmartText] = useState<string | null>(null)

	// Reset when source text changes (e.g. hero carousel slide)
	useEffect(() => {
		setSmartText(null)
	}, [text])

	const compute = useCallback(() => {
		const el = ref.current
		if (!el || !el.offsetParent) return

		const style = getComputedStyle(el)
		const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5

		// Auto-detect responsive line count from CSS (e.g. md:line-clamp-2 xl:line-clamp-3)
		const cssClamp = Number.parseInt(style.getPropertyValue('-webkit-line-clamp') || '0', 10)
		const activeLines = cssClamp > 0 ? cssClamp : lines
		const maxHeight = Math.ceil(lineHeight * activeLines) + 1

		// Create an offscreen measurer that mirrors the container's text styles
		const m = document.createElement(el.tagName)
		m.style.cssText = `
			position:absolute;visibility:hidden;pointer-events:none;
			width:${el.clientWidth}px;
			font:${style.font};
			font-feature-settings:${style.fontFeatureSettings};
			letter-spacing:${style.letterSpacing};
			word-spacing:${style.wordSpacing};
			line-height:${style.lineHeight};
			word-break:normal;
			overflow-wrap:normal;
			white-space:normal;
			padding:0;margin:0;border:0;
		`
		document.body.appendChild(m)

		// Check if the full text fits without truncation
		m.textContent = text
		if (m.scrollHeight <= maxHeight) {
			document.body.removeChild(m)
			setSmartText(null)
			return
		}

		// Binary search for the maximum number of words that fit within N lines
		const words = text.split(/\s+/)
		let low = 1
		let high = words.length - 1

		while (low < high) {
			const mid = Math.ceil((low + high) / 2)
			m.textContent = `${words.slice(0, mid).join(' ')}\u2026`
			if (m.scrollHeight <= maxHeight) {
				low = mid
			} else {
				high = mid - 1
			}
		}

		// Walk back through trailing short/orphan words
		let end = low
		while (end > 1) {
			const stripped = words[end - 1].replace(/[.,;:!?'")\]}>]+$/u, '')
			if (stripped.length < MIN_TRAILING_WORD_LENGTH) {
				end--
			} else {
				break
			}
		}

		document.body.removeChild(m)
		const final = words.slice(0, end)
		final[final.length - 1] = final[final.length - 1].replace(/[.,;:!?'")\]}>]+$/u, '')
		setSmartText(`${final.join(' ')}\u2026`)
	}, [text, lines])

	useLayoutEffect(() => {
		compute()

		const el = ref.current
		if (!el) return

		const ro = new ResizeObserver(compute)
		ro.observe(el)
		return () => ro.disconnect()
	}, [compute])

	return (
		// @ts-expect-error -- dynamic tag type
		<Tag ref={ref} className={className}>
			{smartText ?? text}
		</Tag>
	)
}
TruncatedText.displayName = 'TruncatedText'
