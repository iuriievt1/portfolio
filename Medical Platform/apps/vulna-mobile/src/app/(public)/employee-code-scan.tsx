import { CodeScanScreen } from "../../features/code-scan/components/CodeScanScreen"
import { EMPLOYEE_CARD_CODE_ONLY } from "../../features/code-scan/components/CodeScanSheet"

// identity.yaml loginWithBarcode
export default function EmployeeCodeScan() {
	return <CodeScanScreen formats={EMPLOYEE_CARD_CODE_ONLY} />
}
