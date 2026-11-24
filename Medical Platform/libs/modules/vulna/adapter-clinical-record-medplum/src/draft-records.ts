import type { Coding } from "./fhir-types"

export const PATIENT_REFERENCE = "Patient/"

// ADR-050 (doplnění D33) bod 1, bod 3
export const FINDING_RECORD = {
	DRAFT: "draft",
	CLOSED: "closed",
	WITHDRAWN: "withdrawn",
} as const

export type FindingRecord = (typeof FINDING_RECORD)[keyof typeof FINDING_RECORD]

export type DraftChange = typeof FINDING_RECORD.DRAFT | typeof FINDING_RECORD.WITHDRAWN

// ADR-050 bod 3
export function userSelected(system: string, code: string): { coding: Coding[] } {
	return { coding: [{ system, code, userSelected: true }] }
}
