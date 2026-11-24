import { ADMINISTERED_ACQUISITION_STATES, type AdministeredAcquisitionState } from "@ansora/contracts"
import type { AcquisitionFilter } from "@/features/acquisitions/types/acquisition.types"
import { endOfDay, isCalendarDate, startOfDay } from "@/lib/calendar-date"
import { type AcquisitionFilterValues, PATIENT_IDENTIFIER_MAX_LENGTH } from "./acquisition-filter.schema"

// DESIGN.md 9.1
const ACQUISITION_FILTER_PARAM = {
	STATE: "state",
	FROM: "from",
	TO: "to",
} as const

export const ANY_STATE = ""

export const EMPTY_ACQUISITION_FILTER: AcquisitionFilter = {
	state: undefined,
	fromDate: undefined,
	toDate: undefined,
	patientIdentifier: undefined,
}

function stateOf(value: string | null): AdministeredAcquisitionState | undefined {
	return ADMINISTERED_ACQUISITION_STATES.find((state) => state === value)
}

function dateOf(value: string | null): string | undefined {
	return value !== null && isCalendarDate(value) ? value : undefined
}

function identifierOf(value: string): string | undefined {
	const trimmed = value.trim()
	return trimmed === "" || trimmed.length > PATIENT_IDENTIFIER_MAX_LENGTH ? undefined : trimmed
}

// DESIGN.md 9.1
export function acquisitionFilterOf(params: URLSearchParams, patientIdentifier: string | undefined): AcquisitionFilter {
	return {
		state: stateOf(params.get(ACQUISITION_FILTER_PARAM.STATE)),
		fromDate: dateOf(params.get(ACQUISITION_FILTER_PARAM.FROM)),
		toDate: dateOf(params.get(ACQUISITION_FILTER_PARAM.TO)),
		patientIdentifier,
	}
}

// DESIGN.md 9.1
export function searchParamsOf(filter: AcquisitionFilter): Record<string, string> {
	const entries: [string, string | undefined][] = [
		[ACQUISITION_FILTER_PARAM.STATE, filter.state],
		[ACQUISITION_FILTER_PARAM.FROM, filter.fromDate],
		[ACQUISITION_FILTER_PARAM.TO, filter.toDate],
	]
	return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== undefined))
}

export function filterOfValues(values: AcquisitionFilterValues): AcquisitionFilter {
	return {
		state: stateOf(values.state),
		fromDate: dateOf(values.fromDate),
		toDate: dateOf(values.toDate),
		patientIdentifier: identifierOf(values.patientIdentifier),
	}
}

export function valuesOfFilter(filter: AcquisitionFilter): AcquisitionFilterValues {
	return {
		patientIdentifier: filter.patientIdentifier ?? "",
		state: filter.state ?? ANY_STATE,
		fromDate: filter.fromDate ?? "",
		toDate: filter.toDate ?? "",
	}
}

export function isFiltered(filter: AcquisitionFilter): boolean {
	return Object.values(filter).some((value) => value !== undefined)
}

// administration.yaml searchAcquisitions
export function acquisitionQueryOf(filter: AcquisitionFilter): Readonly<Record<string, string | undefined>> {
	return {
		state: filter.state,
		patient_identifier: filter.patientIdentifier,
		from: startOfDay(filter.fromDate),
		to: endOfDay(filter.toDate),
	}
}
