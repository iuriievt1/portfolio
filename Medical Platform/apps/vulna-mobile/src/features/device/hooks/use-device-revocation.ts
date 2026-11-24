import { useRouter } from "expo-router"
import { useEffect } from "react"
import { ROUTE } from "../../../navigation/routes"
import { onDeviceRevoked } from "../device-revocation-events"
import { eraseAfterRevocation } from "../remote-erasure"

// CAP-007-R04, CAP-007-R11, CAP-002-S09
export function useDeviceRevocation(enabled: boolean): void {
	const router = useRouter()

	useEffect(() => {
		if (!enabled) {
			return
		}
		return onDeviceRevoked(() => {
			eraseAfterRevocation()
				.catch((failure: unknown) => console.warn("the local data could not be erased after the revocation", failure))
				.finally(() => router.replace(ROUTE.ENTRY))
		})
	}, [enabled, router])
}
