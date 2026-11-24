import {
	type IdentificationHandlers,
	usePatientIdentification,
} from "../../identification/hooks/use-patient-identification"
import { useNfcSupport } from "../../nfc/hooks/use-nfc-support"
import type { PatientIdentification } from "../components/PatientFinder"

// CAP-013-R02, CAP-013-R04, CAP-013-R18, CHG-176
export function usePatientFinder(handlers: IdentificationHandlers) {
	const readsTags = useNfcSupport()
	const flow = usePatientIdentification(handlers)
	const identification: PatientIdentification = {
		onTag: readsTags ? flow.readTag : undefined,
		onCode: flow.scanCode,
	}
	return { flow, identification }
}
