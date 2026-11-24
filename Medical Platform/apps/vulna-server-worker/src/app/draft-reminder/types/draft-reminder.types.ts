export interface DraftReminderRun {
	remindedCount: number
	staleCount: number
}

export interface DurationUnit {
	unit: "day" | "hour" | "minute" | "second"
	seconds: number
}
