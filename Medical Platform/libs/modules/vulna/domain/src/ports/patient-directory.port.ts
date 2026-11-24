import type { PatientSex } from "@ansora/contracts"

// datovy-model.md 3, ADR-004 ř. 22
export interface Identifier {
	system: string
	value: string
	issuer: string | undefined
}

export type PatientIdentifier = Identifier

export interface PatientRecord {
	identifiers: readonly PatientIdentifier[]
	givenName: string | undefined
	familyName: string | undefined
	birthDate: string | undefined
	sex: PatientSex | undefined
}

// ADR-003 ř. 21, 29, NAB-299
export interface PatientDirectoryPort {
	findByIdentifier(identifier: PatientIdentifier): Promise<PatientRecord | undefined>
}
