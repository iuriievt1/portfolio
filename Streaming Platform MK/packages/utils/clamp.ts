export const clamp = (val: number, min: number, max: number): number => {
	if (typeof val !== 'number' || Number.isNaN(val)) return min
	if (Number.isNaN(min) || Number.isNaN(max)) return val
	if (min > max) throw new RangeError(`clamp: min (${min}) must not exceed max (${max})`)
	return Math.min(max, Math.max(min, val))
}

export const toPercent = (p: number): number => clamp(Number.isNaN(p) ? 0 : p, 0, 1) * 100
