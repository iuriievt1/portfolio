import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain/ports"
import type { Bundle, BundleEntry, Resource } from "./fhir-types"

const WRITTEN_STATUS = /^20[01]/
const LOCATION_ID = /^[A-Za-z]+\/([^/]+)/
const URN_UUID = "urn:uuid:"

export function urnOf(id: string): string {
	return `${URN_UUID}${id}`
}

// ADR-050 bod 10
export function conditionalUpdate(resource: Resource, identifier: string): BundleEntry {
	return {
		resource,
		request: { method: "PUT", url: `${resource.resourceType}?identifier=${encodeURIComponent(identifier)}` },
	}
}

// ADR-050
export function conditionalUpdateAt(fullUrl: string, resource: Resource, identifier: string): BundleEntry {
	return { fullUrl, ...conditionalUpdate(resource, identifier) }
}

// ADR-050 bod 10
export function idOfEntry(entry: BundleEntry | undefined, what: string): string {
	const id = entry?.resource?.id ?? LOCATION_ID.exec(entry?.response?.location ?? "")?.[1]
	if (id === undefined || !WRITTEN_STATUS.test(entry?.response?.status ?? "")) {
		throw new ClinicalRecordStoreError(
			CLINICAL_RECORD_FAILURE.REJECTED,
			`the store did not return the ${what}: ${entry?.response?.status ?? "no entry"}`,
		)
	}
	return id
}

// ADR-050 bod 10
export function requireWritten(request: Bundle, result: Bundle): void {
	const written = result.entry ?? []
	for (const [index, entry] of (request.entry ?? []).entries()) {
		idOfEntry(written[index], entry.resource?.resourceType ?? "resource")
	}
}
