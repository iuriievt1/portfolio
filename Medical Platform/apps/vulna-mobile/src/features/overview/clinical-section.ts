import { REMOTE_FAILURE, remoteFailureOf } from "../../api/remote-failure"

export const CLINICAL_SECTION = {
	SHOWN: "shown",
	UNAVAILABLE: "unavailable",
} as const

export type ClinicalSection<Item> =
	| { kind: typeof CLINICAL_SECTION.SHOWN; items: readonly Item[] }
	| { kind: typeof CLINICAL_SECTION.UNAVAILABLE }

const NO_ITEMS: readonly never[] = []

// CAP-020-R16, ADR-054, E129
function isClinicalRecordUnavailable(error: unknown): boolean {
	return remoteFailureOf(error) === REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE
}

// CAP-020-R16, E129
export async function readClinicalSection<Item>(read: () => Promise<readonly Item[]>): Promise<ClinicalSection<Item>> {
	try {
		return { kind: CLINICAL_SECTION.SHOWN, items: await read() }
	} catch (error) {
		if (isClinicalRecordUnavailable(error)) {
			return { kind: CLINICAL_SECTION.UNAVAILABLE }
		}
		throw error
	}
}

export function shownItemsOf<Item>(section: ClinicalSection<Item> | undefined): readonly Item[] {
	return section?.kind === CLINICAL_SECTION.SHOWN ? section.items : NO_ITEMS
}
