import { use } from 'react'
import {
	type RailContextValue,
	type RailDisplay,
	RailDisplayContext,
	RailFocusContext,
	type RailFocusState,
	RailHoverContext,
	type RailHoverState,
	type RailMeta,
	RailMetaContext,
} from '../context'
import type { CardAspect } from '../types'

export function useRailMeta(): RailMeta {
	const ctx = use(RailMetaContext)
	if (!ctx) throw new Error('useRailMeta must be used within <Rail>')
	return ctx
}

/**
 * Card shape for a frame whose variant has no fixed one. The rail's `aspect` wins, so a
 * feed declaring `FourByThree` renders 4x3 cards; outside a `<Rail>` (the View All grid
 * renders bare `<Card>`s) the variant's own shape stands.
 */
export function useCardAspect(fallback: CardAspect): CardAspect {
	return use(RailMetaContext)?.aspect ?? fallback
}

export function useRailFocus(): RailFocusState {
	const ctx = use(RailFocusContext)
	if (!ctx) throw new Error('useRailFocus must be used within <Rail>')
	return ctx
}

export function useRailHover(): RailHoverState {
	const ctx = use(RailHoverContext)
	if (!ctx) throw new Error('useRailHover must be used within <Rail>')
	return ctx
}

export function useRailDisplay(): RailDisplay {
	return use(RailDisplayContext)
}

/** Legacy convenience — subscribes to all. Prefer useRailFocus/useRailHover. */
export function useRailState() {
	const focus = useRailFocus()
	const hover = useRailHover()
	return {
		state: { focusedIndex: focus.focusedIndex, hovered: hover.hovered },
		actions: { setFocusedIndex: focus.setFocusedIndex, setHovered: hover.setHovered },
	}
}

export function useRail(): RailContextValue {
	const { state, actions } = useRailState()
	return { state, actions, meta: useRailMeta() }
}
