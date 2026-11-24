// ── Color palette (RGB triplets for rgb()/rgba() usage) ──
export const PALETTE = {
	// Base
	black: [0, 0, 0], // Overlay backgrounds, masks
	white: [255, 255, 255], // Foreground text, icon defaults

	// Surfaces — page background and card/section layers
	pageBg: [5, 12, 29], // Page background, AppBar bg, rail arrow bg, MultiviewBadge SVG fill
	surface: [10, 12, 16], // Card surfaces, modals
	surface2: [14, 17, 23], // Elevated surfaces
	surface3: [18, 22, 30], // Highest elevation surfaces

	// Text
	muted: [160, 170, 185], // Secondary text, inactive nav items
	muted2: [120, 130, 145], // Tertiary text, timestamps

	// Brand / semantic
	red: [239, 68, 68], // Primary accent (CTA buttons)
	green: [34, 197, 94], // Success / accent
	blue: [63, 172, 255], // Rail scroll arrows
	live: [212, 16, 58], // #d4103a — verified against the Figma live badge (2040:33102)
	liveGrad1: [55, 54, 70], // Live card gradient start
	liveGrad2: [38, 38, 55], // Live card gradient end
	viewall: [14, 42, 94], // "View all" card fill (#0E2A5E)

	// Extended palette — used sparingly
	emerald: [16, 185, 129],
	amber: [245, 158, 11],
	blue500: [59, 130, 246],
	avatarFallback: [232, 168, 41], // FIXME: verify against Figma — amber tone, was only in preset
	switcherCard: [12, 33, 80], // #0C2150 — inner card behind the store/account columns
	switcherMuted: [175, 175, 175], // #AFAFAF — inactive row label in the switcher
} as const

export const rgb = (triplet: readonly number[], alpha?: number): string =>
	alpha != null ? `rgba(${triplet.join(',')},${alpha})` : `rgb(${triplet.join(',')})`

// ── Spacing (4px base) ──
export const SPACE = {
	0: 0,
	0.5: 2,
	1: 4,
	1.5: 6,
	2: 8,
	2.5: 10,
	3: 12,
	3.5: 14,
	4: 16,
	5: 20,
	6: 24,
	7: 28,
	8: 32,
	10: 40,
	12: 48,
	14: 56,
	16: 64,
	20: 80,
	24: 96,
} as const

// ── Type scale [fontSize, lineHeight] in px ──
export const FONT_SIZE = {
	badge: [12, 14],
	'card-meta': [13, 18],
	'card-title': [15, 20],
	xs: [12, 16],
	sm: [14, 20],
	base: [16, 24],
	lg: [18, 28],
	xl: [20, 28],
	'2xl': [24, 32],
	'3xl': [30, 36],
	'4xl': [36, 40],
	'5xl': [48, 48],
	'6xl': [60, 60],
} as const

// ── Typography presets from Figma ──
// Each token: { base: [fontSize, lineHeight%, fontWeight], md?: [...] }
// `base` = mobile-first (small breakpoint), `md` = desktop override (768px+)
// Usage: just `text-section-title` — responsive scaling is automatic via plugin
export type TypographyTuple = readonly [number, number, number]
export type TypographyToken = { base: TypographyTuple; md?: TypographyTuple }

export const TYPOGRAPHY = {
	'section-title': { base: [20, 120, 700] }, // Rail header
	body: { base: [16, 143, 500] }, // Hero description
	'card-title': { base: [16, 120, 400] }, // Card title
	label: { base: [16, 120, 700] }, // CTA buttons (hero)
	nav: { base: [14, 120, 500] }, // App bar, footer
	caption: { base: [14, 158, 500] }, // Content text next to label
	meta: { base: [14, 120, 400], md: [16, 120, 400] }, // Card meta rows
	link: { base: [15, 158, 500] }, // "View All"
	'card-show': { base: [14, 130, 400], md: [17, 130, 400] }, // Live card show name
	badge: { base: [12, 120, 600], md: [14, 120, 600] }, // Live badge
} as const satisfies Record<string, TypographyToken>

// ── Border radius ──
export const RADIUS = {
	none: 0,
	sm: 4,
	md: 6,
	DEFAULT: 8,
	lg: 12,
	xl: 16,
	full: 9999,
} as const

