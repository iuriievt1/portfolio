import type { Patient } from "../../api/patients"
import type { IdentificationMethod, ReadIdentifier } from "./patient-identifier"

export interface MatchingPatients {
	patients: readonly Patient[]
	identifier: ReadIdentifier
	method: IdentificationMethod
}

let matching: MatchingPatients | undefined

// CAP-013-R08, CAP-013-R10
export function offerMatchingPatients(offer: MatchingPatients): void {
	matching = offer
}

export function matchingPatients(): MatchingPatients | undefined {
	return matching
}

export function forgetMatchingPatients(): void {
	matching = undefined
}
