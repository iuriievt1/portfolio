import type { MedplumClient, MedplumRequestOptions } from "@medplum/core"
import type { Resource } from "./fhir-types"
import { PAGE_QUERY, type SearchQuery } from "./history-resources"

export type SearchedResourceType = "Observation" | "BodyStructure" | "DocumentReference" | "ImagingStudy"

export function ofType<T extends Resource>(resources: readonly Resource[], resourceType: T["resourceType"]): T[] {
	return resources.filter((resource): resource is T => resource.resourceType === resourceType)
}

// backend.md 3.1, ADR-050 bod 11
export async function allPagesOf(
	client: MedplumClient,
	resourceType: SearchedResourceType,
	query: SearchQuery,
	options?: MedplumRequestOptions,
): Promise<Resource[]> {
	const resources: Resource[] = []
	for await (const page of client.searchResourcePages(resourceType, { ...query, ...PAGE_QUERY }, options)) {
		resources.push(...page)
	}
	return resources
}
