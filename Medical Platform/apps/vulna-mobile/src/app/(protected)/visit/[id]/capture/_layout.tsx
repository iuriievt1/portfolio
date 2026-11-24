import { Stack } from "expo-router"
import { CONTENT_SHEET_OPTIONS } from "../../../../../navigation/sheet-options"

// CAP-015-R31, CAP-017-R04
export default function CaptureLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="note" options={CONTENT_SHEET_OPTIONS} />
		</Stack>
	)
}
