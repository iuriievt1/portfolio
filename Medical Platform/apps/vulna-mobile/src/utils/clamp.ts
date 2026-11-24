export function clamp(value: number, low: number, high: number): number {
	"worklet"
	return Math.min(Math.max(value, low), high)
}
