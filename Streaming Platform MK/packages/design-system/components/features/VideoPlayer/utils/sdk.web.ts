import type {
	MKAudioTrack,
	MKPlayer,
	MKPlayerConfig,
	MKSubtitleTrack,
	MKTweaksConfig,
	MKVideoQuality,
} from '@mediakind/mkplayer'

/**
 * Runtime shape of the MKPlayer instance.
 * The types-only package (`@mediakind/mkplayer`) does not expose `on`/`off` or
 * several runtime methods, so we extend the type here for all providers to share.
 */
export type PlayerRuntime = MKPlayer & {
	on: (event: string, cb: (...args: unknown[]) => void) => void
	off: (event: string, cb: (...args: unknown[]) => void) => void
	getAvailableVideoQualities: () => MKVideoQuality[]
	getVideoQuality: () => MKVideoQuality
	setVideoQuality: (id: string) => void
	getAvailableAudio: () => MKAudioTrack[]
	getAudio: () => MKAudioTrack | null
	setAudio: (id: string) => void
	subtitles: {
		list: () => MKSubtitleTrack[]
		add: (subtitle: MKSubtitleTrack) => void
		remove: (id: string) => void
		enable: (id: string, exclusive?: boolean) => void
		disable: (id: string) => void
	}
	setPlaybackSpeed: (speed: number) => void
	getPlaybackSpeed: () => number
	getThumbnail: (time: number) => { url: string; x: number; y: number; width: number; height: number } | null
	getVideoElement: () => HTMLVideoElement | null
}

/** Global mkplayer namespace loaded via <script> tag in layout.tsx */
declare const mkplayer: {
	MKPlayer: new (container: HTMLElement, config: MKPlayerConfig) => MKPlayer
}

/** Wait for the global mkplayer SDK to be available (script may still be loading). */
export function waitForSdk(timeoutMs = 10_000): Promise<void> {
	if (typeof mkplayer !== 'undefined') return Promise.resolve()
	return new Promise((resolve, reject) => {
		const start = Date.now()
		const check = () => {
			if (typeof mkplayer !== 'undefined') return resolve()
			if (Date.now() - start > timeoutMs) return reject(new Error('MKPlayer SDK did not load within timeout'))
			setTimeout(check, 100)
		}
		check()
	})
}

/** Create an MKPlayer instance with custom UI (no SDK default controls). */
export function createPlayer(container: HTMLElement, tweaks?: MKTweaksConfig): MKPlayer {
	const analyticsKey = process.env.NEXT_PUBLIC_MKPLAYER_ANALYTICS_KEY
	const config: MKPlayerConfig = {
		key: process.env.NEXT_PUBLIC_MKPLAYER_KEY ?? '',
		ui: false,
		log: { level: 'off' as NonNullable<MKPlayerConfig['log']>['level'] },
		enableSubtitleOverlay: false,
		playback: {
			muted: false,
			autoplay: true,
		},
		...(tweaks ? { tweaks } : {}),
		...(analyticsKey ? { analytics: { key: analyticsKey } } : {}),
	}
	return new mkplayer.MKPlayer(container, config)
}

/** Autoplay once a source loads; if blocked (browsers require a gesture for sound), mute and retry. */
export async function attemptAutoplay(player: { play: () => unknown; mute?: () => void }): Promise<void> {
	try {
		await Promise.resolve(player.play())
	} catch {
		// Expected: browsers block unmuted autoplay without a gesture. Only the muted
		// retry below is a real failure worth logging.
		try {
			player.mute?.()
			await Promise.resolve(player.play())
		} catch (err) {
			console.warn('[PLAYBACK] autoplay blocked even when muted', err)
		}
	}
}

/** Extract a human-readable message from SDK errors (which are plain objects, not Error). */
export function formatSdkError(err: unknown): string {
	if (err instanceof Error) return err.message
	if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
	return String(err)
}
