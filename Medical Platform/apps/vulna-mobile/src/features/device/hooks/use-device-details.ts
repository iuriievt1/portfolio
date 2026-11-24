import { cryptoAndKeys, type DevicePlatform, deviceModelName } from "@ansora/core-mobile"
import { useCallback, useState } from "react"
import { appVersionLabel } from "../../../api/app-version"
import type { DeviceDetails } from "../components/ItInformationSheet"

/** IT reads the system by the name the platform is known under, not by the bare number. */
const PLATFORM_NAME: Record<DevicePlatform, string> = {
	ios: "iOS",
	android: "Android",
}

export interface DeviceDetailsSheet {
	details: DeviceDetails | undefined
	open: () => Promise<void>
	close: () => void
}

export function useDeviceDetails(): DeviceDetailsSheet {
	const [details, setDetails] = useState<DeviceDetails>()

	const open = useCallback(async () => {
		try {
			const device = await cryptoAndKeys().deviceDescriptor()
			setDetails({
				model: deviceModelName(device.model),
				system: `${PLATFORM_NAME[device.platform]} ${device.osVersion}`,
				version: appVersionLabel(),
			})
		} catch (failure) {
			console.warn("device details could not be read", failure)
		}
	}, [])

	const close = useCallback(() => setDetails(undefined), [])

	return { details, open, close }
}
