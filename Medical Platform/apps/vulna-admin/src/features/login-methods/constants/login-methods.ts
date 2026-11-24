import { CONFIGURATION_KEY, type ConfigurationKey, LOGIN_METHOD } from "@ansora/contracts"
import type { LoginMethodSource, QuickLoginMethod } from "@/features/login-methods/types/login-methods.types"

// CAP-012-R02
export const QUICK_LOGIN_METHODS: readonly QuickLoginMethod[] = [
	LOGIN_METHOD.CARD,
	LOGIN_METHOD.QR,
	LOGIN_METHOD.BARCODE,
	LOGIN_METHOD.PIN,
]

export const INSTALLATION_LOGIN_METHOD_KEY: Readonly<Record<QuickLoginMethod, ConfigurationKey>> = {
	[LOGIN_METHOD.CARD]: CONFIGURATION_KEY.LOGIN_METHOD_CARD,
	[LOGIN_METHOD.QR]: CONFIGURATION_KEY.LOGIN_METHOD_QR,
	[LOGIN_METHOD.BARCODE]: CONFIGURATION_KEY.LOGIN_METHOD_BARCODE,
	[LOGIN_METHOD.PIN]: CONFIGURATION_KEY.LOGIN_METHOD_PIN,
}

export const LOGIN_METHOD_SOURCE = {
	INSTALLATION: "installation",
	GROUP: "group",
	DEVICE: "device",
} as const satisfies Record<string, LoginMethodSource>

export const OVERRIDE_CHOICE = {
	INHERIT: "inherit",
	ENABLED: "enabled",
	DISABLED: "disabled",
} as const

export type OverrideChoice = (typeof OVERRIDE_CHOICE)[keyof typeof OVERRIDE_CHOICE]

export const OVERRIDE_CHOICES: readonly OverrideChoice[] = [
	OVERRIDE_CHOICE.INHERIT,
	OVERRIDE_CHOICE.ENABLED,
	OVERRIDE_CHOICE.DISABLED,
]
