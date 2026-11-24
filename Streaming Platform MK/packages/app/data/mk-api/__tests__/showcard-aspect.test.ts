import { describe, expect, it } from 'vitest'
import { showcardAspectVariant, showcardCardAspect } from '../showcard-aspect'

describe('showcardAspectVariant', () => {
	it('maps the values that name an actual ratio', () => {
		expect(showcardAspectVariant('SixteenByNine')).toBe('backdrop')
		expect(showcardAspectVariant('TwoByThree')).toBe('poster')
		expect(showcardAspectVariant('ThreeByFour')).toBe('poster')
		expect(showcardAspectVariant('FourByThree')).toBe('backdrop')
		expect(showcardAspectVariant('Players')).toBe('character')
		expect(showcardAspectVariant('Events')).toBe('schedule')
	})

	// "Test New assets" is a Feeds rail whose items only carry 2x3 — a guessed 16x9 crops them.
	it('returns null for the layout kinds so the client reads the items instead', () => {
		expect(showcardAspectVariant('Mixed')).toBeNull()
		expect(showcardAspectVariant('Feeds')).toBeNull()
		expect(showcardAspectVariant('Carousel')).toBeNull()
		expect(showcardAspectVariant('Homebanner')).toBeNull()
	})

	it('ignores casing and whitespace', () => {
		expect(showcardAspectVariant('  sixteen by nine ')).toBe('backdrop')
		expect(showcardAspectVariant('TWOBYTHREE')).toBe('poster')
	})

	it('still accepts the numeric spellings some tenants send', () => {
		expect(showcardAspectVariant('16x9')).toBe('backdrop')
		expect(showcardAspectVariant('2x3 Showcard')).toBe('poster')
	})

	it('returns null when the feed declares nothing', () => {
		expect(showcardAspectVariant(undefined)).toBeNull()
		expect(showcardAspectVariant(null)).toBeNull()
		expect(showcardAspectVariant('')).toBeNull()
		expect(showcardAspectVariant('SomethingNew')).toBeNull()
	})
})

describe('showcardCardAspect', () => {
	// "Dotscreen" on A - Test Hub is a FourByThree feed; a 16x9 card crops it top and bottom.
	it('returns the shapes no variant carries on its own', () => {
		expect(showcardCardAspect('FourByThree')).toBe('4x3')
		expect(showcardCardAspect('ThreeByFour')).toBe('3x4')
	})

	it('returns null for the ratios the variant already matches', () => {
		expect(showcardCardAspect('SixteenByNine')).toBeNull()
		expect(showcardCardAspect('TwoByThree')).toBeNull()
		expect(showcardCardAspect('Players')).toBeNull()
		expect(showcardCardAspect('Events')).toBeNull()
	})

	it('returns null for the layout kinds and for nothing at all', () => {
		expect(showcardCardAspect('Mixed')).toBeNull()
		expect(showcardCardAspect('Carousel')).toBeNull()
		expect(showcardCardAspect(undefined)).toBeNull()
		expect(showcardCardAspect('')).toBeNull()
	})

	it('ignores casing and whitespace, and accepts the numeric spellings', () => {
		expect(showcardCardAspect(' four by three ')).toBe('4x3')
		expect(showcardCardAspect('4x3 Showcard')).toBe('4x3')
		expect(showcardCardAspect('3x4')).toBe('3x4')
	})
})
