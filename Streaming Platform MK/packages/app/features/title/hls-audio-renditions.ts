// Spike support for #84: parse the audio renditions out of an HLS master playlist, so we can see
// whether the mosaic's per-feed audio is reachable as standalone playlists. If it is, a feed switch
// could crossfade between pre-buffered audio elements instead of stalling the SDK's audio buffer.

/** One `#EXT-X-MEDIA:TYPE=AUDIO` entry from a master playlist. */
export type HlsAudioRendition = {
	groupId: string
	name: string
	lang: string
	isDefault: boolean
	channels?: string
	/** Absolute URL of the rendition's media playlist. */
	uri: string
}

/** Split an EXT-X tag's attribute list, keeping commas that sit inside quoted values. */
function splitAttributes(line: string): string[] {
	const parts: string[] = []
	let current = ''
	let quoted = false

	for (const char of line) {
		if (char === '"') {
			quoted = !quoted
			current += char
			continue
		}
		if (char === ',' && !quoted) {
			parts.push(current)
			current = ''
			continue
		}
		current += char
	}
	parts.push(current)

	return parts.filter((part) => part.trim() !== '')
}

function parseAttributes(line: string): Record<string, string> {
	const attributes: Record<string, string> = {}

	for (const part of splitAttributes(line)) {
		const separator = part.indexOf('=')
		if (separator === -1) continue
		const key = part.slice(0, separator).trim().toUpperCase()
		const raw = part.slice(separator + 1).trim()
		attributes[key] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
	}

	return attributes
}

function resolve(uri: string, baseUrl: string): string | null {
	try {
		return new URL(uri, baseUrl).toString()
	} catch (err) {
		console.warn('[MULTIVIEW-PROBE] could not resolve rendition URI', { uri, baseUrl, err })
		return null
	}
}

/**
 * Read the `TYPE=AUDIO` renditions from an HLS master playlist.
 * Renditions without a `URI` are muxed into the video variants and are skipped — there is no
 * standalone playlist to pre-buffer for those.
 */
export function parseHlsAudioRenditions(manifest: string, baseUrl: string): HlsAudioRendition[] {
	if (!manifest || !baseUrl) return []

	const renditions: HlsAudioRendition[] = []

	for (const line of manifest.split(/\r?\n/)) {
		const trimmed = line.trim()
		if (!trimmed.startsWith('#EXT-X-MEDIA:')) continue

		const attributes = parseAttributes(trimmed.slice('#EXT-X-MEDIA:'.length))
		if (attributes.TYPE !== 'AUDIO' || !attributes.URI) continue

		const uri = resolve(attributes.URI, baseUrl)
		if (!uri) continue

		renditions.push({
			groupId: attributes['GROUP-ID'] ?? '',
			name: attributes.NAME ?? '',
			lang: attributes.LANGUAGE ?? '',
			isDefault: attributes.DEFAULT === 'YES',
			...(attributes.CHANNELS ? { channels: attributes.CHANNELS } : {}),
			uri,
		})
	}

	return renditions
}
