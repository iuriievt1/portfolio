'use client'

import { usePlayer } from '@pkg/design-system'
import { useEffect } from 'react'
import { type HlsAudioRendition, parseHlsAudioRenditions } from './hls-audio-renditions'

// Dev-only spike for #84. Renders nothing and does nothing unless the page is opened with
// `?debugAudioRenditions`. It answers one question: can we reach each mosaic feed's audio as its
// own HLS playlist? If yes, a feed switch could crossfade pre-buffered audio elements instead of
// flushing the SDK's audio buffer — which is what makes the picture freeze today.

const FLAG = 'debugAudioRenditions'
const PREFIX = '[MULTIVIEW-PROBE]'

/** Manifest may not be ready the moment the source loads; retry for a few seconds. */
const POLL_MS = 500
const MAX_POLLS = 20

type ManifestCapable = { manifest?: { getManifest?: () => string } }

function isEnabled(): boolean {
	if (typeof window === 'undefined') return false
	return new URLSearchParams(window.location.search).has(FLAG)
}

/** Every `.m3u8` the SDK has fetched so far — the master is the first one. */
function manifestUrlsSeen(): string[] {
	if (typeof performance === 'undefined') return []
	try {
		return performance
			.getEntriesByType('resource')
			.map((entry) => entry.name)
			.filter((name) => name.includes('.m3u8'))
	} catch (err) {
		console.warn(PREFIX, 'resource timings unavailable', err)
		return []
	}
}

async function probeRendition(rendition: HlsAudioRendition): Promise<void> {
	try {
		const response = await fetch(rendition.uri)
		const body = response.ok ? await response.text() : ''
		console.log(PREFIX, `rendition ${rendition.name || rendition.lang}`, {
			uri: rendition.uri,
			status: response.status,
			// A real media playlist has segments; anything else means we got an error or a redirect page.
			segments: (body.match(/#EXTINF:/g) ?? []).length,
			independentlyPlayable: response.ok && body.includes('#EXTINF:'),
		})
	} catch (err) {
		// A CORS rejection lands here — it would rule the whole approach out.
		console.warn(PREFIX, `rendition ${rendition.name || rendition.lang} not fetchable`, rendition.uri, err)
	}
}

async function runProbe(manifest: string, masterUrl: string): Promise<void> {
	const renditions = parseHlsAudioRenditions(manifest, masterUrl)

	console.log(PREFIX, 'master manifest', { masterUrl, bytes: manifest.length })
	console.log(PREFIX, `${renditions.length} audio rendition(s) with a standalone playlist`, renditions)

	if (renditions.length === 0) {
		console.warn(PREFIX, 'no standalone audio playlists — decoupled audio is not possible on this stream')
		console.log(PREFIX, 'manifest follows for inspection\n', manifest)
		return
	}

	await Promise.all(renditions.map(probeRendition))
}

/** Logs the mosaic's audio renditions and whether each one is fetchable on its own. */
export function AudioRenditionProbe() {
	const { player } = usePlayer()

	useEffect(() => {
		if (!player || !isEnabled()) return

		let polls = 0
		const timer = setInterval(() => {
			polls += 1

			const manifest = (player as ManifestCapable).manifest?.getManifest?.()
			const masterUrl = manifestUrlsSeen()[0]

			if (!manifest || !masterUrl) {
				if (polls >= MAX_POLLS) {
					clearInterval(timer)
					console.warn(PREFIX, 'gave up waiting for the manifest', {
						hasManifestApi: typeof (player as ManifestCapable).manifest?.getManifest === 'function',
						manifestUrlsSeen: manifestUrlsSeen(),
					})
				}
				return
			}

			clearInterval(timer)
			console.log(PREFIX, 'playlists fetched so far', manifestUrlsSeen())
			void runProbe(manifest, masterUrl)
		}, POLL_MS)

		return () => clearInterval(timer)
	}, [player])

	return null
}
