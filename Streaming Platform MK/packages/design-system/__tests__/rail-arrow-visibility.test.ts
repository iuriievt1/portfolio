import { describe, expect, it } from 'vitest'
import { railArrowVisibility } from '../components/features/Rail/Arrows/visibility'

describe('railArrowVisibility', () => {
	it('shows the right arrow when cards sit off-screen to the right', () => {
		expect(railArrowVisibility({ isMobile: false, canLeft: false, canRight: true })).toEqual({
			left: false,
			right: true,
		})
	})

	it('shows the left arrow once the rail is scrolled', () => {
		expect(railArrowVisibility({ isMobile: false, canLeft: true, canRight: true })).toEqual({
			left: true,
			right: true,
		})
	})

	it('hides both arrows when the rail fits on screen', () => {
		expect(railArrowVisibility({ isMobile: false, canLeft: false, canRight: false })).toEqual({
			left: false,
			right: false,
		})
	})

	it('hides the right arrow at the end of the rail', () => {
		expect(railArrowVisibility({ isMobile: false, canLeft: true, canRight: false })).toEqual({
			left: true,
			right: false,
		})
	})

	it('hides both arrows on mobile, where the rail is touch-scrolled', () => {
		expect(railArrowVisibility({ isMobile: true, canLeft: true, canRight: true })).toEqual({
			left: false,
			right: false,
		})
	})
})
