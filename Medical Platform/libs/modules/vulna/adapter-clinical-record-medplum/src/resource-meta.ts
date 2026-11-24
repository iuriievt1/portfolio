import type { ActorDepartment, ClinicalDraftWoundType } from "@ansora/vulna-domain/ports"
import { FINDING_RECORD, type FindingRecord } from "./draft-records"
import type { Coding, Meta } from "./fhir-types"
import { type IdentifierSystems, instanceSourceOf } from "./identifiers"

// datovy-model.md 13.1
const PROJECTION_VERSION = "v1"

export interface ProjectionContext {
	systems: IdentifierSystems
	instanceBase: string
}

type DraftOwner = Pick<ClinicalDraftWoundType, "acquisitionId" | "department">

// ADR-050 bod 8
export function departmentTagOf(department: ActorDepartment | undefined, systems: IdentifierSystems): Coding[] {
	return department === undefined ? [] : [{ system: systems.departmentTag, code: department.id }]
}

// ADR-050 bod 3, datovy-model.md 13.1
export function projectionMetaOf(context: ProjectionContext): Meta {
	return {
		tag: [{ system: context.systems.projectionTag, code: PROJECTION_VERSION }],
		source: instanceSourceOf(context.instanceBase),
	}
}

// ADR-050, datovy-model.md 13.1
export function closedMetaOf(
	profile: string,
	department: ActorDepartment | undefined,
	context: ProjectionContext,
): Meta {
	return {
		profile: [profile],
		tag: [
			...departmentTagOf(department, context.systems),
			{ system: context.systems.projectionTag, code: PROJECTION_VERSION },
		],
		source: instanceSourceOf(context.instanceBase),
	}
}

// ADR-050, ADR-052, datovy-model.md 13.1
export function clinicalMetaOf(
	profile: string,
	owner: DraftOwner,
	record: FindingRecord,
	context: ProjectionContext,
): Meta {
	const meta = closedMetaOf(profile, owner.department, context)
	if (record === FINDING_RECORD.CLOSED) {
		return meta
	}
	return { ...meta, tag: [...(meta.tag ?? []), { system: context.systems.draftTag, code: owner.acquisitionId }] }
}