// ── Z-index (stacking order) ──
export const Z = {
	mask: 5, // Rail edge fade masks
	playerOverlay: 5, // Video player click overlay (below controls)
	rail: 10, // Rail arrows (above cards)
	heroContent: 10, // Hero text/buttons overlay
	playerControls: 10, // Video player bottom bar
	playerGhost: 20, // Video player ghost play/pause icon
	heroControls: 20, // Hero arrows/dots (above content)
	playerMenu: 30, // Video player quality/speed/CC menus
	overlay: 40, // Modal/dialog overlays
	playerError: 40, // Video player error overlay
	appbar: 50, // AppBar (always on top)
} as const

// ── Interactive scale transforms ──
export const SCALE = {
	press: 0.98, // Button press feedback
	pressLg: 0.97, // Card press feedback
	hover: 1.03, // Card hover (default)
	hoverMd: 1.04, // Card hover (medium)
	hoverLg: 1.07, // Card hover (large — hero cards)
	tvFocus: 1.08, // TV D-pad focus ring scale
	heroEnter: 1.01, // Hero slide enter animation
	heroExit: 0.99, // Hero slide exit animation
} as const

// ── Aspect ratios ──
// video: standard cards, hero, image defaults
// poster: poster cards, live card inline poster image
// fourByThree / threeByFour: MK feeds whose ShowcardAspectRatio declares 4x3 or 3x4
// live: live card side-by-side layout (web md:, TV)
export const ASPECT = {
	video: [16, 9] as const,
	poster: [2, 3] as const,
	fourByThree: [4, 3] as const,
	threeByFour: [3, 4] as const,
	live: [368, 208] as const,
	liveImage: [120, 176] as const,
}

// ── Fixed sizing ──
export const SIZING = {
	// Hero carousel
	heroMaxH: 620, // Hero section max height
	heroMinH: 320, // Hero section min height
	heroSynopsisMaxW: { sm: 320, md: 400 }, // Synopsis text max-width per breakpoint

	// Progress bars
	progressH: 3, // Default progress bar height (ProgressBar)
	progressLiveH: 4, // Live card progress bar height

	// AppBar height — used by AppBar (.native/.tv/.web), Hero negative margin, MobileSidebar top offset
	appbar: { sm: 50, md: 88 },

	// Page horizontal padding — used by AppBar, Hero Content, BrandingLogo, PageContent, Footer (web)
	pagePad: { sm: 28, lg: 48, xl: 72, '3xl': 101 },

	// Card overlay inset — distance from card edge for absolutely positioned overlay content
	// Used by: Metadata, LiveInfo, DateBadge (.web/.native/.tv)
	cardInset: 12,

	// Card badge inset — tighter inset for small badges near card edge
	// Used by: MultiviewBadge (.web/.native)
	cardBadgeInset: 4,

	// Card outer metadata — spacing below the card image (title, subtitle rows)
	// Used by: OuterMeta (.web/.native)
	cardOuterMeta: { top: 12, gap: 8 },

	// Card live info — spacing inside the live overlay (badge, channel, show, progress)
	// Used by: LiveInfo (.web/.native), LiveCardContent (.web/.native/.tv)
	// progressMargin + rowGap = 24px (Figma spec)
	cardLiveInfo: { top: 10, rowGap: 8, progressMargin: 16 },

	// Section vertical gap between rails
	sectionGap: { sm: 51, xl: 64, '3xl': 72 },
} as const

// ── Glass effect (iOS 26 Liquid Glass) ──
// Used by GlassBackground primitive on native; ignored on web/TV.
// Single theme (dark) for now — light values go here when theming ships.
export const GLASS = {
	tint: 'rgba(255,255,255,0.35)',
	idle: 'rgba(0,0,0,0.08)',
	pressed: 'rgba(0,0,0,0.18)',
	fallbackBg: 'rgba(255,255,255,0.10)',
} as const

// ── Shadows ──
export const SHADOW = {
	card: '0 2px 8px rgba(0,0,0,0.3)', // Default card resting shadow
	cardHover: '0 8px 24px rgba(0,0,0,0.5)', // Card hover/focus elevated shadow
	overlay: '0 4px 16px rgba(0,0,0,0.6)', // Modal/dialog overlay shadow
} as const
