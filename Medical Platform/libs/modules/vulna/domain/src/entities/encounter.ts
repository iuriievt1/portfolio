import { ENCOUNTER_STATUS, type EncounterStatus, ERROR_CODE } from "@ansora/contracts"
import { ENCOUNTER_SOURCE, type EncounterSource } from "../registry/registry-records"

export interface EncounterDay {
	status: EncounterStatus
	date: string
}

export type EmptiedStatus = typeof ENCOUNTER_STATUS.PLANNED | typeof ENCOUNTER_STATUS.CANCELLED

export type NewRecordRefusal =
	| typeof ERROR_CODE.ENCOUNTER_COMPLETED
	| typeof ERROR_CODE.ENCOUNTER_CANCELLED
	| typeof ERROR_CODE.ENCOUNTER_NOT_TODAY

// CAP-014-R30
export function isEarlierDay(encounter: EncounterDay, today: string): boolean {
	return encounter.date < today
}

// CAP-014-R21, CAP-014-R29, CAP-014-R30
export function acceptsNewRecords(encounter: EncounterDay, today: string): boolean {
	return newRecordRefusalOf(encounter, today) === undefined
}

// CAP-014-R07, CAP-014-R21, CAP-014-R29, CAP-014-R30
export function newRecordRefusalOf(encounter: EncounterDay, today: string): NewRecordRefusal | undefined {
	switch (encounter.status) {
		case ENCOUNTER_STATUS.COMPLETED:
			return ERROR_CODE.ENCOUNTER_COMPLETED
		case ENCOUNTER_STATUS.CANCELLED:
			return ERROR_CODE.ENCOUNTER_CANCELLED
		case ENCOUNTER_STATUS.PLANNED:
		case ENCOUNTER_STATUS.IN_PROGRESS:
			return isEarlierDay(encounter, today) ? ERROR_CODE.ENCOUNTER_NOT_TODAY : undefined
		default:
			return encounter.status satisfies never
	}
}

// CAP-014-R18, CAP-014-R29
export function statusAfterEmptying(source: EncounterSource): EmptiedStatus {
	return source === ENCOUNTER_SOURCE.WORKLIST ? ENCOUNTER_STATUS.PLANNED : ENCOUNTER_STATUS.CANCELLED
}
