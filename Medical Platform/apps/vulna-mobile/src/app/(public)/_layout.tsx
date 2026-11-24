import { Stack } from "expo-router"
import { useAppVersionRejected } from "../../features/app-version/app-version-store"
import { AppUpdateScreen } from "../../features/app-version/components/AppUpdateScreen"
import { useTexts } from "../../i18n/language-store"
import { CONTENT_SHEET_OPTIONS } from "../../navigation/sheet-options"

export default function PublicLayout() {
	const strings = useTexts()
	const versionRejected = useAppVersionRejected()
	if (versionRejected) {
		return <AppUpdateScreen />
	}
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" options={{ animation: "none" }} />
			<Stack.Screen name="unlock" options={{ animation: "none" }} />
			<Stack.Screen
				name="change-account"
				options={{
					presentation: "modal",
					headerShown: true,
					title: strings.unlock.account.title,
					headerTitleAlign: "center",
					headerShadowVisible: false,
				}}
			/>
			<Stack.Screen name="code-scan" options={CONTENT_SHEET_OPTIONS} />
			<Stack.Screen name="employee-code-scan" options={CONTENT_SHEET_OPTIONS} />
		</Stack>
	)
}
