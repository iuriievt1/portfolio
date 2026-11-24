import type { LoginMethod, MobileContract } from "@ansora/contracts"
import { type PinPolicy, pinPolicyOf } from "@ansora/core-mobile"
import { setInstanceLanguages } from "../../i18n/language-store"
import { rememberDeviceKeyHold } from "../device/device-key-hold"
import { rememberLocalCopyRetention } from "../upload/local-copy-retention"

export type EffectiveConfiguration = MobileContract.components["schemas"]["EffectiveConfiguration"]

let current: EffectiveConfiguration | undefined
let withdrawn = new Set<LoginMethod>()

export function rememberEffectiveConfiguration(received: EffectiveConfiguration | undefined): void {
	if (received === undefined) {
		return
	}
	current = { ...current, ...received }
	withdrawn = new Set()
	rememberDeviceKeyHold(received.device_key_hold_seconds)
	rememberLocalCopyRetention(received.device_local_copy_seconds)
	setInstanceLanguages({ defaultLanguage: current.default_language, supportedLanguages: current.supported_languages })
}

export function effectiveConfiguration(): EffectiveConfiguration | undefined {
	return current
}

// CAP-001-S09
export function withdrawLoginMethod(method: LoginMethod): void {
	withdrawn = new Set(withdrawn).add(method)
}

export function offersLoginMethod(method: LoginMethod): boolean {
	return !withdrawn.has(method) && (current?.allowed_login_methods?.includes(method) ?? true)
}

export function currentPinPolicy(): PinPolicy {
	return pinPolicyOf(current?.pin_min_length, current?.pin_complexity)
}
