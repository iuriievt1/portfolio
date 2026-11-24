import type { ConfigurationKey } from "@ansora/contracts"

export type ConfigurationValues = ReadonlyMap<string, unknown>

export function textValueOf(values: ConfigurationValues, key: ConfigurationKey): string | undefined {
	const value = values.get(key)
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

export function requiredTextOf(values: ConfigurationValues, key: ConfigurationKey): string {
	const value = textValueOf(values, key)
	if (value === undefined) {
		throw new Error(`configuration key ${key} holds no text`)
	}
	return value
}

export function integerValueOf(values: ConfigurationValues, key: ConfigurationKey): number | undefined {
	const value = values.get(key)
	return typeof value === "number" && Number.isInteger(value) ? value : undefined
}

export function requiredIntegerOf(values: ConfigurationValues, key: ConfigurationKey): number {
	const value = integerValueOf(values, key)
	if (value === undefined) {
		throw new Error(`configuration key ${key} is not an integer`)
	}
	return value
}

export function choiceValueOf<T extends string>(
	values: ConfigurationValues,
	key: ConfigurationKey,
	allowed: readonly T[],
): T | undefined {
	const value = values.get(key)
	return allowed.find((candidate) => candidate === value)
}

export function requiredChoiceOf<T extends string>(
	values: ConfigurationValues,
	key: ConfigurationKey,
	allowed: readonly T[],
): T {
	const value = choiceValueOf(values, key, allowed)
	if (value === undefined) {
		throw new Error(`configuration key ${key} holds ${String(values.get(key))}, not one of ${allowed.join(", ")}`)
	}
	return value
}
