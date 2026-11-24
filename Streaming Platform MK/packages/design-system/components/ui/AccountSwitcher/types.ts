export type AccountSwitcherItem = {
	id: string
	name: string
	/** Two-letter fallback shown when the item has no avatar image. */
	initials: string
	/**
	 * Picture belonging to this account. MK returns no avatars, so it comes from
	 * env config — on the demo only the fxdigital account has one.
	 */
	avatarUrl?: string
	/** Identity could not be resolved — dead or expired token. Rendered dimmed. */
	unresolved?: boolean
}

export type AccountSwitcherSection = {
	/** Column heading, e.g. "Stores" or "Accounts". */
	title: string
	items: AccountSwitcherItem[]
	activeId: string | null
	/** Keeps the column (and the divider) in place with placeholder rows while its list loads. */
	loading?: boolean
	/**
	 * `stores` badges each row with its position (#1, #2); `accounts` shows the
	 * avatar image or initials. Per Figma the two render as separate columns.
	 */
	variant: 'stores' | 'accounts'
}

export type AccountSwitcherProps = {
	open: boolean
	/** Rendered left to right in order. Figma puts Stores first, then Accounts. */
	sections: AccountSwitcherSection[]
	/** Id of the item being switched to — shows a spinner and locks every row. */
	switchingId?: string | null
	/** Trigger rect the panel anchors to. The panel is portalled, so it needs viewport coords. */
	anchorRect?: { bottom: number; right: number } | null
	onSelect: (id: string) => void
	onClose: () => void
	className?: string
}
