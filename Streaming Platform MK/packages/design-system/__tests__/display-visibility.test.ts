import { describe, expect, it } from 'vitest'
import { type DisplayVisibility, type RailDisplay, VARIANT_DISPLAY_DEFAULTS } from '../components/features/Rail/context'
import type { RailVariant } from '../components/features/Rail/types'

const ALL_VARIANTS: RailVariant[] = [
	'backdrop',
	'poster',
	'character',
	'continue',
	'live',
	'schedule',
	'highlights',
	'multiview',
	'sponsored',
]

const DISPLAY_FIELDS: (keyof RailDisplay)[] = ['title', 'metadata', 'badges', 'gradient', 'progress']
const VALID_VALUES: DisplayVisibility[] = ['always', 'hover', 'hidden']

describe('VARIANT_DISPLAY_DEFAULTS', () => {
	it('has an entry for every rail variant', () => {
		for (const variant of ALL_VARIANTS) {
			expect(VARIANT_DISPLAY_DEFAULTS).toHaveProperty(variant)
		}
	})

	it('every entry has all five display fields', () => {
		for (const variant of ALL_VARIANTS) {
			const display = VARIANT_DISPLAY_DEFAULTS[variant]
			for (const field of DISPLAY_FIELDS) {
				expect(display).toHaveProperty(field)
			}
		}
	})

	it('every field value is a valid DisplayVisibility', () => {
		for (const variant of ALL_VARIANTS) {
			const display = VARIANT_DISPLAY_DEFAULTS[variant]
			for (const field of DISPLAY_FIELDS) {
				expect(VALID_VALUES).toContain(display[field])
			}
		}
	})

	describe('backdrop variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.backdrop

		it('shows the title and hides the overlaid metadata', () => {
			expect(d.title).toBe('always')
			expect(d.metadata).toBe('hidden')
		})

		it('always shows badges and gradient', () => {
			expect(d.badges).toBe('always')
			expect(d.gradient).toBe('always')
		})

		it('hides progress', () => {
			expect(d.progress).toBe('hidden')
		})
	})

	describe('poster variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.poster

		it('shows the title and hides the overlaid metadata', () => {
			expect(d.title).toBe('always')
			expect(d.metadata).toBe('hidden')
		})

		it('always shows badges', () => {
			expect(d.badges).toBe('always')
		})

		it('hides gradient and progress', () => {
			expect(d.gradient).toBe('hidden')
			expect(d.progress).toBe('hidden')
		})
	})

	describe('continue variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.continue

		it('shows the title', () => {
			expect(d.title).toBe('always')
		})

		it('always shows metadata, badges, gradient, and progress', () => {
			expect(d.metadata).toBe('always')
			expect(d.badges).toBe('always')
			expect(d.gradient).toBe('always')
			expect(d.progress).toBe('always')
		})
	})

	describe('live variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.live

		it('shows the title', () => {
			expect(d.title).toBe('always')
		})

		it('always shows metadata, badges, gradient, and progress', () => {
			expect(d.metadata).toBe('always')
			expect(d.badges).toBe('always')
			expect(d.gradient).toBe('always')
			expect(d.progress).toBe('always')
		})
	})

	describe('schedule variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.schedule

		it('always shows title and badges', () => {
			expect(d.title).toBe('always')
			expect(d.badges).toBe('always')
		})

		it('hides metadata, gradient, and progress', () => {
			expect(d.metadata).toBe('hidden')
			expect(d.gradient).toBe('hidden')
			expect(d.progress).toBe('hidden')
		})
	})

	describe('highlights variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.highlights

		it('always shows title and metadata', () => {
			expect(d.title).toBe('always')
			expect(d.metadata).toBe('always')
		})

		it('hides badges, gradient, and progress', () => {
			expect(d.badges).toBe('hidden')
			expect(d.gradient).toBe('hidden')
			expect(d.progress).toBe('hidden')
		})
	})

	describe('multiview variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.multiview

		it('always shows title, metadata, and badges', () => {
			expect(d.title).toBe('always')
			expect(d.metadata).toBe('always')
			expect(d.badges).toBe('always')
		})

		it('hides gradient and progress', () => {
			expect(d.gradient).toBe('hidden')
			expect(d.progress).toBe('hidden')
		})
	})

	describe('sponsored variant', () => {
		const d = VARIANT_DISPLAY_DEFAULTS.sponsored

		it('always shows title and metadata', () => {
			expect(d.title).toBe('always')
			expect(d.metadata).toBe('always')
		})

		it('hides badges, gradient, and progress', () => {
			expect(d.badges).toBe('hidden')
			expect(d.gradient).toBe('hidden')
			expect(d.progress).toBe('hidden')
		})
	})

	// Adil asked why some rails named their assets and others did not — now they all do.
	it('names the card on every variant', () => {
		for (const variant of ALL_VARIANTS) {
			expect(VARIANT_DISPLAY_DEFAULTS[variant].title).toBe('always')
		}
	})
})
