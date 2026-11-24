import { useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TargetBarcodeFormat } from "react-native-nitro-zxing"
import { finishCodeScan } from "../scanned-code"
import { CodeScanSheet } from "./CodeScanSheet"

// CAP-001-S29, CAP-013-S01
export function CodeScanScreen({ formats }: { formats: TargetBarcodeFormat[] }) {
	const router = useRouter()
	const recognised = useRef(false)
	const [scanning, setScanning] = useState(true)

	useEffect(() => () => finishCodeScan(undefined), [])

	const deliver = useCallback(
		(content: string) => {
			if (recognised.current) {
				return
			}
			recognised.current = true
			setScanning(false)
			finishCodeScan(content)
			router.back()
		},
		[router],
	)

	return <CodeScanSheet scanning={scanning} formats={formats} onScanned={deliver} onCancel={() => router.back()} />
}
