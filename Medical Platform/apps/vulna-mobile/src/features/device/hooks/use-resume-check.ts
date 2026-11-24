import { DEVICE_STATUS, type DeviceStatus } from "@ansora/core-mobile"
import { useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { ROUTE } from "../../../navigation/routes"
import { useAppReturn } from "../../session/hooks/use-app-return"
import { checkDevice } from "../device-check"

const STOPS_WORK: ReadonlySet<DeviceStatus["kind"]> = new Set([DEVICE_STATUS.REVOKED, DEVICE_STATUS.BLOCKED])

export function useResumeCheck(enabled: boolean): boolean {
	const router = useRouter()
	const [covered, setCovered] = useState(false)
	const resumption = useRef(0)

	const verify = useCallback(async () => {
		const current = ++resumption.current
		const status = await checkDevice()
		if (current !== resumption.current) {
			return
		}
		if (STOPS_WORK.has(status.kind)) {
			router.replace(ROUTE.ENTRY)
		}
		setCovered(false)
	}, [router])

	useAppReturn({ onHide: () => setCovered(true), onReturn: () => void verify() }, enabled)

	return covered
}
