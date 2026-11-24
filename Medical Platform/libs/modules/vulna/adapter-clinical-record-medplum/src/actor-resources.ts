import type { ActorDepartment, ClinicalActor } from "@ansora/vulna-domain/ports"
import type {
	AccessPolicy,
	Organization,
	Practitioner,
	PractitionerRole,
	Project,
	ProjectMembership,
	ProjectMembershipAccess,
	Reference,
	User,
} from "./fhir-types"
import { type IdentifierSystems, practitionerRoleValueOf, tokenOf } from "./identifiers"
import { DEPARTMENT_TAG_PARAMETER } from "./project"

// NAB-479
const USER_FIRST_NAME = "Vulna"

export interface ActorPolicies {
	noAccess: Reference<AccessPolicy>
	byRole: ReadonlyMap<string, Reference<AccessPolicy>>
}

// ADR-050 bod 5, CAP-021-R38
export function practitionerOf(actor: ClinicalActor, systems: IdentifierSystems): Practitioner {
	return {
		resourceType: "Practitioner",
		identifier: [{ system: systems.practitioner, value: actor.userId }],
		active: true,
		name: [{ text: actor.displayName }],
	}
}

// ADR-050 bod 8, datovy-model.md 13.2
export function departmentOrganizationOf(
	department: ActorDepartment,
	root: Reference<Organization>,
	systems: IdentifierSystems,
): Organization {
	return {
		resourceType: "Organization",
		identifier: [{ system: systems.department, value: department.id }],
		active: true,
		name: department.code,
		partOf: root,
	}
}

// ADR-050 bod 5, CAP-021-R38
export function practitionerRoleOf(
	actor: ClinicalActor,
	department: ActorDepartment,
	practitioner: Reference<Practitioner>,
	organization: Reference<Organization>,
	systems: IdentifierSystems,
): PractitionerRole {
	return {
		resourceType: "PractitionerRole",
		identifier: [{ system: systems.practitionerRole, value: practitionerRoleValueOf(actor.userId, department.id) }],
		active: true,
		practitioner,
		organization,
	}
}

// ADR-053 bod 3, ADR-042 bod 1
export function userOf(actor: ClinicalActor, project: Reference<Project>): User {
	return {
		resourceType: "User",
		firstName: USER_FIRST_NAME,
		lastName: actor.userId,
		externalId: actor.userId,
		project,
	}
}

// ADR-053 bod 3, ADR-053 bod 6, CAP-001-R31
export function membershipAccessOf(
	actor: ClinicalActor,
	policies: ActorPolicies,
	systems: IdentifierSystems,
): ProjectMembershipAccess[] {
	if (actor.department === undefined) {
		return [{ policy: policies.noAccess }]
	}
	const parameter = [
		{ name: DEPARTMENT_TAG_PARAMETER, valueString: tokenOf(systems.departmentTag, actor.department.id) },
	]
	const access = actor.roles.flatMap((role) => {
		const policy = policies.byRole.get(role)
		return policy === undefined ? [] : [{ policy, parameter }]
	})
	return access.length > 0 ? access : [{ policy: policies.noAccess }]
}

function accessKeyOf(access: readonly ProjectMembershipAccess[] | undefined): string {
	return JSON.stringify(
		(access ?? []).map((entry) => ({
			policy: entry.policy.reference,
			parameter: (entry.parameter ?? []).map((parameter) => [parameter.name, parameter.valueString]),
		})),
	)
}

// ADR-053 bod 6
export function sameAccess(
	current: readonly ProjectMembershipAccess[] | undefined,
	wanted: readonly ProjectMembershipAccess[],
): boolean {
	return accessKeyOf(current) === accessKeyOf(wanted)
}

export function membershipOf(
	actor: ClinicalActor,
	project: Reference<Project>,
	user: Reference<User>,
	practitioner: Reference<Practitioner>,
	access: ProjectMembershipAccess[],
): ProjectMembership {
	return {
		resourceType: "ProjectMembership",
		project,
		user,
		profile: practitioner,
		externalId: actor.userId,
		access,
	}
}
