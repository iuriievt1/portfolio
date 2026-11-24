import type { Patient } from "../../api/patients"
import { randomUuid } from "../../utils/random-uuid"
import { openVisit } from "./opened-visit"

// CAP-014-R05, CAP-014-R06, CAP-014-R29
export async function openNewVisit(patient: Patient): Promise<string> {
	return openVisit({ patient, encounterId: undefined, encounterKey: await randomUuid(), openedAt: new Date() })
}
