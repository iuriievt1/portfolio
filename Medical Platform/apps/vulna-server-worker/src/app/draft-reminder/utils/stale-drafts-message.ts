import type { DurationUnit } from "../types/draft-reminder.types"

const CZECH = "cs"

const DURATION_UNITS: readonly DurationUnit[] = [
	{ unit: "day", seconds: 86_400 },
	{ unit: "hour", seconds: 3600 },
	{ unit: "minute", seconds: 60 },
	{ unit: "second", seconds: 1 },
]

// CAP-012-R31
export function czechDurationOf(totalSeconds: number): string {
	const exact = DURATION_UNITS.find((candidate) => totalSeconds % candidate.seconds === 0)
	if (exact === undefined) {
		throw new Error(`the duration ${totalSeconds} s is not a whole number of seconds`)
	}
	const format = new Intl.NumberFormat(CZECH, { style: "unit", unit: exact.unit, unitDisplay: "long" })
	return format.format(totalSeconds / exact.seconds)
}

// CAP-026-R16, CAP-015-R18, stavy-a-mikrocopy.md E97
export function staleDraftsMessageOf(staleCount: number, reminderSeconds: number): string {
	return (
		`Rozpracovaných záznamů bez doplnění déle než ${czechDurationOf(reminderSeconds)}: ${staleCount}. ` +
		"Nic se nemaže: zahodit je lze jen potvrzením pořizovatele, nebo souhlasem správce u záznamů jednoho " +
		"pořizovatele. Pořizovatelé jsou upozorněni také."
	)
}
