import { CodeScanScreen } from "../../features/code-scan/components/CodeScanScreen"
import { QR_CODE_ONLY } from "../../features/code-scan/components/CodeScanSheet"

// CAP-001-S29
export default function CodeScan() {
	return <CodeScanScreen formats={QR_CODE_ONLY} />
}
