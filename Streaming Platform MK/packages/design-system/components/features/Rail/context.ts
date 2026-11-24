'use client'

import { createContext } from 'react'
import type { CardAspect, RailVariant } from './types'

export interface RailMeta {
	railId: string
	variant: RailVariant
	/** Card shape override for every card in the rail; unset = the variant's own shape. */
	aspect?: CardAspect
	showCardTitle?: boolean
}

export interface RailFocusState {
	focusedIndex: number
	setFocusedIndex: (i: number) => void
}

export interface RailHoverState {
	hovered: boolean
	setHovered: (v: boolean) => void
}

// Split contexts by consumer:
// MetaContext  — cold (never changes per mount)
// FocusContext — Card.tv + Title.tv
// HoverContext — Cards.web (arrow visibility)
export const RailMetaContext = createContext<RailMeta | null>(null)
export const RailFocusContext = createContext<RailFocusState | null>(null)
export const RailHoverContext = createContext<RailHoverState | null>(null)

// --- Display visibility ---

export type DisplayVisibility = 'always' | 'hover' | 'hidden'

export interface RailDisplay {
	title: DisplayVisibility
	metadata: DisplayVisibility
	badges: DisplayVisibility
	gradient: DisplayVisibility
	progress: DisplayVisibility
}

// Every variant shows its title under the card; a rail can still override via `RailData.display`.
export const VARIANT_DISPLAY_DEFAULTS: Record<import('./types').RailVariant, RailDisplay> = {
	backdrop: { title: 'always', metadata: 'hidden', badges: 'always', gradient: 'always', progress: 'hidden' },
	poster: { title: 'always', metadata: 'hidden', badges: 'always', gradient: 'hidden', progress: 'hidden' },
	character: { title: 'always', metadata: 'hidden', badges: 'always', gradient: 'hidden', progress: 'hidden' },
	continue: { title: 'always', metadata: 'always', badges: 'always', gradient: 'always', progress: 'always' },
	live: { title: 'always', metadata: 'always', badges: 'always', gradient: 'always', progress: 'always' },
	schedule: { title: 'always', metadata: 'hidden', badges: 'always', gradient: 'hidden', progress: 'hidden' },
	highlights: { title: 'always', metadata: 'always', badges: 'hidden', gradient: 'hidden', progress: 'hidden' },
	multiview: { title: 'always', metadata: 'always', badges: 'always', gradient: 'hidden', progress: 'hidden' },
	sponsored: { title: 'always', metadata: 'always', badges: 'hidden', gradient: 'hidden', progress: 'hidden' },
}

export const RailDisplayContext = createContext<RailDisplay>(VARIANT_DISPLAY_DEFAULTS.backdrop)

// Legacy combined types for backwards compat
export type RailState = { focusedIndex: number; hovered: boolean }
export type RailActions = { setFocusedIndex: (i: number) => void; setHovered: (v: boolean) => void }
export type RailContextValue = { state: RailState; actions: RailActions; meta: RailMeta }
