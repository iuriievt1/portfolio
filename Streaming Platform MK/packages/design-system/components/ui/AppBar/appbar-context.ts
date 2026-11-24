'use client'

import { createContext, useContext } from 'react'

/** Viewport coords the portalled account panel anchors to. */
export type AppBarAnchorRect = { bottom: number; right: number }

/**
 * What the right-hand slot knows about the signed-in account. Only it receives the
 * account list, so it reports this up for the sidebar's user card to render the same
 * identity the app bar trigger shows.
 */
export type AppBarAccountSummary = {
	/** False when there is nothing to switch between — the card stays inert. */
	canSwitch: boolean
	name?: string
	initials?: string
	avatarUrl?: string
	/** Identity could not be resolved — dead or expired token. */
	unresolved?: boolean
}

export const NO_ACCOUNT: AppBarAccountSummary = { canSwitch: false }

type AppBarContextValue = {
	searchOpen: boolean
	toggleSearch: () => void
	closeSearch: () => void
	avatarUrl?: string
	/**
	 * The account switcher is opened from two places — the app bar avatar above the
	 * nav breakpoint, the sidebar's user card below it — so its state lives here
	 * rather than in either trigger.
	 */
	accountMenuOpen: boolean
	accountMenuAnchor: AppBarAnchorRect | null
	account: AppBarAccountSummary
	setAccount: (account: AppBarAccountSummary) => void
	/** Opens the panel anchored to the passed rect, or closes it when already open. */
	toggleAccountMenu: (anchor: AppBarAnchorRect | null) => void
	/** Keeps an open panel glued to its trigger as the page scrolls or resizes. */
	setAccountMenuAnchor: (anchor: AppBarAnchorRect) => void
	closeAccountMenu: () => void
	/** Width the app bar measured for the expanded search; null until it has measured. */
	searchPillWidth?: number | null
	/** The inline nav did not fit and folded into the sidebar — the account trigger goes with it. */
	navCollapsed?: boolean
}

export const AppBarContext = createContext<AppBarContextValue>({
	searchOpen: false,
	toggleSearch: () => {},
	closeSearch: () => {},
	accountMenuOpen: false,
	accountMenuAnchor: null,
	account: NO_ACCOUNT,
	setAccount: () => {},
	toggleAccountMenu: () => {},
	setAccountMenuAnchor: () => {},
	closeAccountMenu: () => {},
})

export const useAppBar = () => useContext(AppBarContext)
