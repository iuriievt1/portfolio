import type { Patient } from "../../api/patients"

let opened: Patient | undefined

// CAP-013-R08
export function openPatient(patient: Patient): void {
	opened = patient
}

export function openedPatient(patientId: string): Patient | undefined {
	return opened?.patient_id === patientId ? opened : undefined
}

export function forgetOpenedPatient(): void {
	opened = undefined
}
