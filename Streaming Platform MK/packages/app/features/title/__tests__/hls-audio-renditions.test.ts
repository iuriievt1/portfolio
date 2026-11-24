import { describe, expect, it } from 'vitest'
import { parseHlsAudioRenditions } from '../hls-audio-renditions'

const BASE = 'https://cdn.example.net/clear/tenant1_engage_fx/index.m3u8?userAccount=demo%24tenant1'

// Shape taken from a real Engage master playlist (see the captured HAR for #84).
const MASTER = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac-128",NAME="eng_A",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="eng",CHANNELS="2",URI="audio300_134826.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac-128",NAME="spa_A",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="spa",CHANNELS="2",URI="audio301_134826.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="eng",URI="subs_eng.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=3049761,RESOLUTION=960x540,CODECS="avc1.64001F,mp4a.40.5",AUDIO="aac-128"
video_2600000.m3u8`

describe('parseHlsAudioRenditions', () => {
	it('reads the audio renditions and resolves their playlists against the master URL', () => {
		const renditions = parseHlsAudioRenditions(MASTER, BASE)

		expect(renditions).toEqual([
			{
				groupId: 'aac-128',
				name: 'eng_A',
				lang: 'eng',
				isDefault: true,
				channels: '2',
				uri: 'https://cdn.example.net/clear/tenant1_engage_fx/audio300_134826.m3u8',
			},
			{
				groupId: 'aac-128',
				name: 'spa_A',
				lang: 'spa',
				isDefault: false,
				channels: '2',
				uri: 'https://cdn.example.net/clear/tenant1_engage_fx/audio301_134826.m3u8',
			},
		])
	})

	it('ignores non-audio media tags', () => {
		expect(parseHlsAudioRenditions(MASTER, BASE).map((r) => r.name)).not.toContain('English')
	})

	it('keeps commas that sit inside a quoted attribute value', () => {
		const manifest = '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="g",NAME="Feed A, English",LANGUAGE="eng",URI="a.m3u8"'
		const [rendition] = parseHlsAudioRenditions(manifest, BASE)

		expect(rendition?.name).toBe('Feed A, English')
		expect(rendition?.uri).toBe('https://cdn.example.net/clear/tenant1_engage_fx/a.m3u8')
	})

	it('skips renditions muxed into the video variants — they have no playlist to pre-buffer', () => {
		const manifest = '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="g",NAME="Muxed",LANGUAGE="eng",DEFAULT=YES'

		expect(parseHlsAudioRenditions(manifest, BASE)).toEqual([])
	})

	it('keeps an absolute rendition URI as-is', () => {
		const manifest = '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="g",NAME="A",LANGUAGE="eng",URI="https://other.net/a.m3u8"'

		expect(parseHlsAudioRenditions(manifest, BASE)[0]?.uri).toBe('https://other.net/a.m3u8')
	})

	it('returns nothing for a media playlist, an empty manifest or a missing base URL', () => {
		const mediaPlaylist = '#EXTM3U\n#EXT-X-TARGETDURATION:3\n#EXTINF:2.005333,\nsegment-t_0.m4s'

		expect(parseHlsAudioRenditions(mediaPlaylist, BASE)).toEqual([])
		expect(parseHlsAudioRenditions('', BASE)).toEqual([])
		expect(parseHlsAudioRenditions(MASTER, '')).toEqual([])
	})
})
