import { PATIENT_SEX } from "@ansora/contracts"
import type { Patient } from "../../api/patients"
import { SYMBOL_SEX, type SymbolSex } from "../../ui/icons/sex-symbol-look"

const NO_TEXT = ""

// CAP-013-R09, CAP-013-R19, CHG-176
export function patientNumberOf(patient: Patient): string {
	return patient.identifiers[0]?.value ?? NO_TEXT
}

// CAP-013-R09, Q-132
export function symbolSexOf(sex: Patient["sex"]): SymbolSex | undefined {
	switch (sex) {
		case PATIENT_SEX.FEMALE:
			return SYMBOL_SEX.FEMALE
		case PATIENT_SEX.MALE:
			return SYMBOL_SEX.MALE
		default:
			return undefined
	}
}
