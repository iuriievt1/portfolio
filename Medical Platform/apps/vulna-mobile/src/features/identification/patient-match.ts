import type { Patient } from "../../api/patients"
import type { ReadIdentifier } from "./patient-identifier"

// CAP-013-R10, CAP-013-R12, CAP-024-R07, E116
export function matchIssuerOf(patient: Patient, read: ReadIdentifier): string | undefined {
	return patient.identifiers.find((identifier) => identifier.system === read.system && identifier.value === read.value)
		?.issuer
}
