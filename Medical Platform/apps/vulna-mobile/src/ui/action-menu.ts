import colors from "../styles/colors.json"

export const MENU_SYMBOL = {
	MORE: "ellipsis",
	DISCARD: "trash",
	MOVE: "arrow.left.arrow.right",
	CHANGE: "arrow.triangle.2.circlepath",
} as const

type MenuSymbol = (typeof MENU_SYMBOL)[keyof typeof MENU_SYMBOL]

export const MENU_LOOK = {
	SHEET: "sheet",
	ROW: "row",
	BRAND: "brand",
} as const

export type MenuLook = (typeof MENU_LOOK)[keyof typeof MENU_LOOK]

export interface MenuAction {
	key: string
	label: string
	symbol: MenuSymbol
	isDestructive: boolean
	unavailableReason: string | undefined
	onSelect: () => void
}

export interface ActionMenuProps {
	label: string
	look: MenuLook
	actions: readonly MenuAction[]
}

export const MENU_TRIGGER_SIZE = 44
export const MENU_SYMBOL_SIZE = 17

interface TriggerStyle {
	color: string
	surface: string | undefined
}

// HIG-09, Vulna / Native / Sheet title bar
export const MENU_TRIGGER_STYLE: Readonly<Record<MenuLook, TriggerStyle>> = {
	[MENU_LOOK.SHEET]: { color: colors.foreground, surface: colors.secondary },
	[MENU_LOOK.ROW]: { color: colors["muted-foreground"], surface: undefined },
	[MENU_LOOK.BRAND]: { color: colors["primary-foreground"], surface: undefined },
}
