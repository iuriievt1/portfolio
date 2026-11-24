import { Pressable } from "react-native"
import { ClearIcon } from "../../../ui/icons/ClearIcon"
import { GLASS_SHADOW } from "../../../ui/shadow"
import { FieldGlass } from "./PatientSearchField"

interface Props {
	label: string
	onPress: () => void
}

export function ClearSearchButton({ label, onPress }: Props) {
	return (
		<Pressable
			className="h-search w-search items-center justify-center rounded-full"
			style={GLASS_SHADOW}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
		>
			<FieldGlass isInteractive />
			<ClearIcon />
		</Pressable>
	)
}
