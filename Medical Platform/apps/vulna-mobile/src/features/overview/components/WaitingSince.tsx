import { View } from "react-native"
import { PILL_TONE } from "../../../ui/pill-tone"
import { StatusPill } from "../../../ui/StatusPill"

// CAP-015-R18, CAP-015-S15, E57
export function WaitingSince({ label }: { label: string | undefined }) {
	if (label === undefined) {
		return null
	}
	return (
		<View className="flex-row">
			<StatusPill tone={PILL_TONE.WARN} label={label} />
		</View>
	)
}
