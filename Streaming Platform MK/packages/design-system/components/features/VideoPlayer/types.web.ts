import type { MKSourceConfig, MKTweaksConfig } from '@mediakind/mkplayer'

export type PlayerError = {
	title: string
	description?: string
	code?: string
}

export type ActiveMenu = 'quality' | 'speed' | 'cc' | 'audio' | null

export type VideoPlayerProps = {
	source: MKSourceConfig
	title?: string
	poster?: string
	/** Fallback HLS URL when AMP is geo-blocked */
	hlsUrl?: string
	className?: string
	children: React.ReactNode
	/** Called when a fatal playback error occurs */
	onError?: () => void
	/** SDK tweaks applied at player creation (see `MKTweaksConfig`). */
	tweaks?: MKTweaksConfig
}
