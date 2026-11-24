import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			'font-size': [
				'text-section-title',
				'text-body',
				'text-card-title',
				'text-label',
				'text-nav',
				'text-caption',
				'text-meta',
				'text-link',
				'text-card-show',
				'text-badge',
				'text-card-meta',
			],
		},
	},
})

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
