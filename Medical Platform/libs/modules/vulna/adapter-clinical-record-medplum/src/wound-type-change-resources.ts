import type { ClinicalWoundTypeChange } from "@ansora/vulna-domain/ports"
import { conditionalUpdateAt, urnOf } from "./bundle-entries"
import type { Bundle, Practitioner, PractitionerRole, Reference } from "./fhir-types"
import { tokenOf } from "./identifiers"
import { amendedWoundTypeObservationOf } from "./observation-resources"
import { PROVENANCE_ROLE, provenanceEntryOf } from "./provenance-resources"
import type { ProjectionContext } from "./resource-meta"

// ADR-050 bod 10, datovy-model.md 13.1
const WOUND_TYPE_CHANGE_EVENT = "wound-type-change"

// CAP-020-R21, ADR-049 (doplnění D32), ADR-050 bod 10, backend.md 3 T5
export function woundTypeChangeBundleOf(
	change: ClinicalWoundTypeChange,
	author: Reference<Practitioner | PractitionerRole>,
	context: ProjectionContext,
): Bundle {
	const observationUrl = urnOf(change.changeId)
	return {
		resourceType: "Bundle",
		type: "transaction",
		entry: [
			conditionalUpdateAt(
				observationUrl,
				amendedWoundTypeObservationOf(change, author, context),
				tokenOf(context.systems.findingWoundType, change.findingId),
			),
			provenanceEntryOf(
				{
					key: `finding:${change.findingId}:${WOUND_TYPE_CHANGE_EVENT}:${change.changeId}`,
					patientId: change.patientId,
					targets: [observationUrl],
					recorded: change.changedAt,
					occurred: undefined,
					agents: [{ role: PROVENANCE_ROLE.AUTHOR, who: author }],
				},
				context.systems,
			),
		],
	}
}
