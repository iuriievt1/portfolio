import { PIN_LENGTH } from "@ansora/core-mobile"
import { View } from "react-native"

interface Props {
	entered: number
}

export function PinDots({ entered }: Props) {
	const shown = Math.max(PIN_LENGTH.MINIMUM, entered)
	return (
		<View className="h-6 flex-row items-center justify-center gap-4">
			{Array.from({ length: shown }, (_, position) => (
				<Dot
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
					key={position}
					filled={position < entered}
				/>
			))}
		</View>
	)
}

function Dot({ filled }: { filled: boolean }) {
	const look = filled ? "bg-foreground" : "border-dot border-muted-foreground"
	return <View className={`h-dot w-dot rounded-full ${look}`} />
}
