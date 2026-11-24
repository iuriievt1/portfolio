import { Stack, useRouter, useSegments } from "expo-router"
import { useCallback, useEffect } from "react"
import { View } from "react-native"
import { hasRole } from "../../features/access/access-rule"
import { NoRoleScreen } from "../../features/access/components/NoRoleScreen"
import { useAppVersionRejected } from "../../features/app-version/app-version-store"
import { leavesForUpdateScreen } from "../../features/app-version/draft-flow"
import { useSessionLock } from "../../features/session/hooks/use-session-lock"
import { SessionLockProvider } from "../../features/session/session-lock-context"
import { currentSession } from "../../features/session/session-store"
import { ROUTE } from "../../navigation/routes"
import {
	CAMERA_MODAL_OPTIONS,
	CONTENT_SHEET_OPTIONS,
	LIST_SHEET_OPTIONS,
	MODAL_OPTIONS,
} from "../../navigation/sheet-options"

// ADR-013, ADR-019
export default function ProtectedLayout() {
	const router = useRouter()
	const { touched, lock } = useSessionLock()
	const versionRejected = useAppVersionRejected()
	const segments = useSegments()
	const isAwayFromUpdate = versionRejected && leavesForUpdateScreen(segments)
	const changeAccount = useCallback(() => {
		lock()
		router.push(ROUTE.CHANGE_ACCOUNT)
	}, [lock, router])

	// CAP-012-R25
	useEffect(() => {
		if (isAwayFromUpdate) {
			router.dismissTo(ROUTE.HOME)
		}
	}, [isAwayFromUpdate, router])

	const session = currentSession()
	if (session !== undefined && !hasRole(session)) {
		return <NoRoleScreen onChangeAccount={changeAccount} />
	}
	return (
		<SessionLockProvider value={lock}>
			<View
				className="flex-1"
				onStartShouldSetResponderCapture={() => {
					touched()
					return false
				}}
			>
				<Stack screenOptions={{ headerShown: false }}>
					<Stack.Screen name="settings" options={CONTENT_SHEET_OPTIONS} />
					<Stack.Screen name="patient-code-scan" options={CONTENT_SHEET_OPTIONS} />
					<Stack.Screen name="patient-choice" options={LIST_SHEET_OPTIONS} />
					<Stack.Screen name="drafts" options={LIST_SHEET_OPTIONS} />
					<Stack.Screen name="queue" options={LIST_SHEET_OPTIONS} />
					<Stack.Screen name="visit/[id]" options={MODAL_OPTIONS} />
					<Stack.Screen name="patient/[id]/wound-type/[findingId]" options={MODAL_OPTIONS} />
					<Stack.Screen name="record-viewer/[id]" options={CAMERA_MODAL_OPTIONS} />
				</Stack>
			</View>
		</SessionLockProvider>
	)
}
