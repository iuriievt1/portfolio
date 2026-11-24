import { describe, expect, it } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
	it('merges multiple classes correctly', () => {
		expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
	})

	it('handles conditional classes via clsx syntax', () => {
		expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
		expect(cn('base', true && 'hidden')).toBe('base hidden')
	})

	it('resolves Tailwind conflicts (later class wins)', () => {
		expect(cn('px-4', 'px-8')).toBe('px-8')
		expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
		expect(cn('bg-white', 'bg-black')).toBe('bg-black')
	})

	it('handles custom design-system font-size tokens', () => {
		// Custom tokens registered via extendTailwindMerge should resolve conflicts
		expect(cn('text-body', 'text-card-title')).toBe('text-card-title')
		expect(cn('text-section-title', 'text-label')).toBe('text-label')
		expect(cn('text-nav', 'text-caption')).toBe('text-caption')
	})

	it('handles undefined inputs', () => {
		expect(cn('px-4', undefined, 'py-2')).toBe('px-4 py-2')
	})

	it('handles null inputs', () => {
		expect(cn('px-4', null, 'py-2')).toBe('px-4 py-2')
	})

	it('handles false inputs', () => {
		expect(cn('px-4', false, 'py-2')).toBe('px-4 py-2')
	})

	it('returns empty string for no inputs', () => {
		expect(cn()).toBe('')
	})

	it('handles array inputs', () => {
		expect(cn(['px-4', 'py-2'])).toBe('px-4 py-2')
	})
})
