import { Pressable, Text, View } from "react-native"
import { LightGlass } from "../../../ui/Glass"
import { SearchIcon } from "../../../ui/icons/SearchIcon"
import { GLASS_SHADOW } from "../../../ui/shadow"

interface Props {
	placeholder: string
	value: string
	onPress: () => void
}

// CAP-013-R07
export function PatientSearchField({ placeholder, value, onPress }: Props) {
	const isEmpty = value.length === 0
	return (
		<Pressable
			className="h-search rounded-full"
			style={GLASS_SHADOW}
			accessibilityRole="search"
			accessibilityLabel={placeholder}
			accessibilityValue={{ text: value }}
			onPress={onPress}
		>
			<FieldGlass isInteractive={false} />
			<View className="h-full flex-row items-center gap-1 pr-field-end pl-field-start">
				<SearchIcon />
				<Text
					className={`flex-1 font-medium text-body ${isEmpty ? "text-control-tertiary" : "text-control-primary"}`}
					numberOfLines={1}
				>
					{isEmpty ? placeholder : value}
				</Text>
			</View>
		</Pressable>
	)
}

export function FieldGlass({ isInteractive }: { isInteractive: boolean }) {
	return (
		<>
			<LightGlass className="absolute inset-0 rounded-full" plainClassName="bg-field" isInteractive={isInteractive} />
			<View className="absolute inset-0 rounded-full border border-field-border" pointerEvents="none" />
		</>
	)
}
