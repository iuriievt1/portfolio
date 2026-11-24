import type { AdministrationContract, ConfigurationKey } from "@ansora/contracts"
import {
	INSTALLATION_LOGIN_METHOD_KEY,
	LOGIN_METHOD_SOURCE,
	QUICK_LOGIN_METHODS,
} from "@/features/login-methods/constants/login-methods"
import type { EffectiveLoginMethod } from "@/features/login-methods/types/login-methods.types"

type ConfigurationItem = AdministrationContract.components["schemas"]["ConfigurationItem"]

function methodsFrom(valueAt: (key: ConfigurationKey) => unknown): EffectiveLoginMethod[] {
	return QUICK_LOGIN_METHODS.map((method) => ({
		method,
		enabled: valueAt(INSTALLATION_LOGIN_METHOD_KEY[method]) === true,
		source: LOGIN_METHOD_SOURCE.INSTALLATION,
	}))
}

// CAP-012-R02
export function installationLoginMethods(items: readonly ConfigurationItem[]): EffectiveLoginMethod[] {
	const values = new Map(items.map((item) => [item.key, item.value]))
	return methodsFrom((key) => values.get(key))
}

// CAP-012-R26
export function installationPreview(edits: Readonly<Record<string, unknown>>): EffectiveLoginMethod[] {
	return methodsFrom((key) => edits[key])
}
