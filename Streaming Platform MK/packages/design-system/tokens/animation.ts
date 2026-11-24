/** Cubic bezier used for hero slide + rail scroll transitions */
export const EASING = {
	/** Aggressive deceleration — hero slides, page transitions */
	smoothOut: [0.22, 1, 0.36, 1] as [number, number, number, number],
	/** Cubic out — rail scroll */
	cubicOut: (t: number) => 1 - (1 - t) ** 3,
} as const

export const DURATION = {
	/** Hero slide transition (web: framer-motion) */
	heroSlide: 550,
	/** Hero slide crossfade (native: Reanimated) */
	slideFade: 500,
	/** Rail scroll-by-page animation */
	railScroll: 520,
	/** Card hover scale */
	cardHover: 200,
	/** Dot active/inactive transition */
	dot: 200,
	/** Generic fast transition */
	fast: 150,
	/** Skeleton pulse cycle */
	skeletonPulse: 1000,
	/** Opacity fade for framer-motion */
	opacity: 350,
	/** Hero controls idle timeout before fade-out */
	controlsIdle: 5000,
	/** Ghost play/pause icon hold before fade */
	ghostHold: 2000,
	/** Menu open/close transition */
	menuTransition: 150,
} as const

/** Reanimated spring presets for native/TV */
export const SPRING = {
	/** TV focus scale + focus ring border */
	focus: { damping: 15, stiffness: 150 },
	/** Search morph open — organic, slightly bouncy */
	searchOpen: { type: 'spring' as const, stiffness: 300, damping: 25 },
	/** Search morph close — snappier for responsiveness */
	searchClose: { type: 'spring' as const, stiffness: 350, damping: 28 },
} as const

/** Native dot indicator sizing */
export const DOT = {
	widthActive: 24,
	widthInactive: 12,
	opacityActive: 1,
	opacityInactive: 0.4,
} as const
