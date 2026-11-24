import { Pressable } from "react-native"
import colors from "../styles/colors.json"
import { CloseIcon } from "./icons/CloseIcon"

interface Props {
	label: string
	isEnabled?: boolean
	onPress: () => void
}

// HIG-02, Vulna / Native / Sheet title bar
export function SheetCloseButton({ label, isEnabled = true, onPress }: Props) {
	return (
		<Pressable
			disabled={!isEnabled}
			className="h-close w-close items-center justify-center rounded-full bg-fill-secondary active:opacity-dim"
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
		>
			<CloseIcon color={colors["label-secondary"]} />
		</Pressable>
	)
}
