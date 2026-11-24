import {
	ADMINISTRATION_ERROR_CODE,
	CONFIGURATION_WARNING,
	type ConfigurationWarningCode,
	hasCapturingGroup,
	isSecureWebAddress,
	isWebAddress,
	PACS_CONNECTION_KEYS,
} from "@ansora/contracts"
import { type ConfigurationEntry, configurationSections, parseConfigurationKey } from "./entries"
import { isProfileOnly } from "./items"
import { CONFIGURATION_KEY, QUICK_LOGIN_METHOD_KEYS } from "./keys"
import { type Schema, validate } from "./schema"

export type { ConfigurationWarningCode }

export interface ConfigurationWarning {
	code: ConfigurationWarningCode
	keys: string[]
}

export interface CurrentConfiguration {
	version: number
	entries: readonly ConfigurationEntry[]
}

export interface ConfigurationChangeRequest {
	expectedVersion: number
	changes: readonly ConfigurationEntry[]
}

export type ConfigurationRejectionCode =
	| typeof ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT
	| typeof ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE
	| typeof ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED

export type ConfigurationChangeOutcome =
	| { ok: true; version: number; entries: ConfigurationEntry[]; warnings: ConfigurationWarning[] }
	| { ok: false; code: ConfigurationRejectionCode; problems: string[] }

function rejected(code: ConfigurationRejectionCode, problems: string[]): ConfigurationChangeOutcome {
	return { ok: false, code, problems }
}

function malformedKeys(changes: readonly ConfigurationEntry[]): string[] {
	return changes.filter(([key]) => parseConfigurationKey(key) === undefined).map(([key]) => `${key}: not a section.key`)
}

// konfigurace-a-profily.md 2.7, ADR-035
function profileOnlyKeys(changes: readonly ConfigurationEntry[], schema: Schema): string[] {
	return changes
		.filter(([key]) => isProfileOnly(schema, key))
		.map(([key]) => `${key}: changes only with a new profile release`)
}

function defaultLanguageProblems(values: ReadonlyMap<string, unknown>): string[] {
	const defaultLanguage = values.get(CONFIGURATION_KEY.DEFAULT_LANGUAGE)
	const supported = values.get(CONFIGURATION_KEY.SUPPORTED_LANGUAGES)
	if (!Array.isArray(supported) || supported.includes(defaultLanguage)) {
		return []
	}
	return [
		`${CONFIGURATION_KEY.DEFAULT_LANGUAGE}: ${String(defaultLanguage)} is not among ${CONFIGURATION_KEY.SUPPORTED_LANGUAGES}`,
	]
}

function sessionPolicyProblems(values: ReadonlyMap<string, unknown>): string[] {
	const sessionMax = values.get(CONFIGURATION_KEY.SESSION_MAX_SECONDS)
	const tokenValidity = values.get(CONFIGURATION_KEY.TOKEN_VALIDITY_SECONDS)
	if (typeof sessionMax !== "number" || typeof tokenValidity !== "number" || tokenValidity <= sessionMax) {
		return []
	}
	return [`${CONFIGURATION_KEY.TOKEN_VALIDITY_SECONDS}: above ${CONFIGURATION_KEY.SESSION_MAX_SECONDS}`]
}

function isSet(value: unknown): boolean {
	return value !== null && value !== undefined
}

// CAP-012-R30
const WEB_ADDRESS_KEYS = [
	CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL,
	CONFIGURATION_KEY.CLINICAL_RECORD_INSTANCE_BASE_URI,
] as const

// konfigurace-a-profily.md 2.1, ADR-050 bod 2
function clinicalRecordProblems(values: ReadonlyMap<string, unknown>): string[] {
	const problems = WEB_ADDRESS_KEYS.flatMap((key) => {
		const address = values.get(key)
		return typeof address !== "string" || isWebAddress(address) ? [] : [`${key}: not an http or https address`]
	})
	const storage = values.get(CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL)
	if (typeof storage === "string" && !isSecureWebAddress(storage)) {
		problems.push(`${CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL}: not an https address`)
	}
	return problems
}

