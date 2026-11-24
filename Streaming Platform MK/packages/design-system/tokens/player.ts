// ── Video Player sizing reference ──
// Design-specific sizes that don't map to the 4px spacing grid.
// These stay as arbitrary Tailwind classes in components.
// This file documents them for maintainability.

export const PLAYER = {
	// Ghost play/pause indicator (design-specific, responsive)
	ghost: {
		circle: { sm: 128, md: 238 },
		pauseIcon: { sm: 64, md: 113 },
		playIcon: { sm: [48, 32], md: [93, 61] },
		playOffset: { sm: 4, md: 8 },
	},

	// Timeline
	timeline: {
		trackH: 2, // Default track height
		trackHover: 4, // Hovered track height
		thumbW: 160, // Thumbnail preview width
		thumbH: 90, // Thumbnail preview height
	},

	// Volume
	volume: {
		trackH: 3, // Volume track height
	},

	// Loading spinner
	loading: {
		size: 112,
		border: 5.85,
	},

	// Menu shell
	menu: {
		width: 275, // Figma spec
	},
} as const
