import colors from "../styles/colors.json"

const SHEET_CORNER_RADIUS = 38
const HALF_SCREEN = 0.5
const FULL_SCREEN = 1
const LIST_SHEET_DETENTS: number[] = [HALF_SCREEN, FULL_SCREEN]

export const CONTENT_SHEET_OPTIONS = {
	presentation: "formSheet",
	sheetAllowedDetents: "fitToContents",
	sheetCornerRadius: SHEET_CORNER_RADIUS,
	sheetGrabberVisible: false,
	contentStyle: { backgroundColor: colors.card },
} as const

export const LIST_SHEET_OPTIONS = {
	...CONTENT_SHEET_OPTIONS,
	sheetAllowedDetents: LIST_SHEET_DETENTS,
}

const CAMERA_SURFACE = "black"

// CAP-015-R31
export const MODAL_OPTIONS = {
	presentation: "modal",
	contentStyle: { backgroundColor: colors.background },
} as const

export const CAMERA_MODAL_OPTIONS = {
	presentation: "modal",
	contentStyle: { backgroundColor: CAMERA_SURFACE },
} as const
