import { patientViewOf } from "../../registry/utils/patient-view"
import type { UnfinishedEncounter, UnfinishedEncounterItemView } from "../types/encounter.types"

// clinical-workflow.yaml UnfinishedEncounterItem, CAP-013-R09
export function unfinishedEncounterViewOf(unfinished: UnfinishedEncounter): UnfinishedEncounterItemView {
	return {
		patient: patientViewOf(unfinished.patient),
		encounter: unfinished.encounter,
		last_documented_at: unfinished.lastDocumentedAt.toISOString(),
	}
}
