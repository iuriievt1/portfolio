import type { ManagedEnrolment } from "./enrolment"

export const MANAGED_ENROLMENT_KEYS = {
	registrationSecret: "registration_secret",
	groupCode: "group_code",
} as const

export type ManagedEnrolmentKeys = typeof MANAGED_ENROLMENT_KEYS

export function readManagedEnrolment(
	managed: Readonly<Record<string, unknown>>,
	keys: ManagedEnrolmentKeys,
): ManagedEnrolment {
	const enrolment: ManagedEnrolment = {}
	const secret = managed[keys.registrationSecret]
	const group = managed[keys.groupCode]
	if (typeof secret === "string" && secret.length > 0) {
		enrolment.registrationSecret = secret
	}
	if (typeof group === "string" && group.length > 0) {
		enrolment.groupCode = group
	}
	return enrolment
}
