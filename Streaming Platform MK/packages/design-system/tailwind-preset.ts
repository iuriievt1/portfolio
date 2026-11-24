import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'
import { DURATION } from './tokens/animation.ts'
import { BREAKPOINTS } from './tokens/breakpoints.ts'
import {
	ASPECT,
	FONT_SIZE,
	PALETTE,
	RADIUS,
	rgb,
	SCALE,
	SHADOW,
	SIZING,
	TYPOGRAPHY,
	type TypographyToken,
	type TypographyTuple,
	Z,
} from './tokens/primitives.ts'

/** Convert a number to a px string */
const px = (n: number) => `${n}px`

/** Convert a number to an ms string */
const ms = (n: number) => `${n}ms`

/** Build CSS properties from a typography tuple */
function typoCss(t: TypographyTuple) {
	return { fontSize: px(t[0]), lineHeight: `${t[1]}%`, fontWeight: String(t[2]) }
}

/** Plugin: generates responsive `md:` overrides for typography tokens that have an `md` scale */
const responsiveTypography = plugin(({ addUtilities }) => {
	const utilities: Record<string, Record<string, Record<string, string>>> = {}
	for (const [name, token] of Object.entries(TYPOGRAPHY) as [string, TypographyToken][]) {
		if (token.md) {
			utilities[`@media (min-width: ${px(BREAKPOINTS.md)})`] = {
				...utilities[`@media (min-width: ${px(BREAKPOINTS.md)})`],
				[`.text-${name}`]: typoCss(token.md),
			}
		}
	}
	addUtilities(utilities)
})

export const dsPreset = {
	theme: {
		fontFamily: {
			sans: ['proxima-nova', 'system-ui', 'sans-serif'],
		},
		extend: {
			colors: {
				'page-bg': rgb(PALETTE.pageBg),
				appbar: rgb(PALETTE.pageBg),
				surface: {
					DEFAULT: rgb(PALETTE.surface),
					'2': rgb(PALETTE.surface2),
					'3': rgb(PALETTE.surface3),
				},
				foreground: rgb(PALETTE.white),
				muted: {
					DEFAULT: rgb(PALETTE.muted),
					'2': rgb(PALETTE.muted2),
				},
				border: rgb(PALETTE.white, 0.1),
				primary: rgb(PALETTE.red),
				accent: rgb(PALETTE.green),
				'rail-arrow': {
					DEFAULT: rgb(PALETTE.blue),
					bg: rgb(PALETTE.pageBg),
				},
				'avatar-fallback': rgb(PALETTE.avatarFallback),
				'switcher-muted': rgb(PALETTE.switcherMuted),
				overlay: rgb(PALETTE.black),
				live: rgb(PALETTE.live),
				'focus-ring': rgb(PALETTE.blue),
				'live-grad': {
					from: rgb(PALETTE.liveGrad1),
					to: rgb(PALETTE.liveGrad2),
				},
				viewall: rgb(PALETTE.viewall),
			},
			spacing: {
				'page-sm': px(SIZING.pagePad.sm),
				'page-lg': px(SIZING.pagePad.lg),
				'page-xl': px(SIZING.pagePad.xl),
				'page-3xl': px(SIZING.pagePad['3xl']),
				'appbar-sm': px(SIZING.appbar.sm),
				'appbar-md': px(SIZING.appbar.md),
				'section-sm': px(SIZING.sectionGap.sm),
				'section-xl': px(SIZING.sectionGap.xl),
				'section-3xl': px(SIZING.sectionGap['3xl']),
				'card-inset': px(SIZING.cardInset),
				'card-badge-inset': px(SIZING.cardBadgeInset),
				'card-outer-top': px(SIZING.cardOuterMeta.top),
				'card-outer-gap': px(SIZING.cardOuterMeta.gap),
				'card-live-top': px(SIZING.cardLiveInfo.top),
				'card-live-gap': px(SIZING.cardLiveInfo.rowGap),
				'progress-h': px(SIZING.progressH),
				'card-live-progress': px(SIZING.cardLiveInfo.progressMargin),
			},
			borderRadius: {
				sm: px(RADIUS.sm),
				md: px(RADIUS.md),
				DEFAULT: px(RADIUS.DEFAULT),
				lg: px(RADIUS.lg),
				xl: px(RADIUS.xl),
			},
			boxShadow: {
				card: SHADOW.card,
				'card-hover': SHADOW.cardHover,
				overlay: SHADOW.overlay,
			},
			zIndex: {
				mask: String(Z.mask),
				rail: String(Z.rail),
				'hero-content': String(Z.heroContent),
				'hero-controls': String(Z.heroControls),
				overlay: String(Z.overlay),
				appbar: String(Z.appbar),
			},
			scale: {
				press: String(SCALE.press),
				'press-lg': String(SCALE.pressLg),
				hover: String(SCALE.hover),
				'hover-md': String(SCALE.hoverMd),
				'hover-lg': String(SCALE.hoverLg),
				'tv-focus': String(SCALE.tvFocus),
			},
			aspectRatio: {
				video: `${ASPECT.video[0]}/${ASPECT.video[1]}`,
				poster: `${ASPECT.poster[0]}/${ASPECT.poster[1]}`,
				'4x3': `${ASPECT.fourByThree[0]}/${ASPECT.fourByThree[1]}`,
				'3x4': `${ASPECT.threeByFour[0]}/${ASPECT.threeByFour[1]}`,
				live: `${ASPECT.live[0]}/${ASPECT.live[1]}`,
				'live-image': `${ASPECT.liveImage[0]}/${ASPECT.liveImage[1]}`,
			},
			transitionDuration: {
				fast: ms(DURATION.fast),
				normal: ms(DURATION.cardHover),
				slow: ms(DURATION.railScroll),
				hero: ms(DURATION.heroSlide),
			},
			fontSize: {
				// Legacy size-only tokens (still used by some components)
				'card-meta': [px(FONT_SIZE['card-meta'][0]), { lineHeight: px(FONT_SIZE['card-meta'][1]) }],
				// Figma typography presets — base (mobile) sizes
				// Desktop overrides are generated automatically by the responsiveTypography plugin
				...Object.fromEntries(
					Object.entries(TYPOGRAPHY).map(([name, token]) => [
						name,
						[px(token.base[0]), { lineHeight: `${token.base[1]}%`, fontWeight: String(token.base[2]) }],
					]),
				),
			},
			keyframes: {
				shimmer: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' },
				},
			},
			animation: {
				shimmer: 'shimmer 1.5s ease-in-out infinite',
			},
			screens: {
				xs: px(BREAKPOINTS.xs),
				'3xl': px(BREAKPOINTS['3xl']),
			},
		},
	},
	plugins: [responsiveTypography],
} satisfies Partial<Config>
