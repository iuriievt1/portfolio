'use client'

import type { MKPlayer } from '@mediakind/mkplayer'
import { createContext } from 'react'
import type { PlayerError } from './types'

// Re-export all shared context (PlaybackState, VolumeState, TracksState, ControlsState, etc.)
export * from './context.shared'

// ── Web-specific: MKPlayer instance + container ref ──
export interface PlayerState {
	player: MKPlayer | null
	containerRef: React.RefObject<HTMLDivElement | null>
	wrapperRef: React.RefObject<HTMLDivElement | null>
	error: PlayerError | null
}
export const PlayerContext = createContext<PlayerState | null>(null)
