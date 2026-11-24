import { use } from 'react'
import { PlayerContext, type PlayerState } from '../context'

export function usePlayer(): PlayerState {
	const ctx = use(PlayerContext)
	if (!ctx) throw new Error('usePlayer must be used within <VideoPlayer>')
	return ctx
}
