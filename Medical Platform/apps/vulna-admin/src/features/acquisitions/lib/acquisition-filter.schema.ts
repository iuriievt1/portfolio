import { z } from "zod"
import cs from "@/i18n/cs.json"
import { isCalendarDate } from "@/lib/calendar-date"
import { fillText } from "@/lib/format"

const errors = cs.acquisitions.filters.errors

// administration.yaml searchAcquisitions patient_identifier
export const PATIENT_IDENTIFIER_MAX_LENGTH = 200

const dateFilter = z.string().refine((text) => text === "" || isCalendarDate(text), errors.date)

interface DateRange {
	fromDate: string
	toDate: string
}

function isOrdered(range: DateRange): boolean {
	return range.fromDate === "" || range.toDate === "" || range.fromDate <= range.toDate
}

// CAP-004-R10, administration.yaml searchAcquisitions
export const acquisitionFilterSchema = z
	.object({
		patientIdentifier: z
			.string()
			.trim()
			.max(PATIENT_IDENTIFIER_MAX_LENGTH, fillText(cs.errors.tooLong, { max: String(PATIENT_IDENTIFIER_MAX_LENGTH) })),
		state: z.string(),
		fromDate: dateFilter,
		toDate: dateFilter,
	})
	.refine(isOrdered, { message: errors.dateOrder, path: ["toDate"] })

export type AcquisitionFilterValues = z.infer<typeof acquisitionFilterSchema>
