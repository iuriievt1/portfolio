import { DEVICE_STATUS, opensWorkingScreens, startsRegistration } from "@ansora/core-mobile"
import { Redirect } from "expo-router"
import { useLoadingCover } from "../../features/bootstrap/loading-cover"
import { BlockedDeviceScreen } from "../../features/device/components/BlockedDeviceScreen"
import { DeviceStatusScreen } from "../../features/device/components/DeviceStatusScreen"
import { DeviceWaitingScreen } from "../../features/device/components/DeviceWaitingScreen"
import { DeviceWelcomeScreen } from "../../features/device/components/DeviceWelcomeScreen"
import { ItInformationSheet } from "../../features/device/components/ItInformationSheet"
import { NoConnectionScreen } from "../../features/device/components/NoConnectionScreen"
import { useDeviceDetails } from "../../features/device/hooks/use-device-details"
import { useDeviceStatus } from "../../features/device/hooks/use-device-status"
import { useCurrentAccount } from "../../features/unlock/hooks/use-current-account"
import { ROUTE } from "../../navigation/routes"

export default function Index() {
	const { status, checked, register, recheck } = useDeviceStatus()
	const details = useDeviceDetails()
	const current = useCurrentAccount()
	const isChecking = status.kind === DEVICE_STATUS.CHECKING || !current.loaded
	useLoadingCover(isChecking || opensWorkingScreens(status))

	if (isChecking) {
		return null
	}
	if (startsRegistration(status)) {
		return <DeviceWelcomeScreen onRegister={register} />
	}
	if (opensWorkingScreens(status)) {
		return <Redirect href={current.account === undefined ? ROUTE.SIGN_IN : ROUTE.UNLOCK} />
	}
	if (status.kind === DEVICE_STATUS.BLOCKED) {
		return <BlockedDeviceScreen />
	}
	if (status.kind === DEVICE_STATUS.UNREACHABLE) {
		return <NoConnectionScreen onRetry={recheck} />
	}
	if (status.kind === DEVICE_STATUS.PENDING_APPROVAL && status.fingerprint !== undefined) {
		return (
			<>
				<DeviceWaitingScreen code={status.fingerprint} checked={checked} onCheck={recheck} onDetails={details.open} />
				<ItInformationSheet code={status.fingerprint} details={details.details} onClose={details.close} />
			</>
		)
	}
	return <DeviceStatusScreen status={status} onRetry={recheck} />
}
