import colors from "../../styles/colors.json"

export const ICON_LOOK = {
	TILE: "tile",
	SECTION: "section",
	FEEDBACK: "feedback",
	FEEDBACK_ON_DARK: "feedback_on_dark",
} as const

export type IconLook = (typeof ICON_LOOK)[keyof typeof ICON_LOOK]

export const ICON_LOOK_STYLE: Record<IconLook, { size: number; color: string }> = {
	[ICON_LOOK.TILE]: { size: 24, color: colors.foreground },
	[ICON_LOOK.SECTION]: { size: 24, color: colors.foreground },
	[ICON_LOOK.FEEDBACK]: { size: 40, color: colors["muted-foreground"] },
	[ICON_LOOK.FEEDBACK_ON_DARK]: { size: 40, color: colors["capture-denied-foreground"] },
}
