export type AppBarItem = {
	label: string
	href: string
}

export type AppBarProps = {
	brand?: {
		label: string
		href?: string
		logo?: React.ReactNode
	}
	items?: AppBarItem[]
	right?: React.ReactNode
	className?: string
	isActive?: (href: string) => boolean
	avatarUrl?: string
	/** Pass current pathname to auto-close search on navigation */
	pathname?: string
}
