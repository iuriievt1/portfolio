import type { MKSubtitleTrack } from '@mediakind/mkplayer'
import { formatLanguageName, isLanguageTag } from './language-names'

const TECHNICAL_SUBTITLE_LABEL_PATTERN = /^text\d+$/i

function isTechnicalSubtitleLabel(label: string): boolean {
	return TECHNICAL_SUBTITLE_LABEL_PATTERN.test(label.trim())
}

export function formatSubtitleTrackLabel(track: Pick<MKSubtitleTrack, 'label' | 'lang'>): string {
	const label = track.label?.trim() ?? ''
	const lang = track.lang?.trim() ?? ''
	// Fall back to the label when it is itself a code (`FRA`) and the manifest carries no language.
	const languageName = formatLanguageName(lang) ?? (isLanguageTag(label) ? formatLanguageName(label) : undefined)

	if (languageName && (!label || isTechnicalSubtitleLabel(label) || isLanguageTag(label))) {
		return languageName
	}

	if (isTechnicalSubtitleLabel(label)) return languageName || 'Subtitles'

	return label || languageName || lang || 'Subtitles'
}
