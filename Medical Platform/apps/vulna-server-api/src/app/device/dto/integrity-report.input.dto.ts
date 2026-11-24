import { INTEGRITY_SIGNALS, type IntegrityReport } from "@ansora/contracts"
import { z } from "zod"

const momentSchema = z.iso.datetime({ offset: true })

// CAP-008-R11, CAP-008-S08, identity.yaml IntegrityReport
export const integrityReportSchema = z.strictObject({
	signals: z
		.array(z.enum(INTEGRITY_SIGNALS))
		.min(1)
		.max(INTEGRITY_SIGNALS.length)
		.refine((signals) => new Set(signals).size === signals.length, { message: "signals repeat a signal" }),
	detected_at: momentSchema,
	unsent_items: z.strictObject({
		count: z.int().min(0),
		oldest_acquired_at: momentSchema.nullable(),
	}),
}) satisfies z.ZodType<IntegrityReport>
