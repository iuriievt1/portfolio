import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"
import colors from "./src/styles/colors.json"
import opacity from "./src/styles/opacity.json"
import sizes from "./src/styles/sizes.json"

const pixels = (value: number) => `${value}px`

const SYSTEM_BAR_INSET = "env(safe-area-inset-bottom)"
const ANDROID_SYSTEM_BAR_GAP = pixels(sizes["android-system-bar-gap"])
const ANDROID = "@media (display-mode: android)"

const safeGapPadding = plugin(({ matchUtilities, theme }) => {
	matchUtilities(
		{
			"pb-safe-gap-or": (minimum: string) => ({
				paddingBottom: `max(${SYSTEM_BAR_INSET}, ${minimum})`,
				[ANDROID]: {
					paddingBottom: `max(calc(${SYSTEM_BAR_INSET} + ${ANDROID_SYSTEM_BAR_GAP}), ${minimum})`,
				},
			}),
		},
		{ values: theme("spacing") },
	)
})

export default {
	content: ["./src/**/*.{ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		extend: {
			colors,
			fontSize: {
				title: ["28px", "34px"],
				heading: ["22px", "28px"],
				body: ["17px", "24px"],
				compact: ["17px", "22px"],
				detail: ["15px", "21px"],
				caption: ["13px", "18px"],
				key: ["23px", "28px"],
				"file-mark": ["14px", "18px"],
				"tile-day": ["17px", "20px"],
				"tile-weekday": ["12px", "14px"],
			},
			spacing: {
				screen: pixels(sizes.screen),
				control: "56px",
				entry: "81px",
				feedback: "118px",
				key: "64px",
				keypad: "292px",
				method: "72px",
				identity: "48px",
				message: "42px",
				link: "44px",
				close: "44px",
				"keyboard-key": "50px",
				"keyboard-edge": "7.67px",
				"keyboard-bottom": "42px",
				dot: "14px",
				field: "17px",
				sheet: "34px",
				scan: "284px",
				"value-edge": "15.5px",
				row: "13.5px",
				values: "31px",
				nav: "5px",
				badge: "2px",
				category: "40px",
				search: pixels(sizes.search),
				"field-start": "11px",
				"field-end": "10px",
				"visit-empty": "80px",
				tile: "60px",
				"tile-gap": "9px",
				alert: "22px",
				"alert-actions": "14px",
				"alert-gap": "34px",
				"work-row": "73px",
				"planned-row": "70px",
				"planned-time": "52px",
				"skeleton-line": "16px",
				"skeleton-small": "12px",
				"skeleton-caret": "8px",
				"skeleton-medium": "14px",
				"skeleton-name": "150px",
				"skeleton-name-short": "120px",
				"skeleton-detail": "130px",
				"skeleton-detail-short": "100px",
				"skeleton-birth": "72px",
				"skeleton-time": "40px",
				"skeleton-planned": "140px",
				"skeleton-planned-short": "110px",
				"skeleton-visit-time": "90px",
				"skeleton-pill": "70px",
				"skeleton-count": "80px",
				thumbnail: pixels(sizes.thumbnail),
				"thumbnail-gap": pixels(sizes["thumbnail-gap"]),
				tool: "56px",
				toolbar: "80px",
				"capture-nav": "70px",
				"tool-gap": "48px",
				handle: "28px",
				shutter: "80px",
				"shutter-core": "64px",
				choice: "15.5px",
				list: "18px",
				"grid-tile": pixels(sizes["grid-tile"]),
				"file-mark": pixels(sizes["file-mark"]),
				"page-corner": pixels(sizes["page-corner"]),
				mark: pixels(sizes.mark),
				note: "132px",
			},
			borderWidth: {
				dot: "1.5px",
				ring: "2px",
				shutter: "3px",
				handle: "3px",
				dash: "2px",
				selected: "2px",
				mark: "2px",
			},
			borderRadius: {
				control: "14px",
				field: "10px",
				keyboard: "27px",
				"keyboard-key": "8.5px",
				scan: "18px",
				sheet: "28px",
				"sheet-outline": "29px",
				badge: "6px",
				tile: "18px",
				alert: "26px",
			},
			maxWidth: {
				entry: "393px",
				alert: "300px",
			},
			maxHeight: {
				phone: "852px",
			},
			opacity,
			flex: {
				"space-above": "330",
				"space-below": "415",
			},
			scale: {
				spinner: "1.5",
				"spinner-control": "1.1",
			},
			aspectRatio: {
				photo: `${sizes.photo.width} / ${sizes.photo.height}`,
				page: `${sizes.page.width} / ${sizes.page.height}`,
			},
		},
	},
	plugins: [safeGapPadding],
} satisfies Config
