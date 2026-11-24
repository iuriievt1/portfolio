import { AUDIT_TEXT_FILTER_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { isCalendarDate } from "@/lib/calendar-date"
import { fillText } from "@/lib/format"

const errors = cs.audit.filters.errors

const textFilter = z
	.string()
	.trim()
	.max(AUDIT_TEXT_FILTER_MAX_LENGTH, fillText(cs.errors.tooLong, { max: String(AUDIT_TEXT_FILTER_MAX_LENGTH) }))

const dateFilter = z.string().refine((text) => text === "" || isCalendarDate(text), errors.date)

interface DateRange {
	fromDate: string
	toDate: string
}

function isOrdered(range: DateRange): boolean {
	return range.fromDate === "" || range.toDate === "" || range.fromDate <= range.toDate
}

const DATE_ORDER_ISSUE = { message: errors.dateOrder, path: ["toDate"] }

// CAP-025-R07, administrace-model-a-api.md 9
export const auditFilterSchema = z
	.object({
		fromDate: dateFilter,
		toDate: dateFilter,
		eventType: z.string(),
		outcome: z.string(),
		user: textFilter,
		device: textFilter,
		systemJob: z.string(),
		patientIdentifier: textFilter,
	})
	.refine(isOrdered, DATE_ORDER_ISSUE)

export type AuditFilterValues = z.infer<typeof auditFilterSchema>

// NAB-351
export const auditExportSchema = z
	.object({
		fromDate: dateFilter,
		toDate: dateFilter,
		eventType: z.string(),
	})
	.refine(isOrdered, DATE_ORDER_ISSUE)

export type AuditExportValues = z.infer<typeof auditExportSchema>
