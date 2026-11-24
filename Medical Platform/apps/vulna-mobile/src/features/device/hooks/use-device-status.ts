import { DEVICE_STATUS, type DeviceStatus } from "@ansora/core-mobile"
import { useCallback, useEffect, useState } from "react"
import { checkDevice, withCheckScreen } from "../device-check"
import { enrolThisDevice } from "../device-enrolment"

export interface DeviceEnrolment {
	status: DeviceStatus
	/** True once the user asked for the state themselves; the waiting screen then speaks differently. */
	checked: boolean
	register: () => Promise<void>
	recheck: () => Promise<void>
}

export function useDeviceStatus(): DeviceEnrolment {
	const [status, setStatus] = useState<DeviceStatus>({ kind: DEVICE_STATUS.CHECKING })
	const [checked, setChecked] = useState(false)

	const check = useCallback(async () => {
		setStatus({ kind: DEVICE_STATUS.CHECKING })
		setStatus(await checkDevice())
	}, [])

	const recheck = useCallback(async () => {
		setChecked(true)
		await check()
	}, [check])

	const register = useCallback(async () => {
		setStatus({ kind: DEVICE_STATUS.CHECKING })
		setStatus(await withCheckScreen(enrolThisDevice()))
	}, [])

	useEffect(() => {
		void check()
	}, [check])

	return { status, checked, register, recheck }
}
