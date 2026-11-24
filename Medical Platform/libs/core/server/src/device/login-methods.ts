import { LOGIN_METHOD, type LoginMethod } from "@ansora/contracts"
import { CONFIGURATION_KEY, type ConfigurationKey } from "../configuration/keys"

export { LOGIN_METHOD, type LoginMethod }

export const LOGIN_METHOD_SOURCE = {
	INSTALLATION: "installation",
	GROUP: "group",
	DEVICE: "device",
} as const

export type LoginMethodSource = (typeof LOGIN_METHOD_SOURCE)[keyof typeof LOGIN_METHOD_SOURCE]

export type LoginMethodOverrides = Partial<Record<Exclude<LoginMethod, "oidc">, boolean | null>>

export interface EffectiveLoginMethod {
	method: LoginMethod
	enabled: boolean
	source: LoginMethodSource
}

export const QUICK_LOGIN_METHODS: readonly Exclude<LoginMethod, "oidc">[] = [
	LOGIN_METHOD.CARD,
	LOGIN_METHOD.QR,
	LOGIN_METHOD.BARCODE,
	LOGIN_METHOD.PIN,
]

const INSTALLATION_KEY: Record<Exclude<LoginMethod, "oidc">, ConfigurationKey> = {
	card: CONFIGURATION_KEY.LOGIN_METHOD_CARD,
	qr: CONFIGURATION_KEY.LOGIN_METHOD_QR,
	barcode: CONFIGURATION_KEY.LOGIN_METHOD_BARCODE,
	pin: CONFIGURATION_KEY.LOGIN_METHOD_PIN,
}

export interface LoginMethodLevels {
	installation: ReadonlyMap<string, unknown>
	group?: LoginMethodOverrides
	device?: LoginMethodOverrides
}

export function effectiveLoginMethods(levels: LoginMethodLevels): EffectiveLoginMethod[] {
	const methods: EffectiveLoginMethod[] = [
		{ method: LOGIN_METHOD.OIDC, enabled: true, source: LOGIN_METHOD_SOURCE.INSTALLATION },
	]
	for (const method of QUICK_LOGIN_METHODS) {
		methods.push(effectiveMethod(method, levels))
	}
	return methods
}

/** The offer promises a quick way in; a set without one leaves only the full account login. */
export function hasNoQuickLoginMethod(methods: readonly EffectiveLoginMethod[]): boolean {
	return methods.every((method) => method.method === LOGIN_METHOD.OIDC || !method.enabled)
}

export function enabledLoginMethods(methods: readonly EffectiveLoginMethod[]): LoginMethod[] {
	return methods.filter((method) => method.enabled).map((method) => method.method)
}

export function isLoginMethodOverrides(value: unknown): value is LoginMethodOverrides {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false
	}
	return Object.entries(value).every(
		([key, entry]) =>
			QUICK_LOGIN_METHODS.includes(key as Exclude<LoginMethod, "oidc">) &&
			(entry === null || typeof entry === "boolean"),
	)
}

export type ExplicitOverrides = Record<string, boolean>

// CAP-012-R02
export function explicitOverrides(overrides: LoginMethodOverrides): ExplicitOverrides {
	const explicit: ExplicitOverrides = {}
	for (const method of QUICK_LOGIN_METHODS) {
		const value = overrides[method]
		if (typeof value === "boolean") {
			explicit[method] = value
		}
	}
	return explicit
}

export function sameOverrides(first: LoginMethodOverrides, second: LoginMethodOverrides): boolean {
	const explicitFirst = explicitOverrides(first)
	const explicitSecond = explicitOverrides(second)
	return QUICK_LOGIN_METHODS.every((method) => explicitFirst[method] === explicitSecond[method])
}

function effectiveMethod(method: Exclude<LoginMethod, "oidc">, levels: LoginMethodLevels): EffectiveLoginMethod {
	const onDevice = levels.device?.[method]
	if (typeof onDevice === "boolean") {
		return { method, enabled: onDevice, source: LOGIN_METHOD_SOURCE.DEVICE }
	}
	const inGroup = levels.group?.[method]
	if (typeof inGroup === "boolean") {
		return { method, enabled: inGroup, source: LOGIN_METHOD_SOURCE.GROUP }
	}
	return {
		method,
		enabled: levels.installation.get(INSTALLATION_KEY[method]) === true,
		source: LOGIN_METHOD_SOURCE.INSTALLATION,
	}
}
