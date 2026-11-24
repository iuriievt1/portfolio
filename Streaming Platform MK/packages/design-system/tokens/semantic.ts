// packages/design-system/tokens/semantic.ts
import { PALETTE } from './primitives.ts'

export const COLOR = {
	bgPage: PALETTE.pageBg,
	bgSurface: PALETTE.surface,
	bgSurface2: PALETTE.surface2,
	bgSurface3: PALETTE.surface3,
	textPrimary: PALETTE.white,
	textMuted: PALETTE.muted,
	textMuted2: PALETTE.muted2,
	accent: PALETTE.green,
	destructive: PALETTE.red,
	interactive: PALETTE.blue,
	live: PALETTE.live,
	overlay: PALETTE.black,
	/** TV focus ring border color (blue glow) */
	focusRing: PALETTE.blue,
} as const
