import { Pressable, View } from "react-native"
import { CloseIcon } from "./icons/CloseIcon"
import { Label } from "./typography"

interface Props {
	title: string
	closeLabel: string
	onClose: () => void
}

export function SheetHeader({ title, closeLabel, onClose }: Props) {
	return (
		<View className="pt-4">
			<View className="h-11 justify-center">
				<Label className="text-center" accessibilityRole="header">
					{title}
				</Label>
				<Pressable
					className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-secondary"
					accessibilityRole="button"
					accessibilityLabel={closeLabel}
					onPress={onClose}
				>
					<CloseIcon />
				</Pressable>
			</View>
		</View>
	)
}
