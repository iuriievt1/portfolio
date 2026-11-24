// CAP-025-R22, zarizeni-a-sifrovani.md 1.1
export function isIsoMoment(value: unknown): value is string {
	if (typeof value !== "string") {
		return false
	}
	const moment = new Date(value)
	return !Number.isNaN(moment.getTime()) && moment.toISOString() === value
}
