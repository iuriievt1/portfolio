import { use } from 'react'
import { TracksContext, type TracksState } from '../context'

export function useTracks(): TracksState {
	const ctx = use(TracksContext)
	if (!ctx) throw new Error('useTracks must be used within <VideoPlayer>')
	return ctx
}
