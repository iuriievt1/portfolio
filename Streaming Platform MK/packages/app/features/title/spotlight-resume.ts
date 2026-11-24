// Carrying the playhead across a spotlight switch. Switching spotlight reloads the stream, and a
// reloaded recording starts from the top — which throws the viewer back to the beginning instead
// of showing the same moment from the new angle.

export type ResumeVerdict =
	/** The reloaded stream is not ready to be moved yet. */
	| { action: 'wait' }
	| { action: 'seek'; time: number }
	/** Nothing left to restore — forget the remembered position. */
	| { action: 'drop' }

export type ResumeState = {
	/** Playhead remembered from the variant that was playing, or null when there is nothing to restore. */
	pending: number | null
	isLive: boolean
	isPlaying: boolean
	/** Playhead of the freshly loaded variant. */
	currentTime: number
}

/**
 * What to do with the remembered playhead once the new variant starts.
 *
 * Live is left alone: it resumes at the edge, which is where a live viewer expects to be, and the
 * two variants' sliding windows need not line up.
 *
 * On a recording the restore waits for proof that the reloaded stream is genuinely running from
 * the top — a playhead both past zero and short of the target. Anything else keeps waiting,
 * because for a beat after the switch the playhead still reads from the player being torn down,
 * and that stale value sits exactly at the target we are trying to return to.
 */
export function spotlightResume({ pending, isLive, isPlaying, currentTime }: ResumeState): ResumeVerdict {
	if (pending == null) return { action: 'wait' }
	if (isLive || pending <= 0) return { action: 'drop' }
	if (!isPlaying || currentTime <= 0 || currentTime >= pending) return { action: 'wait' }

	return { action: 'seek', time: pending }
}
