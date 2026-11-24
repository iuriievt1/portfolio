import { Pressable, Text, View } from "react-native"
import { Dimmable } from "../../../ui/Dimmable"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { Title } from "../../../ui/typography"

const BACKSPACE = "⌫"
const EMPTY = ""

const ROWS: readonly (readonly string[])[] = [
	["1", "2", "3"],
	["4", "5", "6"],
	["7", "8", "9"],
	[EMPTY, "0", BACKSPACE],
]

export const KEYPAD_STYLE = {
	PIN: "pin",
	KEYBOARD: "keyboard",
} as const

export type KeypadStyle = (typeof KEYPAD_STYLE)[keyof typeof KEYPAD_STYLE]

const LOOK: Record<KeypadStyle, { column: string; row: string; key: string; shape: string }> = {
	[KEYPAD_STYLE.PIN]: { column: "h-keypad gap-3", row: "gap-3", key: "h-key", shape: "rounded-full" },
	[KEYPAD_STYLE.KEYBOARD]: { column: "gap-1.5", row: "gap-1.5", key: "h-keyboard-key", shape: "rounded-keyboard-key" },
}

interface Props {
	style?: KeypadStyle
	disabled?: boolean
	onDigit: (digit: string) => void
	onErase: () => void
}

export function PinKeypad({ style = KEYPAD_STYLE.PIN, disabled = false, onDigit, onErase }: Props) {
	const look = LOOK[style]
	return (
		<Dimmable className={look.column} dimmed={disabled}>
			{ROWS.map((row) => (
				<View key={row.join("")} className={`${look.key} flex-row ${look.row}`}>
					{row.map((key, position) => (
						<Key
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
							key={position}
							value={key}
							style={style}
							onDigit={onDigit}
							onErase={onErase}
						/>
					))}
				</View>
			))}
		</Dimmable>
	)
}

interface KeyProps {
	value: string
	style: KeypadStyle
	onDigit: (digit: string) => void
	onErase: () => void
}

function Key({ value, style, onDigit, onErase }: KeyProps) {
	const look = LOOK[style]
	if (value === EMPTY) {
		return <View className={`${look.key} flex-1`} />
	}
	const erases = value === BACKSPACE
	return (
		<Pressable
			className={`group ${look.key} flex-1 items-center justify-center overflow-hidden ${look.shape} ${erases ? "" : "bg-card"}`}
			onPress={() => (erases ? onErase() : onDigit(value))}
			accessibilityLabel={erases ? undefined : value}
		>
			<PressedOverlay className={look.shape} />
			<KeyLabel value={value} style={style} erases={erases} />
		</Pressable>
	)
}

function KeyLabel({ value, style, erases }: { value: string; style: KeypadStyle; erases: boolean }) {
	if (style === KEYPAD_STYLE.PIN) {
		return <Title className="font-normal">{value}</Title>
	}
	return <Text className={`text-key ${erases ? "text-keyboard-glyph" : "text-label-primary"}`}>{value}</Text>
}
