'use client'

import { createContext } from 'react'
import type { ActiveMenu } from './types'

// ── Shared across all platforms (web, native, tizen) ──
// Only PlayerState + PlayerContext differ per platform.

export interface PlaybackState {
	isPlaying: boolean
	currentTime: number
	duration: number
	isLive: boolean
	canSeek: boolean
	isBuffering: boolean
	play: () => void
	pause: () => void
	seek: (time: number) => void
}
export const PlaybackContext = createContext<PlaybackState | null>(null)

export interface VolumeState {
	volume: number
	isMuted: boolean
	setVolume: (v: number) => void
	toggleMute: () => void
}
export const VolumeContext = createContext<VolumeState | null>(null)

export interface VideoQualityOption {
	id: string
	label: string
	height: number
	width: number
	bitrate: number
}

export interface AudioTrackOption {
	id: string
	label: string
	lang: string
	isAudioDescription: boolean
	/** Mosaic feed this track belongs to (`A`), when the stream is a multiview. */
	feedKey?: string
}

export interface SubtitleTrackOption {
	id: string
	label: string
	lang: string
	isCC: boolean
	enabled: boolean
}

export interface SubtitleCue {
	id: string
	text: string
	html?: string
}

export interface TracksState {
	videoQualities: VideoQualityOption[]
	audioTracks: AudioTrackOption[]
	subtitleTracks: SubtitleTrackOption[]
	activeCues: SubtitleCue[]
	selectedQualityId: string | null
	selectedAudioId: string | null
	playbackSpeed: number
	setQuality: (id: string | null) => void
	setAudioTrack: (id: string) => void
	enableSubtitle: (id: string | null) => void
	setSpeed: (speed: number) => void
}
export const TracksContext = createContext<TracksState | null>(null)

export interface ControlsState {
	visible: boolean
	activeMenu: ActiveMenu
	isFullscreen: boolean
	showControls: () => void
	hideControls: () => void
	openMenu: (menu: ActiveMenu) => void
	closeMenu: () => void
	toggleFullscreen: () => void
}
export const ControlsContext = createContext<ControlsState | null>(null)
