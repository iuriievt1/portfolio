import "../i18n/intl-polyfills"
import { DefaultTheme, Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { BootstrapErrorScreen } from "../features/bootstrap/components/BootstrapErrorScreen"
import { type StartResolution, useBootstrap } from "../features/bootstrap/hooks/use-bootstrap"
import { useLoadingCovered, useStartCoverRelease } from "../features/bootstrap/loading-cover"
import { DeviceCheckingScreen } from "../features/device/components/DeviceCheckingScreen"
import { IntegrityBlockScreen } from "../features/device/components/IntegrityBlockScreen"
import { type DeviceIntegrity, useDeviceIntegrity } from "../features/device/hooks/use-device-integrity"
import { useDeviceRevocation } from "../features/device/hooks/use-device-revocation"
import { useResumeCheck } from "../features/device/hooks/use-resume-check"
import { useAppReturn } from "../features/session/hooks/use-app-return"
import { useUploadQueue } from "../features/upload/hooks/use-upload-queue"
import { refreshDeviceLanguage } from "../i18n/language-store"
import colors from "../styles/colors.json"
import "../styles/global.css"

const NAVIGATION_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background } }

// mobilni-aplikace.md 2, NAB-188, NAB-189
export default function RootLayout() {
	const bootstrap = useBootstrap()
	const integrity = useDeviceIntegrity(bootstrap?.ok === true)
	const isWorking = bootstrap?.ok === true && integrity.checked && integrity.block === undefined
	const covered = useResumeCheck(isWorking)
	const loading = useLoadingCovered()
	useStartCoverRelease(integrity.checked && (integrity.block !== undefined || bootstrap !== undefined))
	useUploadQueue(isWorking)
	useDeviceRevocation(isWorking)
	useAppReturn({ onReturn: refreshDeviceLanguage })
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<StatusBar style="auto" />
				<ThemeProvider value={NAVIGATION_THEME}>{content(bootstrap, integrity)}</ThemeProvider>
				{loading || (covered && isWorking) ? (
					<View className="absolute inset-0">
						<DeviceCheckingScreen />
					</View>
				) : null}
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}

// CAP-008-R03, CAP-008-R13
function content(bootstrap: StartResolution | undefined, integrity: DeviceIntegrity) {
	if (!integrity.checked) {
		return null
	}
	if (integrity.block !== undefined) {
		return <IntegrityBlockScreen block={integrity.block} />
	}
	return bootstrap === undefined ? null : routes(bootstrap)
}

function routes(bootstrap: StartResolution) {
	if (!bootstrap.ok) {
		return <BootstrapErrorScreen missing={bootstrap.missing} />
	}
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(public)" />
			<Stack.Screen name="(protected)" />
		</Stack>
	)
}
