import { Stack } from "expo-router"
import { CONTENT_SHEET_OPTIONS } from "../../../../../navigation/sheet-options"

// CAP-018-R02, CAP-018-R15, CAP-018-R11
export default function ScanLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="custom-title" options={CONTENT_SHEET_OPTIONS} />
		</Stack>
	)
}
