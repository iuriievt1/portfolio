import { Stack } from "expo-router"
import { CAMERA_MODAL_OPTIONS, LIST_SHEET_OPTIONS } from "../../../../navigation/sheet-options"

export default function VisitLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="move-choice" options={LIST_SHEET_OPTIONS} />
			<Stack.Screen name="drafts" options={LIST_SHEET_OPTIONS} />
			<Stack.Screen name="capture" options={CAMERA_MODAL_OPTIONS} />
			<Stack.Screen name="scan" options={CAMERA_MODAL_OPTIONS} />
		</Stack>
	)
}
