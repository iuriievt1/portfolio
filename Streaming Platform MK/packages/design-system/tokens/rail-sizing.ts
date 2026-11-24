import { BREAKPOINTS } from './breakpoints'
import type { CardVariant } from './rail'
import { RAIL } from './rail'

// ── Breakpoint resolution (shared by useRailScroll + RailSkeleton) ──

export type RailSizing = {
	cols: number
	gap: number
	peek: number
	cardWidth?: number
}

export function getRailGap(winW: number): number {
	if (winW >= BREAKPOINTS['3xl']) return RAIL.gap['3xl']
	if (winW >= BREAKPOINTS.xl) return RAIL.gap.xl
	if (winW >= BREAKPOINTS.lg) return RAIL.gap.lg
	return RAIL.gap.sm
}

export function getRailCols(variant: CardVariant, winW: number): number {
	if (winW < BREAKPOINTS.mobile) return RAIL.cols.mobile[variant]
	if (winW >= BREAKPOINTS['3xl']) return RAIL.cols['3xl'][variant]
	if (winW >= BREAKPOINTS['2xl']) return RAIL.cols['2xl'][variant]
	if (winW >= BREAKPOINTS.xl) return RAIL.cols.xl[variant]
	if (winW >= BREAKPOINTS.lg) return RAIL.cols.lg[variant]
	return RAIL.cols.sm[variant]
}

export function isMobileWidth(winW: number): boolean {
	return winW < BREAKPOINTS.mobile
}

export function getRailSizing(variant: CardVariant, winW: number): RailSizing {
	const mobile = isMobileWidth(winW)
	return {
		cols: getRailCols(variant, winW),
		gap: mobile ? RAIL.gap.mobile : getRailGap(winW),
		peek: mobile ? 0 : RAIL.peek,
	}
}

/** Compute pixel card width — the formula used by the real rail scroller */
export function computeCardWidth(containerW: number, sizing: RailSizing): number {
	if (containerW <= 0) return 0
	if (sizing.cardWidth) return Math.min(containerW, sizing.cardWidth)
	const { cols, gap, peek } = sizing
	const available = containerW - Math.ceil(cols) * gap - peek
	return Math.max(0, Math.floor(available / cols))
}

// ── CSS generation for skeletons ────────────────────────────────

type BreakpointStep = {
	minW: number | null
	cols: number
	gap: number
	peek: number
}

function getBreakpointSteps(variant: CardVariant): BreakpointStep[] {
	return [
		// Mobile — no peek
		{
			minW: null,
			cols: Math.ceil(RAIL.cols.mobile[variant]),
			gap: RAIL.gap.mobile,
			peek: 0,
		},
		// Desktop breakpoints — with peek
		{
			minW: BREAKPOINTS.mobile,
			cols: Math.ceil(RAIL.cols.sm[variant]),
			gap: RAIL.gap.sm,
			peek: RAIL.peek,
		},
		{
			minW: BREAKPOINTS.lg,
			cols: Math.ceil(RAIL.cols.lg[variant]),
			gap: RAIL.gap.lg,
			peek: RAIL.peek,
		},
		{
			minW: BREAKPOINTS.xl,
			cols: Math.ceil(RAIL.cols.xl[variant]),
			gap: RAIL.gap.xl,
			peek: RAIL.peek,
		},
		{
			minW: BREAKPOINTS['2xl'],
			cols: Math.ceil(RAIL.cols['2xl'][variant]),
			gap: RAIL.gap.xl,
			peek: RAIL.peek,
		},
		{
			minW: BREAKPOINTS['3xl'],
			cols: Math.ceil(RAIL.cols['3xl'][variant]),
			gap: RAIL.gap['3xl'],
			peek: RAIL.peek,
		},
	]
}

/** Max skeleton cards needed (largest breakpoint cols + 1 for peek) */
export function getMaxSkeletonCards(variant: CardVariant): number {
	return Math.ceil(RAIL.cols['3xl'][variant]) + 1
}

/**
 * Generate responsive CSS that sizes skeleton cards identically to the real rail.
 * Formula per breakpoint: flex: 0 0 calc((100% - cols * gap - peek) / cols)
 */
export function buildRailSkeletonCSS(variant: CardVariant, selector: string): string {
	if (!selector || !selector.trim()) return ''
	// Sanitize selector: strip characters that could break CSS structure
	const safeSelector = selector.replace(/[{}]/g, '')
	const steps = getBreakpointSteps(variant)
	const maxVisible = getMaxSkeletonCards(variant)

	return steps
		.map(({ minW, cols, gap, peek }) => {
			// On mobile (no peek): show exactly cols cards, no overflow
			// On desktop (with peek): show cols + 1 cards, last one clips via overflow-hidden
			const visible = peek > 0 ? cols + 1 : cols
			const hideFrom = visible + 1
			const cardWidth = cardWidthForSkeleton(variant, minW, cols, gap, peek)
			const inner = [
				`${safeSelector} { gap: ${gap}px; }`,
				`${safeSelector} > div { flex: 0 0 ${cardWidth}; }`,
				`${safeSelector} > div:nth-child(n+1) { display: block; }`,
				hideFrom <= maxVisible ? `${safeSelector} > div:nth-child(n+${hideFrom}) { display: none; }` : '',
			]
				.filter(Boolean)
				.join(' ')

			return minW ? `@media (min-width: ${minW}px) { ${inner} }` : inner
		})
		.join('\n')
}

function cardWidthForSkeleton(
	_variant: CardVariant,
	_minW: number | null,
	cols: number,
	gap: number,
	peek: number,
): string {
	return `calc((100% - ${cols * gap}px - ${peek}px) / ${cols})`
}
