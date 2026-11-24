import { APP_VERSION_PATTERN } from "@ansora/contracts"

export interface AppVersion {
	major: number
	minor: number
	patch: number
}

const ASSEMBLY_PATTERN = /^[0-9A-Za-z.-]+$/
const VERSION_ASSEMBLY_SEPARATOR = "+"

export function parseVersion(value: string): AppVersion | undefined {
	if (!APP_VERSION_PATTERN.test(value)) {
		return undefined
	}
	const [major, minor, patch] = value.split(".").map(Number)
	if (major === undefined || minor === undefined || patch === undefined) {
		return undefined
	}
	return { major, minor, patch }
}

// index.yaml AppVersion, CAP-008-R12
export function appVersionOfHeader(value: string): string | undefined {
	const parts = value.split(VERSION_ASSEMBLY_SEPARATOR)
	if (parts.length !== 2) {
		return undefined
	}
	const [version, assembly] = parts
	if (version === undefined || assembly === undefined || !ASSEMBLY_PATTERN.test(assembly)) {
		return undefined
	}
	return APP_VERSION_PATTERN.test(version) ? version : undefined
}

export function parseAppVersionHeader(value: string): AppVersion | undefined {
	const version = appVersionOfHeader(value)
	return version === undefined ? undefined : parseVersion(version)
}

export function compareVersions(left: AppVersion, right: AppVersion): number {
	return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

export function isAppVersionSupported(reported: AppVersion, minimum: AppVersion | undefined): boolean {
	return minimum === undefined || compareVersions(reported, minimum) >= 0
}
