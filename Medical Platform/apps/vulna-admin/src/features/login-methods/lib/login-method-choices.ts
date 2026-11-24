import { CONFIGURATION_WARNING, LOGIN_METHOD } from "@ansora/contracts"
import {
	OVERRIDE_CHOICE,
	OVERRIDE_CHOICES,
	type OverrideChoice,
	QUICK_LOGIN_METHODS,
} from "@/features/login-methods/constants/login-methods"
import type {
	EffectiveLoginMethod,
	LoginMethodOverrides,
	LoginMethodSource,
	QuickLoginMethod,
	SettingWarning,
} from "@/features/login-methods/types/login-methods.types"

export type OverrideChoices = Readonly<Record<QuickLoginMethod, OverrideChoice>>

function choiceOf(value: boolean | null | undefined): OverrideChoice {
	if (value === true) {
		return OVERRIDE_CHOICE.ENABLED
	}
	return value === false ? OVERRIDE_CHOICE.DISABLED : OVERRIDE_CHOICE.INHERIT
}

function overrideValueOf(choice: OverrideChoice): boolean | null {
	if (choice === OVERRIDE_CHOICE.INHERIT) {
		return null
	}
	return choice === OVERRIDE_CHOICE.ENABLED
}

export function isOverrideChoice(value: unknown): value is OverrideChoice {
	return OVERRIDE_CHOICES.includes(value as OverrideChoice)
}

export function choicesOf(overrides: LoginMethodOverrides): OverrideChoices {
	return {
		card: choiceOf(overrides.card),
		qr: choiceOf(overrides.qr),
		barcode: choiceOf(overrides.barcode),
		pin: choiceOf(overrides.pin),
	}
}

export function overridesOf(choices: OverrideChoices): Required<LoginMethodOverrides> {
	return {
		card: overrideValueOf(choices.card),
		qr: overrideValueOf(choices.qr),
		barcode: overrideValueOf(choices.barcode),
		pin: overrideValueOf(choices.pin),
	}
}

export function sameChoices(first: OverrideChoices, second: OverrideChoices): boolean {
	return QUICK_LOGIN_METHODS.every((method) => first[method] === second[method])
}

// CAP-012-R02, CAP-012-R32
export function previewOf(
	choices: OverrideChoices,
	inherited: readonly EffectiveLoginMethod[],
	level: LoginMethodSource,
): EffectiveLoginMethod[] {
	return QUICK_LOGIN_METHODS.flatMap((method) => {
		const explicit = overrideValueOf(choices[method])
		if (explicit !== null) {
			return [{ method, enabled: explicit, source: level }]
		}
		return inherited.filter((entry) => entry.method === method)
	})
}

export function enabledQuickMethods(methods: readonly EffectiveLoginMethod[]): QuickLoginMethod[] {
	return methods.flatMap((entry) => (entry.method !== LOGIN_METHOD.OIDC && entry.enabled ? [entry.method] : []))
}

// CAP-012-R26
export function hasQuickLoginMethod(methods: readonly EffectiveLoginMethod[]): boolean {
	return enabledQuickMethods(methods).length > 0
}

// CAP-012-R26
export function warningsBeyondPreview(
	warnings: readonly SettingWarning[],
	preview: readonly EffectiveLoginMethod[] | undefined,
): string[] {
	const shownLive = preview !== undefined && !hasQuickLoginMethod(preview)
	return warnings
		.filter((warning) => !(shownLive && warning.code === CONFIGURATION_WARNING.ALL_QUICK_LOGIN_METHODS_DISABLED))
		.map((warning) => warning.message)
}
