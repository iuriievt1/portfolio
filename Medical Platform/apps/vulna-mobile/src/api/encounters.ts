import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type Encounter = Schemas["Encounter"]
type EncountersPage = Schemas["EncountersPage"]
type ScheduledEncounterList = Schemas["ScheduledEncounterList"]
export type ScheduledEncounterItem = Schemas["ScheduledEncounterItem"]
type UnfinishedEncounterList = Schemas["UnfinishedEncounterList"]
export type UnfinishedEncounterItem = Schemas["UnfinishedEncounterItem"]
type EncounterAcquisitionsPage = Schemas["EncounterAcquisitionsPage"]
export type EncounterAcquisitionItem = Schemas["EncounterAcquisitionItem"]
type PatientEncountersQuery = MobileContract.operations["listPatientEncounters"]["parameters"]["query"]

const ENCOUNTERS_PATH: keyof MobileContract.paths = "/encounters"
const SCHEDULED_PATH: keyof MobileContract.paths = "/encounters/scheduled"
const UNFINISHED_PATH: keyof MobileContract.paths = "/encounters/unfinished"

function encounterPath(encounterId: string): string {
	return `${ENCOUNTERS_PATH}/${encodeURIComponent(encounterId)}`
}

export const encounterApi = {
	// CAP-014-R16
	listScheduledEncounters: (sessionToken: string, date: string): Promise<ScheduledEncounterList> =>
		callApi<ScheduledEncounterList>(withQuery(SCHEDULED_PATH, { date }), { sessionToken }),
	// clinical-workflow.yaml listUnfinishedEncounters, CAP-014-R18
	listUnfinishedEncounters: (sessionToken: string): Promise<UnfinishedEncounterList> =>
		callApi<UnfinishedEncounterList>(UNFINISHED_PATH, { sessionToken }),
	// CAP-014-R19
	listPatientEncounters: (sessionToken: string, query: PatientEncountersQuery): Promise<EncountersPage> =>
		callApi<EncountersPage>(withQuery(ENCOUNTERS_PATH, query), { sessionToken }),
	// CAP-014-R22
	listEncounterAcquisitions: (
		sessionToken: string,
		encounterId: string,
		cursor: string | undefined,
	): Promise<EncounterAcquisitionsPage> =>
		callApi<EncounterAcquisitionsPage>(withQuery(`${encounterPath(encounterId)}/acquisitions`, { cursor }), {
			sessionToken,
		}),
	// CAP-014-R20
	completeEncounter: (sessionToken: string, encounterId: string): Promise<Encounter> =>
		callApi<Encounter>(`${encounterPath(encounterId)}/completion`, { method: "POST", sessionToken }),
	// Q-150
	cancelEncounter: (sessionToken: string, encounterId: string): Promise<void> =>
		callApi<void>(`${encounterPath(encounterId)}/cancellation`, { method: "POST", sessionToken }),
}
