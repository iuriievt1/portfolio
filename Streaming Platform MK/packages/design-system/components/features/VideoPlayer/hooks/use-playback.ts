import { use } from 'react'
import { PlaybackContext, type PlaybackState } from '../context'

export function usePlayback(): PlaybackState {
	const ctx = use(PlaybackContext)
	if (!ctx) throw new Error('usePlayback must be used within <VideoPlayer>')
	return ctx
}
