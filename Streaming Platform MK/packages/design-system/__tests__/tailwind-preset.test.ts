import { describe, expect, it } from 'vitest'
import { dsPreset } from '../tailwind-preset'
import { DURATION } from '../tokens/animation'
import { BREAKPOINTS } from '../tokens/breakpoints'
import { ASPECT, PALETTE, RADIUS, rgb, SCALE, SHADOW, SIZING, Z } from '../tokens/primitives'

const theme = dsPreset.theme.extend

describe('tailwind-preset derives from tokens', () => {
	describe('colors', () => {
		it('page-bg matches PALETTE.pageBg', () => {
			expect(theme.colors['page-bg']).toBe(rgb(PALETTE.pageBg))
		})

		it('live matches PALETTE.live', () => {
			expect(theme.colors.live).toBe(rgb(PALETTE.live))
		})

		it('avatar-fallback matches PALETTE.avatarFallback', () => {
			expect(theme.colors['avatar-fallback']).toBe(rgb(PALETTE.avatarFallback))
		})

		it('all preset colors are derived from PALETTE', () => {
			const flatColors = flattenColors(theme.colors)
			for (const [key, value] of Object.entries(flatColors)) {
				if (typeof value === 'string' && value.startsWith('rgb')) {
					const alpha = extractAlpha(value)
					expect(value, `colors.${key} should derive from PALETTE`).toSatisfy((v: string) =>
						Object.values(PALETTE).some((p) => rgb(p as readonly number[], alpha) === v),
					)
				}
			}
		})
	})

	describe('spacing', () => {
		it('page-sm matches SIZING.pagePad.sm', () => {
			expect(theme.spacing['page-sm']).toBe(`${SIZING.pagePad.sm}px`)
		})

		it('page-lg matches SIZING.pagePad.lg', () => {
			expect(theme.spacing['page-lg']).toBe(`${SIZING.pagePad.lg}px`)
		})

		it('section-sm matches SIZING.sectionGap.sm', () => {
			expect(theme.spacing['section-sm']).toBe(`${SIZING.sectionGap.sm}px`)
		})

		it('appbar-md matches SIZING.appbar.md', () => {
			expect(theme.spacing['appbar-md']).toBe(`${SIZING.appbar.md}px`)
		})

		it('card-outer-top matches SIZING.cardOuterMeta.top', () => {
			expect(theme.spacing['card-outer-top']).toBe(`${SIZING.cardOuterMeta.top}px`)
		})

		it('card-outer-gap matches SIZING.cardOuterMeta.gap', () => {
			expect(theme.spacing['card-outer-gap']).toBe(`${SIZING.cardOuterMeta.gap}px`)
		})

		it('card-inset matches SIZING.cardInset', () => {
			expect(theme.spacing['card-inset']).toBe(`${SIZING.cardInset}px`)
		})

		it('card-badge-inset matches SIZING.cardBadgeInset', () => {
			expect(theme.spacing['card-badge-inset']).toBe(`${SIZING.cardBadgeInset}px`)
		})

		it('card-live-top matches SIZING.cardLiveInfo.top', () => {
			expect(theme.spacing['card-live-top']).toBe(`${SIZING.cardLiveInfo.top}px`)
		})

		it('card-live-gap matches SIZING.cardLiveInfo.rowGap', () => {
			expect(theme.spacing['card-live-gap']).toBe(`${SIZING.cardLiveInfo.rowGap}px`)
		})

		it('card-live-progress matches SIZING.cardLiveInfo.progressMargin', () => {
			expect(theme.spacing['card-live-progress']).toBe(`${SIZING.cardLiveInfo.progressMargin}px`)
		})

		it('progress-h matches SIZING.progressH', () => {
			expect(theme.spacing['progress-h']).toBe(`${SIZING.progressH}px`)
		})
	})

	describe('borderRadius', () => {
		it('matches RADIUS values', () => {
			expect(theme.borderRadius.sm).toBe(`${RADIUS.sm}px`)
			expect(theme.borderRadius.lg).toBe(`${RADIUS.lg}px`)
			expect(theme.borderRadius.DEFAULT).toBe(`${RADIUS.DEFAULT}px`)
		})
	})

	describe('boxShadow', () => {
		it('matches SHADOW values', () => {
			expect(theme.boxShadow.card).toBe(SHADOW.card)
			expect(theme.boxShadow['card-hover']).toBe(SHADOW.cardHover)
			expect(theme.boxShadow.overlay).toBe(SHADOW.overlay)
		})
	})

	describe('zIndex', () => {
		it('matches Z values', () => {
			expect(theme.zIndex.mask).toBe(String(Z.mask))
			expect(theme.zIndex.appbar).toBe(String(Z.appbar))
			expect(theme.zIndex['hero-content']).toBe(String(Z.heroContent))
		})
	})

	describe('scale', () => {
		it('matches SCALE values', () => {
			expect(theme.scale.press).toBe(String(SCALE.press))
			expect(theme.scale['tv-focus']).toBe(String(SCALE.tvFocus))
		})
	})

	describe('aspectRatio', () => {
		it('video matches ASPECT.video', () => {
			expect(theme.aspectRatio.video).toBe(`${ASPECT.video[0]}/${ASPECT.video[1]}`)
		})

		it('poster matches ASPECT.poster', () => {
			expect(theme.aspectRatio.poster).toBe(`${ASPECT.poster[0]}/${ASPECT.poster[1]}`)
		})

		it('live matches ASPECT.live', () => {
			expect(theme.aspectRatio.live).toBe(`${ASPECT.live[0]}/${ASPECT.live[1]}`)
		})

		it('live-image matches ASPECT.liveImage', () => {
			expect(theme.aspectRatio['live-image']).toBe(`${ASPECT.liveImage[0]}/${ASPECT.liveImage[1]}`)
		})
	})

	describe('screens', () => {
		it('xs matches BREAKPOINTS.xs', () => {
			expect(theme.screens.xs).toBe(`${BREAKPOINTS.xs}px`)
		})

		it('3xl matches BREAKPOINTS["3xl"]', () => {
			expect(theme.screens['3xl']).toBe(`${BREAKPOINTS['3xl']}px`)
		})
	})

	describe('transitionDuration', () => {
		it('fast matches DURATION.fast', () => {
			expect(theme.transitionDuration.fast).toBe(`${DURATION.fast}ms`)
		})

		it('hero matches DURATION.heroSlide', () => {
			expect(theme.transitionDuration.hero).toBe(`${DURATION.heroSlide}ms`)
		})
	})
})

/** Flatten nested color objects like surface.DEFAULT, surface.2 */
function flattenColors(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
	const result: Record<string, string> = {}
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		if (typeof value === 'string') {
			result[fullKey] = value
		} else if (typeof value === 'object' && value !== null) {
			Object.assign(result, flattenColors(value as Record<string, unknown>, fullKey))
		}
	}
	return result
}

/** Extract alpha from rgba(r,g,b,a) string, or undefined for rgb(r,g,b) */
function extractAlpha(color: string): number | undefined {
	const match = color.match(/^rgba\(\d+,\d+,\d+,([\d.]+)\)$/)
	return match ? Number(match[1]) : undefined
}
