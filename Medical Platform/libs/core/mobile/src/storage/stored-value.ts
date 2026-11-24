export function oneOf<Value extends string>(values: readonly string[], value: string | null, fallback: Value): Value {
	return value !== null && values.includes(value) ? (value as Value) : fallback
}
