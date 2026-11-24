import {
	AUDIT_CODE_FILTER_MAX_LENGTH,
	AUDIT_TEXT_FILTER_MAX_LENGTH,
	SYSTEM_JOB,
	type SystemJob,
} from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

const textFilter = (max: number) => z.string().trim().min(1).max(max).optional()

// administration.yaml searchAudit, CAP-025-R07
export const auditSearchSchema = pageSchema.extend({
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
	user: textFilter(AUDIT_TEXT_FILTER_MAX_LENGTH),
	system_job: z.enum(Object.values(SYSTEM_JOB) as [SystemJob, ...SystemJob[]]).optional(),
	device: textFilter(AUDIT_TEXT_FILTER_MAX_LENGTH),
	event_type: textFilter(AUDIT_CODE_FILTER_MAX_LENGTH),
	patient_identifier: textFilter(AUDIT_TEXT_FILTER_MAX_LENGTH),
	outcome: textFilter(AUDIT_CODE_FILTER_MAX_LENGTH),
})

export type AuditSearchInput = z.infer<typeof auditSearchSchema>
