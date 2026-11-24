import { useRouter } from "expo-router"
import { useCallback } from "react"
import { ROUTE } from "../../../navigation/routes"
import { hasCameraAccess } from "../camera-access"
import { awaitScannedCode } from "../scanned-code"

export const CODE_SCAN = {
	SCANNED: "scanned",
	CANCELLED: "cancelled",
	CAMERA_DENIED: "camera_denied",
} as const

export type CodeScan =
	| { kind: typeof CODE_SCAN.SCANNED; content: string }
	| { kind: typeof CODE_SCAN.CANCELLED }
	| { kind: typeof CODE_SCAN.CAMERA_DENIED }

type CodeScanRoute = typeof ROUTE.CODE_SCAN | typeof ROUTE.EMPLOYEE_CODE_SCAN | typeof ROUTE.PATIENT_CODE_SCAN

export function useCodeScan(route: CodeScanRoute = ROUTE.CODE_SCAN): () => Promise<CodeScan> {
	const router = useRouter()
	return useCallback(async () => {
		if (!(await hasCameraAccess())) {
			return { kind: CODE_SCAN.CAMERA_DENIED }
		}
		const scanned = awaitScannedCode()
		router.push(route)
		const content = await scanned
		return content === undefined ? { kind: CODE_SCAN.CANCELLED } : { kind: CODE_SCAN.SCANNED, content }
	}, [router, route])
}
