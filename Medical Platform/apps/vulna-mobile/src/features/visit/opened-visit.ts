import type { Patient } from "../../api/patients"

const NEW_VISIT = "new"

// CAP-014-R06
export type VisitIdentity =
	| { encounterId: string; encounterKey: undefined }
	| { encounterId: undefined; encounterKey: string }

export type OpenedVisit = VisitIdentity & {
	patient: Patient
	openedAt: Date
}

let opened: OpenedVisit | undefined

export function openVisit(visit: OpenedVisit): string {
	opened = visit
	return visitRouteIdOf(visit)
}

export function openedVisit(routeId: string): OpenedVisit | undefined {
	return opened !== undefined && visitRouteIdOf(opened) === routeId ? opened : undefined
}

export function forgetOpenedVisit(): void {
	opened = undefined
}

function visitRouteIdOf(visit: OpenedVisit): string {
	return visit.encounterId ?? NEW_VISIT
}