// CAP-013-R03, CAP-013-R05
function patientIdentificationProblems(values: ReadonlyMap<string, unknown>): string[] {
	const problems: string[] = []
	const pattern = values.get(CONFIGURATION_KEY.PATIENT_CODE_PATTERN)
	if (typeof pattern === "string") {
		if (!hasCapturingGroup(pattern)) {
			problems.push(`${CONFIGURATION_KEY.PATIENT_CODE_PATTERN}: not a regular expression with a capturing group`)
		}
		if (!isSet(values.get(CONFIGURATION_KEY.PATIENT_CODE_SYSTEM))) {
			problems.push(`${CONFIGURATION_KEY.PATIENT_CODE_PATTERN}: set without ${CONFIGURATION_KEY.PATIENT_CODE_SYSTEM}`)
		}
	}
	if (
		isSet(values.get(CONFIGURATION_KEY.PATIENT_TAG_SOURCE)) !== isSet(values.get(CONFIGURATION_KEY.PATIENT_TAG_SYSTEM))
	) {
		problems.push(
			`${CONFIGURATION_KEY.PATIENT_TAG_SOURCE} and ${CONFIGURATION_KEY.PATIENT_TAG_SYSTEM}: set only together`,
		)
	}
	return problems
}

// CAP-012-R01, CAP-012-S01, konfigurace-a-profily.md 2.1
function pacsConnectionProblems(values: ReadonlyMap<string, unknown>): string[] {
	const setCount = PACS_CONNECTION_KEYS.filter((key) => isSet(values.get(key))).length
	if (setCount === 0 || setCount === PACS_CONNECTION_KEYS.length) {
		return []
	}
	return [`${PACS_CONNECTION_KEYS.join(", ")}: set only together`]
}

function quickLoginWarning(values: ReadonlyMap<string, unknown>): ConfigurationWarning[] {
	const allDisabled = QUICK_LOGIN_METHOD_KEYS.every((key) => values.get(key) === false)
	return allDisabled
		? [{ code: CONFIGURATION_WARNING.ALL_QUICK_LOGIN_METHODS_DISABLED, keys: [...QUICK_LOGIN_METHOD_KEYS] }]
		: []
}

function outboundWarning(
	before: ReadonlyMap<string, unknown>,
	changes: readonly ConfigurationEntry[],
	outboundTargetKeys: readonly string[],
): ConfigurationWarning[] {
	const changedTargets = changes
		.filter(
			([key, value]) => outboundTargetKeys.includes(key) && JSON.stringify(before.get(key)) !== JSON.stringify(value),
		)
		.map(([key]) => key)
	return changedTargets.length === 0
		? []
		: [{ code: CONFIGURATION_WARNING.OUTBOUND_ALLOWLIST_UPDATE_REQUIRED, keys: changedTargets }]
}

export function applyConfigurationChange(
	current: CurrentConfiguration,
	request: ConfigurationChangeRequest,
	schema: Schema,
	outboundTargetKeys: readonly string[],
): ConfigurationChangeOutcome {
	if (request.expectedVersion !== current.version) {
		return rejected(ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT, [
			`expected version ${request.expectedVersion}, current version is ${current.version}`,
		])
	}
	const malformed = [...malformedKeys(request.changes), ...profileOnlyKeys(request.changes, schema)]
	if (malformed.length > 0) {
		return rejected(ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE, malformed)
	}
	const before = new Map(current.entries)
	const values = new Map(before)
	for (const [key, value] of request.changes) {
		values.set(key, value)
	}
	const entries = [...values]
	const schemaProblems = [
		...validate(configurationSections(entries), schema),
		...sessionPolicyProblems(values),
		...patientIdentificationProblems(values),
		...pacsConnectionProblems(values),
		...clinicalRecordProblems(values),
	]
	if (schemaProblems.length > 0) {
		return rejected(ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE, schemaProblems)
	}
	const languageProblems = defaultLanguageProblems(values)
	if (languageProblems.length > 0) {
		return rejected(ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED, languageProblems)
	}
	return {
		ok: true,
		version: current.version + 1,
		entries,
		warnings: [...quickLoginWarning(values), ...outboundWarning(before, request.changes, outboundTargetKeys)],
	}
}
