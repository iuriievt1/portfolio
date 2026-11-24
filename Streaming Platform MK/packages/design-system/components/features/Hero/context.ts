'use client'

import { createContext } from 'react'

export interface HeroState {
	active: number
	progressKey: number
	direction: 1 | -1
	isHovered: boolean
	showControls: boolean
}

export interface HeroActions {
	goTo: (idx: number) => void
	setIsHovered: (v: boolean) => void
}

export interface HeroMeta {
	count: number
	autoPlayMs: number
}

export interface HeroContextValue {
	state: HeroState
	actions: HeroActions
	meta: HeroMeta
}

// Split contexts by update frequency:
// MetaContext  — cold (count, autoPlayMs never change per mount)
// StateContext — hot  (active, progressKey, direction, isHovered change on interaction)
export const HeroMetaContext = createContext<HeroMeta | null>(null)
export const HeroStateContext = createContext<{ state: HeroState; actions: HeroActions } | null>(null)
