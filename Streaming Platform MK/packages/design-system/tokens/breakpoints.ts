export const BREAKPOINTS = {
	xs: 400,
	mobile: 768,
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
	'3xl': 1800,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS
