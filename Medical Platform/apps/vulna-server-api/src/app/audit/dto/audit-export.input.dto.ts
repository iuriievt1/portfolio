import { type AdministrationContract, AUDIT_CODE_FILTER_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

export type AuditExportInput = NonNullable<
	AdministrationContract.operations["exportAudit"]["requestBody"]
>["content"]["application/json"]

// administration.yaml exportAudit
export const auditExportSchema = z.strictObject({
	from: z.iso.datetime({ offset: true }).optional(),
	to: z.iso.datetime({ offset: true }).optional(),
	event_type: z.string().trim().min(1).max(AUDIT_CODE_FILTER_MAX_LENGTH).optional(),
}) satisfies z.ZodType<AuditExportInput>
