import { CodeScanScreen } from "../../features/code-scan/components/CodeScanScreen"
import { PATIENT_CODE_FORMATS } from "../../features/code-scan/components/CodeScanSheet"

// CAP-013-R02, CAP-013-R18
export default function PatientCodeScan() {
	return <CodeScanScreen formats={PATIENT_CODE_FORMATS} />
}
