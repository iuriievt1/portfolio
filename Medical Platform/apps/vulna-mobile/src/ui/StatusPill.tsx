import { View } from "react-native"
import { PILL_TONE, type PillTone } from "./pill-tone"
import { Caption } from "./typography"

const SURFACE: Record<PillTone, string> = {
	[PILL_TONE.INFO]: "bg-status-info",
	[PILL_TONE.WARN]: "bg-status-warn",
	[PILL_TONE.SUCCESS]: "bg-status-success",
	[PILL_TONE.NEUTRAL]: "bg-secondary",
}

const CAPTION: Record<PillTone, string> = {
	[PILL_TONE.INFO]: "text-status-info-foreground",
	[PILL_TONE.WARN]: "text-status-warn-foreground",
	[PILL_TONE.SUCCESS]: "text-status-success-foreground",
	[PILL_TONE.NEUTRAL]: "text-muted-foreground",
}

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
	return (
		<View className={`rounded-badge px-2 py-badge ${SURFACE[tone]}`}>
			<Caption className={CAPTION[tone]}>{label}</Caption>
		</View>
	)
}
