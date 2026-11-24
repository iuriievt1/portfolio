import type { Encounter } from "../../api/encounters"

// CAP-014-R07, CAP-014-R12, CAP-014-R25, E117
export function targetVisitsOf(visits: readonly Encounter[], sourceEncounterId: string | undefined): Encounter[] {
	return visits.filter((visit) => visit.accepts_new_records === true && visit.encounter_id !== sourceEncounterId)
}
