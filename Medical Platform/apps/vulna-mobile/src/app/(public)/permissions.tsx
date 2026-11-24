import { devicePermissions } from "@ansora/core-mobile"
import { useRouter } from "expo-router"
import { useCallback } from "react"
import { PermissionsScreen } from "../../features/permissions/components/PermissionsScreen"
import { ROUTE } from "../../navigation/routes"

/** Camera and NFC are asked for once, right after the first sign-in ✓ NAB-058, NAB-141. */
export default function Permissions() {
	const router = useRouter()
	const allow = useCallback(async () => {
		await devicePermissions().requestCapture()
		router.replace(ROUTE.HOME)
	}, [router])
	return <PermissionsScreen onAllow={allow} />
}
