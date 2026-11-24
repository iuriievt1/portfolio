export const RAIL = {
	peek: 40,
	trackPadBottom: 8,
	gap: {
		mobile: 12,
		sm: 13,
		lg: 14,
		xl: 16,
		'3xl': 18,
	},
	pad: {
		mobile: 20,
		tv: 48,
	},
	cols: {
		mobile: {
			backdrop: 2,
			poster: 3,
			character: 3,
			continue: 2,
			live: 1.15,
			schedule: 2,
			highlights: 2,
			multiview: 2,
			sponsored: 2,
		},
		sm: {
			backdrop: 3,
			poster: 4,
			character: 4,
			continue: 3,
			live: 2,
			schedule: 3,
			highlights: 3,
			multiview: 3,
			sponsored: 3,
		},
		lg: {
			backdrop: 3,
			poster: 5,
			character: 5,
			continue: 3,
			live: 2,
			schedule: 4,
			highlights: 3,
			multiview: 3,
			sponsored: 3,
		},
		xl: {
			backdrop: 4,
			poster: 6,
			character: 6,
			continue: 4,
			live: 3,
			schedule: 4,
			highlights: 4,
			multiview: 4,
			sponsored: 4,
		},
		'2xl': {
			backdrop: 5,
			poster: 7,
			character: 7,
			continue: 5,
			live: 5,
			schedule: 5,
			highlights: 5,
			multiview: 4,
			sponsored: 5,
		},
		'3xl': {
			backdrop: 5,
			poster: 8,
			character: 8,
			continue: 5,
			live: 4,
			schedule: 5,
			highlights: 5,
			multiview: 4,
			sponsored: 5,
		},
		tv: {
			backdrop: 4,
			poster: 6,
			character: 6,
			continue: 4,
			live: 3,
			schedule: 4,
			highlights: 4,
			multiview: 4,
			sponsored: 4,
		},
	},
} as const

export type CardVariant =
	| 'poster'
	| 'backdrop'
	| 'character'
	| 'continue'
	| 'live'
	| 'schedule'
	| 'highlights'
	| 'multiview'
	| 'sponsored'
export type MeasureRect = { x: number; y: number; width: number; height: number }
