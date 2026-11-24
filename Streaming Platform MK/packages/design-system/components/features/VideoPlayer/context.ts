'use client'

import type { MKPlayer } from '@mediakind/mkplayer'
import { createContext } from 'react'
import type { ActiveMenu, PlayerError } from './types'

// ── Stable after init ──
export interface PlayerState {
	player: MKPlayer | null
	containerRef: React.RefObject<HTMLDivElement | null>
	wrapperRef: React.RefObject<HTMLDivElement | null>
	error: PlayerError | null
}
export const PlayerContext = createContext<PlayerState | null>(null)

// ── Updates on play/pause/seek/timechange ──
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

// ── Updates on volume/mute only ──
export interface VolumeState {
	volume: number
	isMuted: boolean
	setVolume: (v: number) => void
	toggleMute: () => void
}
export const VolumeContext = createContext<VolumeState | null>(null)

// ── Updates on track/quality changes ──
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

// ── Updates on mouse activity / menu toggle ──
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
